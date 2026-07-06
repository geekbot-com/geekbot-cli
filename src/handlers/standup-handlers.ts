import type { GlobalOptions } from "../cli/globals.ts";
import { CliError } from "../errors/cli-error.ts";
import { buildNotFoundSuggestion } from "../errors/not-found-helper.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import type { HttpClient } from "../http/client.ts";
import { idempotencyHeader } from "../http/idempotency.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import {
	V2StandupItemResponseSchema,
	V2StandupListResponseSchema,
	V2StandupParticipationResponseSchema,
} from "../schemas/v2-standup.ts";
import { parseQuestionsInputV2, parseV2DateFilter } from "../utils/input-parsers.ts";
import { buildReceipt } from "../utils/receipt.ts";
import {
	validateDayAbbreviations,
	validateLimit,
	validateNumericId,
	validateSlackIdList,
	validateTimeFormat,
} from "../utils/validation.ts";

// ── Option Interfaces ─────────────────────────────────────────────────

export interface StandupListOptions {
	state?: string;
	isAnonymous?: string;
	broadcastChannel?: string;
	createdSince?: string;
	createdUntil?: string;
	cursor?: string;
	pageSize?: string;
	include?: string;
}

export interface StandupCreateOptions {
	name?: string;
	channel: string;
	syncChannel?: string;
	time?: string;
	timezone?: string;
	days?: string;
	questions: string;
	users?: string;
	isAnonymous?: boolean;
}

export interface StandupStartOptions {
	users?: string;
}

// ── Not-Found Enrichment ──────────────────────────────────────────────

/**
 * Wrap a handler's async work to enrich 404 errors with suggestions.
 * Creates the HttpClient once and passes it to the handler callback,
 * so the suggestion fetch reuses the same authenticated client.
 */
async function enrichNotFound(
	fn: (client: HttpClient) => Promise<void>,
	globalOpts: GlobalOptions,
	resourceType: "standup",
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);
	try {
		await fn(client);
	} catch (error) {
		if (error instanceof CliError && error.code === "not_found") {
			// Don't enrich user-not-member errors with standup-ID suggestions
			const isUserNotMember = /user is not member/i.test(error.message);
			if (isUserNotMember) {
				throw new CliError(
					error.message,
					error.code,
					error.exitCode,
					error.retryable,
					"The specified user is not a member of this standup. Check members with: geekbot standup get <id>",
					error.context,
				);
			}
			const suggestion = await buildNotFoundSuggestion(client, resourceType);
			if (suggestion) {
				throw new CliError(
					error.message,
					error.code,
					error.exitCode,
					error.retryable,
					suggestion,
					error.context,
				);
			}
		}
		throw error;
	}
}

// ── Handlers ──────────────────────────────────────────────────────────

/**
 * Handle `geekbot standup list` command.
 * Fetches standups from GET /v2/standups (cursor-paginated, single page per call).
 */
export async function handleStandupList(
	options: StandupListOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	const params = buildV2ListParams({
		state: options.state,
		is_anonymous: options.isAnonymous,
		broadcast_channel: options.broadcastChannel,
		created_since: options.createdSince
			? parseV2DateFilter(options.createdSince, "--created-since")
			: undefined,
		created_until: options.createdUntil
			? parseV2DateFilter(options.createdUntil, "--created-until")
			: undefined,
		cursor: options.cursor,
		limit: options.pageSize ? String(validateLimit(options.pageSize)) : undefined,
		include: options.include,
	});

	const raw = await client.get<unknown>("/v2/standups", params);
	const parsed = V2StandupListResponseSchema.parse(raw);

	writeOutput(
		successList(parsed.data, {
			next_cursor: parsed.next_cursor,
			has_more: parsed.has_more,
		}),
	);
}

export interface StandupParticipationOptions {
	since?: string;
	until?: string;
	cursor?: string;
	pageSize?: string;
}

/**
 * Handle `geekbot standup participation` command.
 * Fetches per-occurrence participation from GET /v2/standups/<id>/participation
 * (cursor-paginated, single page per call).
 */
export async function handleStandupParticipation(
	id: string,
	options: StandupParticipationOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "standup ID");
	const client = await createAuthenticatedClient(globalOpts);

	const params = buildV2ListParams({
		since: options.since ? parseV2DateFilter(options.since, "--since") : undefined,
		until: options.until ? parseV2DateFilter(options.until, "--until") : undefined,
		cursor: options.cursor,
		limit: options.pageSize ? String(validateLimit(options.pageSize)) : undefined,
	});

	const raw = await client.get<unknown>(`/v2/standups/${numericId}/participation`, params);
	const parsed = V2StandupParticipationResponseSchema.parse(raw);

	writeOutput(
		successList(parsed.data, {
			next_cursor: parsed.next_cursor,
			has_more: parsed.has_more,
		}),
	);
}

/**
 * Handle `geekbot standup get` command.
 * Fetches a single standup by ID from GET /v2/standups/<id>.
 */
export async function handleStandupGet(
	id: string,
	options: { include?: string },
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "standup ID");
	await enrichNotFound(
		async (client) => {
			const params = buildV2ListParams({ include: options.include });
			const raw = await client.get<unknown>(`/v2/standups/${numericId}`, params);
			const parsed = V2StandupItemResponseSchema.parse(raw);
			writeOutput(success(parsed.data));
		},
		globalOpts,
		"standup",
	);
}

function buildV2ListParams(
	input: Record<string, string | undefined>,
): Record<string, string> | undefined {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(input)) {
		if (v !== undefined && v !== "") {
			out[k] = v;
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Handle `geekbot standup create` command.
 * Creates a standup via POST /v2/standups with an auto-generated Idempotency-Key.
 */
export async function handleStandupCreate(
	options: StandupCreateOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	const time = options.time ?? "10:00";
	const days = options.days ?? "Mon,Tue,Wed,Thu,Fri";

	validateTimeFormat(time);
	const daysList = validateDayAbbreviations(days.split(","));

	const body: Record<string, unknown> = {
		broadcast_channel: options.channel,
		time: `${time}:00`,
		days: daysList,
		questions: parseQuestionsInputV2(options.questions),
	};

	if (options.name !== undefined) {
		body.name = options.name;
	}

	if (options.timezone !== undefined) {
		body.timezone = options.timezone;
	}

	if (options.users !== undefined) {
		body.users = validateSlackIdList(options.users, "user ID");
	} else if (options.syncChannel !== undefined) {
		body.sync_channel = options.syncChannel;
	}

	if (options.isAnonymous === true) {
		body.is_anonymous = true;
	}

	const raw = await client.post<unknown>("/v2/standups", body, idempotencyHeader());
	const parsed = V2StandupItemResponseSchema.parse(raw);
	const receipt = buildReceipt("created", null);

	writeOutput(success(parsed.data, receipt));
}

/**
 * Handle `geekbot standup start` command.
 * Pre-fetches standup (v2) for response data, then sends POST to /v1/standups/<id>/start.
 * The v1 POST endpoint is the only v1 call we still make; its response is the bare
 * string "ok" and is not parsed.
 */
export async function handleStandupStart(
	id: string,
	options: StandupStartOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "standup ID");
	await enrichNotFound(
		async (client) => {
			// Pre-fetch standup (v2) for response data
			const prevRaw = await client.get<unknown>(`/v2/standups/${numericId}`);
			const parsed = V2StandupItemResponseSchema.parse(prevRaw);

			// Build body
			const body: Record<string, unknown> = {};
			if (options.users !== undefined) {
				body.users = validateSlackIdList(options.users, "user ID");
			}

			// POST /start -- v1 endpoint, response is "ok" string, not a standup object
			await client.post<unknown>(`/v1/standups/${numericId}/start`, body);

			const receipt = buildReceipt("started", null);

			writeOutput(success(parsed.data, receipt));
		},
		globalOpts,
		"standup",
	);
}

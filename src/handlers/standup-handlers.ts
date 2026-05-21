import type { GlobalOptions } from "../cli/globals.ts";
import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { buildNotFoundSuggestion } from "../errors/not-found-helper.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import type { HttpClient } from "../http/client.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import type { Standup } from "../schemas/standup.ts";
import { StandupSchema } from "../schemas/standup.ts";
import { V2StandupItemResponseSchema, V2StandupListResponseSchema } from "../schemas/v2-standup.ts";
import { parseQuestionsInput, parseV2DateFilter } from "../utils/input-parsers.ts";
import {
	buildDeleteUndoCommand,
	buildReceipt,
	buildUpdateUndoCommand,
	shellEscape,
} from "../utils/receipt.ts";
import {
	validateDayAbbreviations,
	validateLimit,
	validateNumericId,
	validateSlackIdList,
	validateTimeFormat,
	validateWaitTime,
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
	name?: string;
}

export interface StandupCreateOptions {
	name: string;
	channel: string;
	time?: string;
	timezone?: string;
	days?: string;
	questions: string;
	users?: string;
	waitTime?: string;
}

export interface StandupUpdateOptions {
	name?: string;
	channel?: string;
	time?: string;
	timezone?: string;
	days?: string;
	questions?: string;
	users?: string;
	waitTime?: string;
}

export interface StandupReplaceOptions {
	name: string;
	channel: string;
	time?: string;
	timezone?: string;
	days?: string;
	questions?: string;
	users?: string;
	waitTime?: string;
}

export interface StandupDeleteOptions {
	yes?: boolean;
}

export interface StandupDuplicateOptions {
	name: string;
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
	let data = parsed.data;

	if (options.name) {
		const needle = options.name.toLowerCase();
		data = data.filter((s) => s.name.toLowerCase().includes(needle));
	}

	writeOutput(
		successList(data, {
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
 * Creates a standup via POST /v1/standups.
 */
export async function handleStandupCreate(
	options: StandupCreateOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	// Apply sensible defaults for API-required fields
	const time = options.time ?? "10:00";
	const days = options.days ?? "Mon,Tue,Wed,Thu,Fri";

	validateTimeFormat(time);
	const daysList = validateDayAbbreviations(days.split(","));

	const body: Record<string, unknown> = {
		name: options.name,
		channel: options.channel,
		time: `${time}:00`,
		days: daysList,
		questions: parseQuestionsInput(options.questions),
	};

	if (options.timezone !== undefined) {
		body.timezone = options.timezone;
	}

	if (options.users !== undefined) {
		body.users = validateSlackIdList(options.users, "user ID");
		body.sync_channel_members = false;
	} else {
		body.sync_channel_members = true;
	}

	if (options.waitTime !== undefined) {
		body.wait_time = validateWaitTime(options.waitTime);
	}

	const raw = await client.post<unknown>("/v1/standups", body);
	const standup = StandupSchema.parse(raw);
	const receipt = buildReceipt("created", `geekbot standup delete ${standup.id} --yes`);

	writeOutput(success(standup, receipt));
}

/**
 * Handle `geekbot standup update` command.
 * Pre-fetches current state, sends PATCH with changed fields,
 * returns receipt with undo restoring previous values.
 */
export async function handleStandupUpdate(
	id: string,
	options: StandupUpdateOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "standup ID");

	// Early exit: no options means nothing to update
	const hasUpdates =
		options.name !== undefined ||
		options.channel !== undefined ||
		options.time !== undefined ||
		options.timezone !== undefined ||
		options.days !== undefined ||
		options.questions !== undefined ||
		options.users !== undefined ||
		options.waitTime !== undefined;

	if (!hasUpdates) {
		throw new CliError(
			"No update options provided",
			"validation_error",
			ExitCode.VALIDATION,
			false,
			"Specify at least one option to update (e.g., --name, --channel, --time, --users)",
		);
	}

	await enrichNotFound(
		async (client) => {
			// Pre-fetch current state for undo
			const prevRaw = await client.get<unknown>(`/v1/standups/${numericId}`);
			const previousStandup = StandupSchema.parse(prevRaw);

			// Build body from non-undefined options
			const body: Record<string, unknown> = {};

			if (options.name !== undefined) {
				body.name = options.name;
			}

			if (options.channel !== undefined) {
				body.channel = options.channel;
			}

			if (options.time !== undefined) {
				validateTimeFormat(options.time);
				body.time = `${options.time}:00`;
			}

			if (options.timezone !== undefined) {
				body.timezone = options.timezone;
			}

			if (options.days !== undefined) {
				body.days = validateDayAbbreviations(options.days.split(","));
			}

			if (options.questions !== undefined) {
				body.questions = parseQuestionsInput(options.questions);
			}

			if (options.users !== undefined) {
				body.users = validateSlackIdList(options.users, "user ID");
				body.sync_channel_members = false;
			}

			if (options.waitTime !== undefined) {
				body.wait_time = validateWaitTime(options.waitTime);
			}

			const raw = await client.patch<unknown>(`/v1/standups/${numericId}`, body);
			const standup = StandupSchema.parse(raw);

			const undo = buildUpdateUndoCommand(numericId, previousStandup, body);
			const receipt = buildReceipt("updated", undo);

			writeOutput(success(standup, receipt));
		},
		globalOpts,
		"standup",
	);
}

/**
 * Handle `geekbot standup replace` command.
 * Pre-fetches current state, sends PUT with full body,
 * returns receipt with undo=replace restoring all previous fields.
 */
export async function handleStandupReplace(
	id: string,
	options: StandupReplaceOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "standup ID");
	await enrichNotFound(
		async (client) => {
			// Pre-fetch current state for undo
			const prevRaw = await client.get<unknown>(`/v1/standups/${numericId}`);
			const previousStandup = StandupSchema.parse(prevRaw);

			// Build full body — PUT requires complete representation
			// Carry forward from previous standup when flags are omitted
			const time = options.time ?? previousStandup.time.slice(0, 5);
			validateTimeFormat(time);
			const days = options.days
				? validateDayAbbreviations(options.days.split(","))
				: previousStandup.days;

			const body: Record<string, unknown> = {
				name: options.name,
				channel: options.channel,
				time: `${time}:00`,
				days,
			};

			body.timezone = options.timezone ?? previousStandup.timezone;

			// questions: use provided or carry forward from existing standup
			if (options.questions !== undefined) {
				body.questions = parseQuestionsInput(options.questions);
			} else {
				body.questions = previousStandup.questions;
			}

			if (options.users !== undefined) {
				body.users = validateSlackIdList(options.users, "user ID");
				body.sync_channel_members = false;
			} else {
				body.users = previousStandup.users.map((u) => u.id);
				body.sync_channel_members = previousStandup.sync_channel_members ?? false;
			}

			if (options.waitTime !== undefined) {
				body.wait_time = validateWaitTime(options.waitTime);
			} else {
				body.wait_time = previousStandup.wait_time;
			}

			const raw = await client.put<unknown>(`/v1/standups/${numericId}`, body);
			const standup = StandupSchema.parse(raw);

			// Build undo as replace with all previous fields
			const undo = buildReplaceUndoCommand(numericId, previousStandup);
			const receipt = buildReceipt("updated", undo);

			writeOutput(success(standup, receipt));
		},
		globalOpts,
		"standup",
	);
}

/**
 * Handle `geekbot standup delete` command.
 * Requires --yes flag for confirmation. Pre-fetches standup for receipt.
 */
export async function handleStandupDelete(
	id: string,
	options: StandupDeleteOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "standup ID");

	if (!options.yes) {
		throw new CliError(
			`Delete standup ${numericId}? Add --yes to confirm.`,
			"confirmation_required",
			ExitCode.VALIDATION,
			false,
			`Run: geekbot standup delete ${numericId} --yes`,
		);
	}

	await enrichNotFound(
		async (client) => {
			// Pre-fetch for undo receipt
			const prevRaw = await client.get<unknown>(`/v1/standups/${numericId}`);
			const standup = StandupSchema.parse(prevRaw);

			await client.delete(`/v1/standups/${numericId}`);

			const undo = buildDeleteUndoCommand(standup);
			const receipt = buildReceipt("deleted", undo);

			writeOutput(success(standup, receipt));
		},
		globalOpts,
		"standup",
	);
}

/**
 * Handle `geekbot standup duplicate` command.
 * Sends POST to /v1/standups/<id>/duplicate.
 */
export async function handleStandupDuplicate(
	id: string,
	options: StandupDuplicateOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "standup ID");
	await enrichNotFound(
		async (client) => {
			const raw = await client.post<unknown>(`/v1/standups/${numericId}/duplicate`, {
				name: options.name,
			});
			const newStandup = StandupSchema.parse(raw);

			const receipt = buildReceipt("duplicated", `geekbot standup delete ${newStandup.id} --yes`);

			writeOutput(success(newStandup, receipt));
		},
		globalOpts,
		"standup",
	);
}

/**
 * Handle `geekbot standup start` command.
 * Pre-fetches standup for receipt data, sends POST to /v1/standups/<id>/start.
 * POST response is not parsed (returns bare "ok" string).
 */
export async function handleStandupStart(
	id: string,
	options: StandupStartOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "standup ID");
	await enrichNotFound(
		async (client) => {
			// Pre-fetch standup for receipt data
			const prevRaw = await client.get<unknown>(`/v1/standups/${numericId}`);
			const standup = StandupSchema.parse(prevRaw);

			// Build body
			const body: Record<string, unknown> = {};
			if (options.users !== undefined) {
				body.users = validateSlackIdList(options.users, "user ID");
			}

			// POST /start -- response is "ok" string, not a standup object
			await client.post<unknown>(`/v1/standups/${numericId}/start`, body);

			const receipt = buildReceipt("started", null);

			writeOutput(success(standup, receipt));
		},
		globalOpts,
		"standup",
	);
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Build an undo command for replace that restores ALL previous fields.
 */
function buildReplaceUndoCommand(id: number, prev: Standup): string {
	const parts: string[] = [`geekbot standup replace ${id}`];

	parts.push(`--name ${shellEscape(prev.name)}`);
	parts.push(`--channel ${shellEscape(prev.channel ?? "")}`);

	if (prev.time) {
		parts.push(`--time ${shellEscape(prev.time.slice(0, 5))}`);
	}

	if (prev.timezone) {
		parts.push(`--timezone ${shellEscape(prev.timezone)}`);
	}

	if (prev.days.length > 0) {
		parts.push(`--days ${shellEscape(prev.days.join(","))}`);
	}

	if (prev.wait_time !== 0) {
		parts.push(`--wait-time ${prev.wait_time}`);
	}

	if (prev.users.length > 0) {
		parts.push(`--users ${prev.users.map((u) => u.id).join(",")}`);
	}

	if (prev.questions.length > 0) {
		parts.push(`--questions ${shellEscape(JSON.stringify(prev.questions.map((q) => q.text)))}`);
	}

	return parts.join(" ");
}

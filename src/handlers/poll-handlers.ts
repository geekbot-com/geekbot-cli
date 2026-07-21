import type { GlobalOptions } from "../cli/globals.ts";
import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { buildNotFoundSuggestion } from "../errors/not-found-helper.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import type { HttpClient } from "../http/client.ts";
import { idempotencyHeader } from "../http/idempotency.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import {
	V2PollItemResponseSchema,
	V2PollListResponseSchema,
	V2PollParticipationResponseSchema,
	V2PollVotesResponseSchema,
} from "../schemas/v2-poll.ts";
import { parseChoicesInput, parseV2DateFilter } from "../utils/input-parsers.ts";
import { buildReceipt } from "../utils/receipt.ts";
import { validateLimit, validateNumericId } from "../utils/validation.ts";

// ── Option Interfaces ─────────────────────────────────────────────────

export interface PollListOptions {
	state?: string;
	isAnonymous?: string;
	broadcastChannel?: string;
	createdSince?: string;
	createdUntil?: string;
	cursor?: string;
	pageSize?: string;
	include?: string;
}

export interface PollGetOptions {
	include?: string;
}

export interface PollCreateOptions {
	name: string;
	channel: string;
	question: string;
	choices: string;
	duration?: string;
}

export interface PollVotesOptions {
	after?: string;
	before?: string;
}

export interface PollParticipationOptions {
	since?: string;
	until?: string;
	cursor?: string;
	pageSize?: string;
}

// ── Platform Error Helper ─────────────────────────────────────────────

/**
 * Wrap an async handler call to detect non-Slack team 404 errors on poll endpoints.
 * The Geekbot API returns 404 for teams that don't support polls (non-Slack).
 *
 * Layering: handlers that target specific poll IDs nest enrichPollNotFound INSIDE
 * this wrapper. enrichPollNotFound converts specific poll 404s to code "poll_not_found",
 * which passes through the "not_found" check below unchanged. If enrichment returns null,
 * the original "not_found" error propagates here and is caught as "platform_not_supported".
 */
async function wrapPlatformError(fn: () => Promise<void>): Promise<void> {
	try {
		await fn();
	} catch (error) {
		if (
			error instanceof CliError &&
			error.code === "not_found" &&
			error.context?.path &&
			/^\/v[12]\/polls/.test(String(error.context.path))
		) {
			throw new CliError(
				"Polls are only available for Slack teams. Your team appears to use a different platform.",
				"platform_not_supported",
				ExitCode.VALIDATION,
				false,
				"Polls require a Slack workspace. Check your team settings at geekbot.com.",
			);
		}
		throw error;
	}
}

// ── Not-Found Enrichment ──────────────────────────────────────────────

/**
 * Wrap a poll handler's async work to enrich 404 errors with suggestions.
 * Creates the HttpClient once and passes it to the handler callback.
 * Placed inside wrapPlatformError so platform error detection takes priority.
 */
async function enrichPollNotFound(
	fn: (client: HttpClient) => Promise<void>,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);
	try {
		await fn(client);
	} catch (error) {
		if (error instanceof CliError && error.code === "not_found") {
			const suggestion = await buildNotFoundSuggestion(client, "poll");
			if (suggestion) {
				throw new CliError(
					error.message,
					"poll_not_found",
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

function buildParams(
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

// ── Handlers ──────────────────────────────────────────────────────────

/**
 * Handle `geekbot poll list` command.
 * Fetches polls from GET /v2/polls (cursor-paginated, single page per call).
 */
export async function handlePollList(
	options: PollListOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	await wrapPlatformError(async () => {
		const client = await createAuthenticatedClient(globalOpts);

		const params = buildParams({
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

		const raw = await client.get<unknown>("/v2/polls", params);
		const parsed = V2PollListResponseSchema.parse(raw);

		writeOutput(
			successList(parsed.data, {
				next_cursor: parsed.next_cursor,
				has_more: parsed.has_more,
			}),
		);
	});
}

/**
 * Handle `geekbot poll get` command.
 * Fetches a single poll by ID from GET /v2/polls/<id>.
 */
export async function handlePollGet(
	id: string,
	options: PollGetOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "poll ID");

	await wrapPlatformError(async () => {
		await enrichPollNotFound(async (client) => {
			const params = buildParams({ include: options.include });
			const raw = await client.get<unknown>(`/v2/polls/${numericId}`, params);
			const parsed = V2PollItemResponseSchema.parse(raw);
			writeOutput(success(parsed.data));
		}, globalOpts);
	});
}

/**
 * Handle `geekbot poll create` command.
 * Creates a poll via POST /v2/polls with an auto-generated Idempotency-Key.
 */
export async function handlePollCreate(
	options: PollCreateOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	await wrapPlatformError(async () => {
		const client = await createAuthenticatedClient(globalOpts);

		const choices = parseChoicesInput(options.choices);

		const body: Record<string, unknown> = {
			name: options.name,
			broadcast_channel: options.channel,
			question: options.question,
			choices,
		};

		if (options.duration !== undefined) {
			const minutes = Number(options.duration);
			if (!Number.isInteger(minutes) || minutes <= 0) {
				throw new CliError(
					`Invalid value for --duration: "${options.duration}".`,
					"validation_error",
					ExitCode.VALIDATION,
					false,
					"Pass a positive integer (minutes the poll stays open).",
				);
			}
			body.duration = minutes;
		}

		const raw = await client.post<unknown>("/v2/polls", body, idempotencyHeader());
		const parsed = V2PollItemResponseSchema.parse(raw);
		const receipt = buildReceipt("created", null);

		writeOutput(success(parsed.data, receipt));
	});
}

/**
 * Handle `geekbot poll votes` command.
 * Fetches voting results from GET /v2/polls/<id>/votes.
 * Maps CLI --after/--before to v2 since/until params.
 */
export async function handlePollVotes(
	id: string,
	options: PollVotesOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "poll ID");

	await wrapPlatformError(async () => {
		await enrichPollNotFound(async (client) => {
			const params = buildParams({
				since: options.after ? parseV2DateFilter(options.after, "--after") : undefined,
				until: options.before ? parseV2DateFilter(options.before, "--before") : undefined,
			});

			const raw = await client.get<unknown>(`/v2/polls/${numericId}/votes`, params);
			const parsed = V2PollVotesResponseSchema.parse(raw);

			writeOutput(success(parsed.data));
		}, globalOpts);
	});
}

/**
 * Handle `geekbot poll participation` command.
 * Fetches per-broadcast participation from GET /v2/polls/<id>/participation
 * (cursor-paginated, single page per call).
 */
export async function handlePollParticipation(
	id: string,
	options: PollParticipationOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "poll ID");

	await wrapPlatformError(async () => {
		await enrichPollNotFound(async (client) => {
			const params = buildParams({
				since: options.since ? parseV2DateFilter(options.since, "--since") : undefined,
				until: options.until ? parseV2DateFilter(options.until, "--until") : undefined,
				cursor: options.cursor,
				limit: options.pageSize ? String(validateLimit(options.pageSize)) : undefined,
			});

			const raw = await client.get<unknown>(`/v2/polls/${numericId}/participation`, params);
			const parsed = V2PollParticipationResponseSchema.parse(raw);

			writeOutput(
				successList(parsed.data, {
					next_cursor: parsed.next_cursor,
					has_more: parsed.has_more,
				}),
			);
		}, globalOpts);
	});
}

import type { GlobalOptions } from "../cli/globals.ts";
import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { buildNotFoundSuggestion } from "../errors/not-found-helper.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import type { HttpClient } from "../http/client.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import { PollListSchema, PollSchema, PollVotesResponseSchema } from "../schemas/poll.ts";
import { parseChoicesInput, parseDateFilter } from "../utils/input-parsers.ts";
import { buildReceipt } from "../utils/receipt.ts";
import { validateNumericId } from "../utils/validation.ts";

// ── Option Interfaces ─────────────────────────────────────────────────

export interface PollCreateOptions {
	name: string;
	channel: string;
	question: string;
	choices: string;
}

export interface PollVotesOptions {
	after?: string;
	before?: string;
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
		// Only intercept errors with code "not_found" — enriched "poll_not_found"
		// errors from enrichPollNotFound pass through without being re-mapped.
		if (
			error instanceof CliError &&
			error.code === "not_found" &&
			error.context?.path &&
			String(error.context.path).startsWith("/v1/polls")
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

// ── Handlers ──────────────────────────────────────────────────────────

/**
 * Handle `geekbot poll list` command.
 * Fetches polls from GET /v1/polls.
 */
export async function handlePollList(globalOpts: GlobalOptions): Promise<void> {
	await wrapPlatformError(async () => {
		const client = await createAuthenticatedClient(globalOpts);

		const raw = await client.get<unknown>("/v1/polls");
		const polls = PollListSchema.parse(raw);

		writeOutput(successList(polls));
	});
}

/**
 * Handle `geekbot poll get` command.
 * Fetches a single poll by ID from GET /v1/polls/<id>.
 */
export async function handlePollGet(id: string, globalOpts: GlobalOptions): Promise<void> {
	const numericId = validateNumericId(id, "poll ID");

	await wrapPlatformError(async () => {
		await enrichPollNotFound(async (client) => {
			const raw = await client.get<unknown>(`/v1/polls/${numericId}`);
			const poll = PollSchema.parse(raw);
			writeOutput(success(poll));
		}, globalOpts);
	});
}

/**
 * Handle `geekbot poll create` command.
 * Creates a poll via POST /v1/polls.
 */
export async function handlePollCreate(
	options: PollCreateOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	await wrapPlatformError(async () => {
		const client = await createAuthenticatedClient(globalOpts);

		const choices = parseChoicesInput(options.choices);

		const body = {
			name: options.name,
			channel: options.channel,
			question: options.question,
			choices,
		};

		const raw = await client.post<unknown>("/v1/polls", body);
		const poll = PollSchema.parse(raw);
		const receipt = buildReceipt("created", null);

		writeOutput(success(poll, receipt));
	});
}

/**
 * Handle `geekbot poll votes` command.
 * Fetches voting results from GET /v1/polls/<id>/votes.
 * Maps CLI --after/--before to API from/to params.
 */
export async function handlePollVotes(
	id: string,
	options: PollVotesOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "poll ID");

	await wrapPlatformError(async () => {
		await enrichPollNotFound(async (client) => {
			const params: Record<string, string> = {};
			if (options.after) {
				params.from = parseDateFilter(options.after, "--after");
			}
			if (options.before) {
				params.to = parseDateFilter(options.before, "--before");
			}

			const raw = await client.get<unknown>(
				`/v1/polls/${numericId}/votes`,
				Object.keys(params).length > 0 ? params : undefined,
			);
			const votesResponse = PollVotesResponseSchema.parse(raw);

			writeOutput(success(votesResponse));
		}, globalOpts);
	});
}

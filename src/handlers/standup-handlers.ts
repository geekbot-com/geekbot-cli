import type { GlobalOptions } from "../cli/globals.ts";
import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { buildNotFoundSuggestion } from "../errors/not-found-helper.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import type { HttpClient } from "../http/client.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import type { Standup } from "../schemas/standup.ts";
import { StandupListSchema, StandupSchema } from "../schemas/standup.ts";
import { MeResponseSchema } from "../schemas/user.ts";
import { parseQuestionsInput } from "../utils/input-parsers.ts";
import {
	buildDeleteUndoCommand,
	buildReceipt,
	buildUpdateUndoCommand,
	shellEscape,
} from "../utils/receipt.ts";
import {
	validateDayAbbreviations,
	validateNumericId,
	validateSlackIdList,
	validateTimeFormat,
	validateWaitTime,
} from "../utils/validation.ts";

// ── Option Interfaces ─────────────────────────────────────────────────

export interface StandupListOptions {
	admin?: boolean;
	brief?: boolean;
	name?: string;
	channel?: string;
	mine?: boolean;
	member?: string;
	limit?: string;
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

/** Brief standup projection — only essential fields for discovery */
export interface StandupBrief {
	id: number;
	name: string;
	channel: string;
}

/**
 * Handle `geekbot standup list` command.
 * Fetches standups from GET /v1/standups with optional filters and projection.
 */
export async function handleStandupList(
	options: StandupListOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	const params: Record<string, string> | undefined = options.admin ? { admin: "true" } : undefined;

	const raw = await client.get<unknown>("/v1/standups", params);
	let standups = StandupListSchema.parse(raw);

	// Client-side filters
	if (options.name) {
		const needle = options.name.toLowerCase();
		standups = standups.filter((s) => s.name.toLowerCase().includes(needle));
	}

	if (options.channel) {
		const needle = options.channel.toLowerCase();
		standups = standups.filter((s) => s.channel.toLowerCase().includes(needle));
	}

	if (options.mine) {
		const meRaw = await client.get<unknown>("/v1/me");
		const me = MeResponseSchema.parse(meRaw);
		const myId = me.user.id;
		standups = standups.filter((s) => s.users.some((u) => u.id === myId));
	}

	if (options.member) {
		standups = standups.filter((s) => s.users.some((u) => u.id === options.member));
	}

	// Limit — cap results after all filters
	if (options.limit) {
		const limitNum = Number.parseInt(options.limit, 10);
		if (Number.isNaN(limitNum) || limitNum < 1) {
			throw new CliError(
				`Invalid limit: "${options.limit}" — must be a positive integer`,
				"validation_error",
				ExitCode.VALIDATION,
				false,
				"Example: --limit 10",
			);
		}
		standups = standups.slice(0, limitNum);
	}

	// Brief projection — only id, name, channel for fast discovery
	if (options.brief) {
		const brief: StandupBrief[] = standups.map((s) => ({
			id: s.id,
			name: s.name,
			channel: s.channel,
		}));
		writeOutput(successList(brief));
		return;
	}

	writeOutput(successList(standups));
}

/**
 * Handle `geekbot standup get` command.
 * Fetches a single standup by ID from GET /v1/standups/<id>.
 */
export async function handleStandupGet(id: string, globalOpts: GlobalOptions): Promise<void> {
	const numericId = validateNumericId(id, "standup ID");
	await enrichNotFound(
		async (client) => {
			const raw = await client.get<unknown>(`/v1/standups/${numericId}`);
			const standup = StandupSchema.parse(raw);
			writeOutput(success(standup));
		},
		globalOpts,
		"standup",
	);
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
	const daysList = days.split(",");
	validateDayAbbreviations(daysList);

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
				const days = options.days.split(",");
				validateDayAbbreviations(days);
				body.days = days;
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
			const time = options.time ?? "10:00";
			validateTimeFormat(time);
			const days = (options.days ?? "Mon,Tue,Wed,Thu,Fri").split(",");
			validateDayAbbreviations(days);

			const body: Record<string, unknown> = {
				name: options.name,
				channel: options.channel,
				time: `${time}:00`,
				days,
			};

			if (options.timezone !== undefined) {
				body.timezone = options.timezone;
			}

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
				body.sync_channel_members = true;
			}

			if (options.waitTime !== undefined) {
				body.wait_time = validateWaitTime(options.waitTime);
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
	parts.push(`--channel ${shellEscape(prev.channel)}`);

	if (prev.time) {
		parts.push(`--time ${shellEscape(prev.time.slice(0, 5))}`);
	}

	if (prev.timezone) {
		parts.push(`--timezone ${shellEscape(prev.timezone)}`);
	}

	if (prev.days.length > 0) {
		parts.push(`--days ${shellEscape(prev.days.join(","))}`);
	}

	if (prev.wait_time > 0) {
		parts.push(`--wait-time ${prev.wait_time}`);
	}

	if (prev.questions.length > 0) {
		parts.push(`--questions ${shellEscape(JSON.stringify(prev.questions.map((q) => q.text)))}`);
	}

	return parts.join(" ");
}

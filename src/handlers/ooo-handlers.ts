import type { GlobalOptions } from "../cli/globals.ts";
import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import { idempotencyHeader } from "../http/idempotency.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import { V2OooItemResponseSchema, V2OooListResponseSchema } from "../schemas/v2-ooo.ts";
import { parseDateFilter } from "../utils/input-parsers.ts";
import { buildReceipt } from "../utils/receipt.ts";
import { validateLimit, validateNumericId, validateSlackId } from "../utils/validation.ts";

// ── Option Interfaces ─────────────────────────────────────────────────

export interface OooListOptions {
	user?: string;
	cursor?: string;
	pageSize?: string;
}

export interface OooGetOptions {
	user?: string;
}

export interface OooCreateOptions {
	startDate: string;
	endDate: string;
	user?: string;
}

export interface OooEditOptions {
	startDate?: string;
	endDate?: string;
	user?: string;
}

export interface OooDeleteOptions {
	user?: string;
	yes?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Validate an out-of-office date flag (strict YYYY-MM-DD, real calendar date).
 * Returns the input unchanged so it can be sent to the API as-is.
 */
function validateOooDate(raw: string, flag: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		throw new CliError(
			`Invalid date for ${flag}: "${raw}".`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			`Use YYYY-MM-DD, e.g.: ${flag} "2026-08-01"`,
		);
	}
	// Reuse parseDateFilter's calendar validation (rejects e.g. 2026-02-31);
	// discard its unix-timestamp output.
	parseDateFilter(raw, flag);
	return raw;
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
 * Handle `geekbot ooo list` command.
 * Fetches out-of-office periods from GET /v2/ooo (cursor-paginated, single
 * page per call). Only current and upcoming periods are returned by the API.
 */
export async function handleOooList(
	options: OooListOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	const params = buildParams({
		user_id: options.user ? validateSlackId(options.user, "user ID") : undefined,
		cursor: options.cursor,
		limit: options.pageSize ? String(validateLimit(options.pageSize)) : undefined,
	});

	const raw = await client.get<unknown>("/v2/ooo", params);
	const parsed = V2OooListResponseSchema.parse(raw);

	writeOutput(
		successList(parsed.data, {
			next_cursor: parsed.next_cursor,
			has_more: parsed.has_more,
		}),
	);
}

/**
 * Handle `geekbot ooo get` command.
 * Fetches a single out-of-office period via GET /v2/ooo/{id}.
 */
export async function handleOooGet(
	id: string,
	options: OooGetOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);
	const numericId = validateNumericId(id, "OOO period ID");

	const params = buildParams({
		user_id: options.user ? validateSlackId(options.user, "user ID") : undefined,
	});

	const raw = await client.get<unknown>(`/v2/ooo/${numericId}`, params);
	const parsed = V2OooItemResponseSchema.parse(raw);
	writeOutput(success(parsed.data));
}

/**
 * Handle `geekbot ooo create` command.
 * Creates an out-of-office period via POST /v2/ooo with an auto-generated
 * Idempotency-Key.
 */
export async function handleOooCreate(
	options: OooCreateOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	const body: Record<string, unknown> = {
		start_date: validateOooDate(options.startDate, "--start-date"),
		end_date: validateOooDate(options.endDate, "--end-date"),
	};

	if (options.user !== undefined) {
		body.user_id = validateSlackId(options.user, "user ID");
	}

	const raw = await client.post<unknown>("/v2/ooo", body, idempotencyHeader());
	const parsed = V2OooItemResponseSchema.parse(raw);
	const undoUser = options.user !== undefined ? ` --user ${options.user}` : "";
	const receipt = buildReceipt("created", `geekbot ooo delete ${parsed.data.id}${undoUser} --yes`);

	writeOutput(success(parsed.data, receipt));
}

/**
 * Handle `geekbot ooo edit` command.
 * Updates an out-of-office period via PATCH /v2/ooo/{id}. At least one of
 * the two date flags is required.
 */
export async function handleOooEdit(
	id: string,
	options: OooEditOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "OOO period ID");

	if (options.startDate === undefined && options.endDate === undefined) {
		throw new CliError(
			"At least one of --start-date or --end-date is required.",
			"validation_error",
			ExitCode.VALIDATION,
			false,
			'Example: geekbot ooo edit 12 --end-date "2026-08-15"',
		);
	}

	const client = await createAuthenticatedClient(globalOpts);

	const body: Record<string, unknown> = {};
	if (options.startDate !== undefined) {
		body.start_date = validateOooDate(options.startDate, "--start-date");
	}
	if (options.endDate !== undefined) {
		body.end_date = validateOooDate(options.endDate, "--end-date");
	}
	if (options.user !== undefined) {
		body.user_id = validateSlackId(options.user, "user ID");
	}

	const raw = await client.patch<unknown>(`/v2/ooo/${numericId}`, body, idempotencyHeader());
	const parsed = V2OooItemResponseSchema.parse(raw);
	const receipt = buildReceipt("updated", null);

	writeOutput(success(parsed.data, receipt));
}

/**
 * Handle `geekbot ooo delete` command.
 * Deletes an out-of-office period via DELETE /v2/ooo/{id}. Requires `--yes`
 * confirmation. The optional `user_id` query param is appended to the path
 * because HttpClient.delete does not accept query params.
 */
export async function handleOooDelete(
	id: string,
	options: OooDeleteOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "OOO period ID");

	if (!options.yes) {
		throw new CliError(
			"Refusing to delete without confirmation.",
			"validation_error",
			ExitCode.VALIDATION,
			false,
			"Pass --yes to confirm the deletion.",
		);
	}

	let path = `/v2/ooo/${numericId}`;
	if (options.user !== undefined) {
		path += `?user_id=${validateSlackId(options.user, "user ID")}`;
	}

	const client = await createAuthenticatedClient(globalOpts);
	await client.delete(path, idempotencyHeader());
	const receipt = buildReceipt("deleted", null);
	writeOutput(success({ id: numericId }, receipt));
}

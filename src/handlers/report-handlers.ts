import type { GlobalOptions } from "../cli/globals.ts";
import { CliError } from "../errors/cli-error.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import { idempotencyHeader } from "../http/idempotency.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import { V2ReportItemResponseSchema, V2ReportListResponseSchema } from "../schemas/v2-report.ts";
import { parseAnswersInput, parseV2DateFilter } from "../utils/input-parsers.ts";
import { buildReceipt } from "../utils/receipt.ts";
import { validateLimit, validateNumericId, validateSlackId } from "../utils/validation.ts";

const VALID_VIEWS = ["summary", "full"] as const;
type ReportView = (typeof VALID_VIEWS)[number];

export interface ReportListOptions {
	standupId?: string;
	userId?: string;
	before?: string;
	after?: string;
	limit?: string;
	cursor?: string;
	pageSize?: string;
	view?: string;
}

export interface ReportCreateOptions {
	standupId: string;
	answers: string;
}

export interface ReportGetOptions {
	view?: string;
}

export interface ReportEditOptions {
	answers: string;
}

export interface ReportDeleteOptions {
	yes?: boolean;
}

function validateView(value: string | undefined, flag: string): ReportView | undefined {
	if (value === undefined) return undefined;
	if (!(VALID_VIEWS as readonly string[]).includes(value)) {
		throw new CliError(
			`Invalid value for ${flag}: "${value}".`,
			"validation_error",
			ExitCode.VALIDATION,
			false,
			`Accepted: ${VALID_VIEWS.join(", ")}`,
		);
	}
	return value as ReportView;
}

function answersBodyFromInput(raw: string): Array<{ question_id: number; text: string }> {
	const parsed = parseAnswersInput(raw);
	const out: Array<{ question_id: number; text: string }> = [];
	for (const [key, value] of Object.entries(parsed)) {
		const qid = Number(key);
		if (!Number.isInteger(qid) || qid <= 0) {
			throw new CliError(
				`Invalid question id "${key}" in --answers.`,
				"validation_error",
				ExitCode.VALIDATION,
				false,
				'Keys must be positive integers, e.g. \'{"101": "Done X"}\'.',
			);
		}
		out.push({ question_id: qid, text: value.text });
	}
	if (out.length === 0) {
		throw new CliError(
			"--answers must include at least one entry.",
			"validation_error",
			ExitCode.VALIDATION,
			false,
			'Example: --answers \'{"101": "Done X"}\'',
		);
	}
	return out;
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

/**
 * Handle `geekbot report list` command.
 * Fetches reports from GET /v2/reports (cursor-paginated, single page per call).
 * `--before`/`--after` map to v2 `until`/`since`.
 */
export async function handleReportList(
	options: ReportListOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	if (options.standupId) validateNumericId(options.standupId, "standup ID");
	if (options.userId) validateSlackId(options.userId, "user ID");

	// `--limit` and `--page-size` are aliases for v2 `limit` (server-side page cap, 1-100).
	const limitFlag = options.pageSize ?? options.limit;

	const params = buildParams({
		standup_id: options.standupId,
		user_id: options.userId,
		until: options.before ? parseV2DateFilter(options.before, "--before") : undefined,
		since: options.after ? parseV2DateFilter(options.after, "--after") : undefined,
		cursor: options.cursor,
		limit: limitFlag ? String(validateLimit(limitFlag)) : undefined,
		view: validateView(options.view, "--view"),
	});

	const raw = await client.get<unknown>("/v2/reports", params);
	const parsed = V2ReportListResponseSchema.parse(raw);

	writeOutput(
		successList(parsed.data, {
			next_cursor: parsed.next_cursor,
			has_more: parsed.has_more,
		}),
	);
}

/**
 * Handle `geekbot report create` command.
 * Submits a report via POST /v2/reports with an auto-generated Idempotency-Key.
 */
export async function handleReportCreate(
	options: ReportCreateOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	const numericStandupId = validateNumericId(options.standupId, "standup ID");
	const answers = answersBodyFromInput(options.answers);

	const body = {
		standup_id: numericStandupId,
		answers,
	};

	const raw = await client.post<unknown>("/v2/reports", body, idempotencyHeader());
	const parsed = V2ReportItemResponseSchema.parse(raw);
	const receipt = buildReceipt("created", `geekbot report delete ${parsed.data.id} --yes`);

	writeOutput(success(parsed.data, receipt));
}

/**
 * Handle `geekbot report get` command.
 * Fetches a single report via GET /v2/reports/{id}. Always returns the `full`
 * shape; `--view summary` is accepted for symmetry with `report list`.
 */
export async function handleReportGet(
	id: string,
	options: ReportGetOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);
	const numericId = validateNumericId(id, "report ID");

	// `view` is documented as list-only on the api side, but accept the flag
	// here so the CLI surface is uniform — pass it through; the api ignores
	// unknown query params on GET item.
	const params = buildParams({ view: validateView(options.view, "--view") });

	const raw = await client.get<unknown>(`/v2/reports/${numericId}`, params);
	const parsed = V2ReportItemResponseSchema.parse(raw);
	writeOutput(success(parsed.data));
}

/**
 * Handle `geekbot report edit` command.
 * Updates one or more answers on an existing report via PATCH /v2/reports/{id}.
 */
export async function handleReportEdit(
	id: string,
	options: ReportEditOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);
	const numericId = validateNumericId(id, "report ID");
	const answers = answersBodyFromInput(options.answers);

	const body = { answers };
	const raw = await client.patch<unknown>(`/v2/reports/${numericId}`, body, idempotencyHeader());
	const parsed = V2ReportItemResponseSchema.parse(raw);
	const receipt = buildReceipt("updated", null);

	writeOutput(success(parsed.data, receipt));
}

/**
 * Handle `geekbot report delete` command.
 * Deletes a report via DELETE /v2/reports/{id}. Requires `--yes` confirmation.
 */
export async function handleReportDelete(
	id: string,
	options: ReportDeleteOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const numericId = validateNumericId(id, "report ID");

	if (!options.yes) {
		throw new CliError(
			"Refusing to delete without confirmation.",
			"validation_error",
			ExitCode.VALIDATION,
			false,
			"Pass --yes to confirm the deletion.",
		);
	}

	const client = await createAuthenticatedClient(globalOpts);
	await client.delete(`/v2/reports/${numericId}`, idempotencyHeader());
	const receipt = buildReceipt("deleted", null);
	writeOutput(success({ id: numericId }, receipt));
}

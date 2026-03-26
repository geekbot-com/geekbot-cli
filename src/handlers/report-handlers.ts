import type { GlobalOptions } from "../cli/globals.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import { SubmittedReportSchema, TimelineReportListSchema } from "../schemas/report.ts";
import { parseAnswersInput, parseDateFilter } from "../utils/input-parsers.ts";
import { buildReceipt } from "../utils/receipt.ts";
import { validateLimit, validateNumericId, validateSlackId } from "../utils/validation.ts";

export interface ReportListOptions {
	standupId?: string;
	userId?: string;
	before?: string;
	after?: string;
	limit?: string;
}

export interface ReportCreateOptions {
	standupId: string;
	answers: string;
}

/**
 * Handle `geekbot report list` command.
 * Fetches reports from GET /v1/reports with optional query filters.
 */
export async function handleReportList(
	options: ReportListOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	const params: Record<string, string> = {};

	if (options.standupId) {
		validateNumericId(options.standupId, "standup ID");
		params.standup_id = options.standupId;
	}

	if (options.userId) {
		validateSlackId(options.userId, "user ID");
		params.user_id = options.userId;
	}

	if (options.before) {
		params.before = parseDateFilter(options.before, "--before");
	}

	if (options.after) {
		params.after = parseDateFilter(options.after, "--after");
	}

	if (options.limit) {
		const limitNum = validateLimit(options.limit);
		params.limit = String(limitNum);
	}

	const raw = await client.get<unknown>("/v1/reports", params);
	const reports = TimelineReportListSchema.parse(raw);

	writeOutput(successList(reports));
}

/**
 * Handle `geekbot report create` command.
 * Submits a report via POST /v1/reports with standup_id and normalized answers.
 */
export async function handleReportCreate(
	options: ReportCreateOptions,
	globalOpts: GlobalOptions,
): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);

	const numericStandupId = validateNumericId(options.standupId, "standup ID");
	const parsedAnswers = parseAnswersInput(options.answers);

	const body = {
		standup_id: numericStandupId,
		answers: parsedAnswers,
	};

	const raw = await client.post<unknown>("/v1/reports", body);
	const report = SubmittedReportSchema.parse(raw);
	const receipt = buildReceipt("created", null);

	writeOutput(success(report, receipt));
}

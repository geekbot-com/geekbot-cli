import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import {
	handleReportCreate,
	handleReportDelete,
	handleReportEdit,
	handleReportGet,
	handleReportList,
} from "../../handlers/report-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createReportCommand(): Command {
	const report = new Command("report").description("Manage reports");

	report
		.command("list")
		.description("List reports with optional filters (v2)")
		.option("--standup-id <id>", "Filter by standup ID")
		.option("--user-id <id>", "Filter by Slack user ID (e.g. U123)")
		.option(
			"--before <date>",
			"Reports before date (maps to v2 'until' — YYYY-MM-DD or unix timestamp)",
		)
		.option(
			"--after <date>",
			"Reports after date (maps to v2 'since' — YYYY-MM-DD or unix timestamp)",
		)
		.option("--limit <n>", "Page size (1-100, alias for --page-size)")
		.option("--page-size <n>", "Page size (1-100, default 25)")
		.option("--cursor <token>", "Opaque pagination cursor from a previous response")
		.option("--view <view>", "Response shape: summary (omits answers) or full (default)")
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot report list --standup-id 123\n  geekbot report list --view summary --page-size 100\n  geekbot report list --after 2026-01-01 --before 2026-02-01",
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleReportList(
					{
						standupId: opts.standupId,
						userId: opts.userId,
						before: opts.before,
						after: opts.after,
						limit: opts.limit,
						pageSize: opts.pageSize,
						cursor: opts.cursor,
						view: opts.view,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	report
		.command("create")
		.description("Submit a report for a standup (v2)")
		.requiredOption("--standup-id <id>", "Standup ID to report on")
		.requiredOption("--answers <json>", 'Answers as JSON object: {"question_id": "answer", ...}')
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot report create --standup-id 123 --answers \'{"101": "Done feature X", "102": "Working on Y"}\'',
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleReportCreate(
					{
						standupId: opts.standupId,
						answers: opts.answers,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	report
		.command("get")
		.description("Get a single report by ID (v2)")
		.argument("<id>", "Report ID (numeric)")
		.option("--view <view>", "Response shape: summary or full")
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot report get 456\n  geekbot report get 456 --view summary",
		)
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleReportGet(id, { view: opts.view }, globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	report
		.command("edit")
		.description("Update one or more answers on a report (v2)")
		.argument("<id>", "Report ID (numeric)")
		.requiredOption(
			"--answers <json>",
			'Answers to update as JSON object: {"question_id": "new answer"}',
		)
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot report edit 456 --answers \'{"101": "Corrected answer"}\'',
		)
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleReportEdit(id, { answers: opts.answers }, globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	report
		.command("delete")
		.description("Delete a report (v2)")
		.argument("<id>", "Report ID (numeric)")
		.option("--yes", "Confirm deletion (required)")
		.addHelpText("after", "\nExamples:\n  geekbot report delete 456 --yes")
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleReportDelete(id, { yes: opts.yes }, globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	return report;
}

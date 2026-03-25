import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import { handleReportCreate, handleReportList } from "../../handlers/report-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createReportCommand(): Command {
	const report = new Command("report").description("Manage reports");

	report
		.command("list")
		.description("List reports with optional filters")
		.option("--standup-id <id>", "Filter by standup ID")
		.option("--user-id <id>", "Filter by user ID")
		.option("--before <date>", "Reports before date (ISO 8601 or unix timestamp)")
		.option("--after <date>", "Reports after date (ISO 8601 or unix timestamp)")
		.option("--limit <n>", "Max number of reports to return")
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot report list --standup-id 123\n  geekbot report list --standup-id 123 --limit 10\n  geekbot report list --after 2024-01-01",
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
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	report
		.command("create")
		.description("Submit a report for a standup")
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

	return report;
}

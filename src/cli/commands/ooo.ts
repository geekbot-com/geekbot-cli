import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import {
	handleOooCreate,
	handleOooDelete,
	handleOooEdit,
	handleOooGet,
	handleOooList,
} from "../../handlers/ooo-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createOooCommand(): Command {
	const ooo = new Command("ooo").description(
		"Manage out-of-office periods that pause standup notifications (same periods as the bot's ooo command)",
	);

	ooo
		.command("list")
		.description(
			"List current and upcoming out-of-office periods for every member you can view (v2)",
		)
		.option(
			"--users <ids>",
			"Comma-separated Slack-style user IDs to restrict to (e.g. U123,U456; inaccessible ids are dropped; cannot be combined with --standups)",
		)
		.option(
			"--standups <ids>",
			"Comma-separated standup IDs — restrict to members of these standups (cannot be combined with --users)",
		)
		.option("--cursor <token>", "Opaque pagination cursor from a previous response")
		.option("--page-size <n>", "Page size (1-100, default 25)")
		.option(
			"--after <date>",
			"Periods ending on/after date (maps to v2 'since' — YYYY-MM-DD or ISO 8601; default: now)",
		)
		.option(
			"--before <date>",
			"Periods starting before date (maps to v2 'until' — YYYY-MM-DD or ISO 8601)",
		)
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot ooo list\n  geekbot ooo list --users U08LXSA31BJ,U08LXSA31BK\n  geekbot ooo list --standups 123,456\n  geekbot ooo list --after 2026-01-01 --before 2026-07-01\n  geekbot ooo list --page-size 50\n  geekbot ooo list --cursor "<token>"',
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleOooList(
					{
						users: opts.users,
						standups: opts.standups,
						cursor: opts.cursor,
						pageSize: opts.pageSize,
						after: opts.after,
						before: opts.before,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error);
			}
		});

	ooo
		.command("get")
		.description("Get an out-of-office period by ID (v2)")
		.argument("<oooId>", "OOO period ID (numeric)")
		.addHelpText("after", "\nExamples:\n  geekbot ooo get 12")
		.action(async function (this: Command, oooId: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handleOooGet(oooId, globalOpts);
			} catch (error) {
				handleError(error);
			}
		});

	ooo
		.command("create")
		.description("Create an out-of-office period that pauses standup notifications (v2)")
		.requiredOption("--start-date <date>", "First day out of office (YYYY-MM-DD)")
		.requiredOption("--end-date <date>", "Last day out of office (YYYY-MM-DD, inclusive)")
		.option("--user <id>", "Slack-style user ID (admins creating for another member)")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot ooo create --start-date "2026-08-01" --end-date "2026-08-15"\n  geekbot ooo create --start-date "2026-08-01" --end-date "2026-08-15" --user U08LXSA31BJ',
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleOooCreate(
					{
						startDate: opts.startDate,
						endDate: opts.endDate,
						user: opts.user,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error);
			}
		});

	ooo
		.command("edit")
		.description("Change the dates of an out-of-office period (v2)")
		.argument("<oooId>", "OOO period ID (numeric)")
		.option("--start-date <date>", "New first day out of office (YYYY-MM-DD)")
		.option("--end-date <date>", "New last day out of office (YYYY-MM-DD, inclusive)")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot ooo edit 12 --end-date "2026-08-20"\n  geekbot ooo edit 12 --start-date "2026-08-03" --end-date "2026-08-20"',
		)
		.action(async function (this: Command, oooId: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleOooEdit(
					oooId,
					{
						startDate: opts.startDate,
						endDate: opts.endDate,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error);
			}
		});

	ooo
		.command("delete")
		.description("Delete an out-of-office period, resuming standup notifications (v2)")
		.argument("<oooId>", "OOO period ID (numeric)")
		.option("--yes", "Confirm deletion (required)")
		.addHelpText("after", "\nExamples:\n  geekbot ooo delete 12 --yes")
		.action(async function (this: Command, oooId: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleOooDelete(oooId, { yes: opts.yes }, globalOpts);
			} catch (error) {
				handleError(error);
			}
		});

	return ooo;
}

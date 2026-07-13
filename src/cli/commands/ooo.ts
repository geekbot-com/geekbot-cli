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
		.description("List current and upcoming out-of-office periods (v2)")
		.option("--user <id>", "Slack-style user ID (admins listing another member, e.g. U123)")
		.option("--cursor <token>", "Opaque pagination cursor from a previous response")
		.option("--page-size <n>", "Page size (1-100, default 25)")
		.option(
			"--include-past",
			"Include periods that have already ended (default: current + upcoming only)",
		)
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot ooo list\n  geekbot ooo list --user U08LXSA31BJ\n  geekbot ooo list --include-past\n  geekbot ooo list --page-size 50\n  geekbot ooo list --cursor "<token>"',
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleOooList(
					{
						user: opts.user,
						cursor: opts.cursor,
						pageSize: opts.pageSize,
						includePast: opts.includePast,
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
		.option("--user <id>", "Slack-style user ID (admins reading another member's period)")
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot ooo get 12\n  geekbot ooo get 12 --user U08LXSA31BJ",
		)
		.action(async function (this: Command, oooId: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleOooGet(oooId, { user: opts.user }, globalOpts);
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
		.option("--user <id>", "Slack-style user ID (admins editing another member's period)")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot ooo edit 12 --end-date "2026-08-20"\n  geekbot ooo edit 12 --start-date "2026-08-03" --end-date "2026-08-20"\n  geekbot ooo edit 12 --end-date "2026-08-20" --user U08LXSA31BJ',
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
						user: opts.user,
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
		.option("--user <id>", "Slack-style user ID (admins deleting another member's period)")
		.option("--yes", "Confirm deletion (required)")
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot ooo delete 12 --yes\n  geekbot ooo delete 12 --user U08LXSA31BJ --yes",
		)
		.action(async function (this: Command, oooId: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleOooDelete(oooId, { user: opts.user, yes: opts.yes }, globalOpts);
			} catch (error) {
				handleError(error);
			}
		});

	return ooo;
}

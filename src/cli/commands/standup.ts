import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import {
	handleStandupCreate,
	handleStandupGet,
	handleStandupList,
	handleStandupStart,
} from "../../handlers/standup-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createStandupCommand(): Command {
	const standup = new Command("standup").description("Manage standups");

	standup
		.command("list")
		.description("List standups visible to you (v2)")
		.option("--state <states>", "Comma-separated subset of: active, paused")
		.option("--is-anonymous <bool>", "Filter by anonymity (true|false)")
		.option("--broadcast-channel <id>", "Restrict to a specific channel id (e.g. C12345)")
		.option("--created-since <date>", "ISO 8601 or YYYY-MM-DD (inclusive)")
		.option("--created-until <date>", "ISO 8601 or YYYY-MM-DD (exclusive)")
		.option("--cursor <token>", "Opaque pagination cursor from a previous response")
		.option("--page-size <n>", "Page size (1-100, default 25)")
		.option(
			"--include <fields>",
			"Comma-separated extras: questions, member_email, member_username, member_realname",
		)
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot standup list\n  geekbot standup list --state active --page-size 50\n  geekbot standup list --include questions\n  geekbot standup list --include member_email,member_username,member_realname\n  geekbot standup list --broadcast-channel C0123ABCD",
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupList(
					{
						state: opts.state,
						isAnonymous: opts.isAnonymous,
						broadcastChannel: opts.broadcastChannel,
						createdSince: opts.createdSince,
						createdUntil: opts.createdUntil,
						cursor: opts.cursor,
						pageSize: opts.pageSize,
						include: opts.include,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error);
			}
		});

	standup
		.command("get")
		.description("Get a standup by ID (v2)")
		.argument("<id>", "Standup ID (numeric)")
		.option(
			"--include <fields>",
			"Comma-separated extras: questions, member_email, member_username, member_realname",
		)
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot standup get 123\n  geekbot standup get 123 --include questions\n  geekbot standup get 123 --include member_email",
		)
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupGet(id, { include: opts.include }, globalOpts);
			} catch (error) {
				handleError(error);
			}
		});

	standup
		.command("create")
		.description("Create a new standup (v2)")
		.option("--name <name>", 'Standup name (default: "Standup #<broadcast channel>")')
		.requiredOption("--channel <channel>", "Broadcast channel id or name where reports are posted")
		.option("--sync-channel <channel>", "Channel id or name to sync members from")
		.option("--time <time>", "Time in HH:MM 24-hour format (default: 10:00)")
		.option("--timezone <tz>", 'IANA timezone (default: "user_local")')
		.option("--days <days>", "Comma-separated days (default: Mon-Fri)")
		.requiredOption(
			"--questions <json>",
			'Questions as JSON. Accepts ["q1","q2"] or [{"text":"q1","choices":["A","B"]}]',
		)
		.option("--users <ids>", "Comma-separated user IDs (mutually exclusive with --sync-channel)")
		.option("--is-anonymous", "Make responses anonymous")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot standup create --channel "#engineering" --questions \'["What did you do?","Any blockers?"]\'\n  geekbot standup create --name "Weekly" --channel "#team" --days "Mon" --time "09:00" --questions \'["q1"]\'\n  geekbot standup create --channel C123 --questions \'[{"text":"Pick","choices":["A","B"]}]\'',
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupCreate(
					{
						name: opts.name,
						channel: opts.channel,
						syncChannel: opts.syncChannel,
						time: opts.time,
						timezone: opts.timezone,
						days: opts.days,
						questions: opts.questions,
						users: opts.users,
						isAnonymous: opts.isAnonymous,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error);
			}
		});

	standup
		.command("start")
		.description("Trigger a standup immediately")
		.argument("<id>", "Standup ID (numeric)")
		.option("--users <ids>", "Comma-separated user IDs (omit for all)")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot standup start 123\n  geekbot standup start 123 --users "U123,U456"',
		)
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupStart(id, { users: opts.users }, globalOpts);
			} catch (error) {
				handleError(error);
			}
		});

	return standup;
}

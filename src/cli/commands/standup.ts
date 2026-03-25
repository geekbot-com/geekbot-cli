import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import {
	handleStandupCreate,
	handleStandupDelete,
	handleStandupDuplicate,
	handleStandupGet,
	handleStandupList,
	handleStandupReplace,
	handleStandupStart,
	handleStandupUpdate,
} from "../../handlers/standup-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createStandupCommand(): Command {
	const standup = new Command("standup").description("Manage standups");

	standup
		.command("list")
		.description("List standups you participate in")
		.option("--admin", "Include all team standups (admin only)")
		.option("--brief", "Show only id, name, channel, time, timezone, and days")
		.option("--name <name>", "Filter by name (case-insensitive substring match)")
		.option("--channel <channel>", "Filter by channel (case-insensitive substring match)")
		.option("--mine", "Show only standups you are a member of")
		.option("--member <id>", "Filter by member user ID")
		.option("--limit <n>", "Max number of standups to return")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot standup list\n  geekbot standup list --admin\n  geekbot standup list --brief\n  geekbot standup list --brief --limit 10\n  geekbot standup list --name "daily"\n  geekbot standup list --channel "#status"\n  geekbot standup list --mine --brief\n  geekbot standup list --member "UHNM44125" --brief',
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupList(
					{
						admin: opts.admin,
						brief: opts.brief,
						name: opts.name,
						channel: opts.channel,
						mine: opts.mine,
						member: opts.member,
						limit: opts.limit,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	standup
		.command("get")
		.description("Get a standup by ID")
		.argument("<id>", "Standup ID (numeric)")
		.addHelpText("after", "\nExamples:\n  geekbot standup get 123")
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handleStandupGet(id, globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	standup
		.command("create")
		.description("Create a new standup")
		.requiredOption("--name <name>", "Standup name")
		.requiredOption("--channel <channel>", "Slack channel name")
		.option("--time <time>", "Time in HH:MM 24-hour format (default: 10:00)")
		.option("--timezone <tz>", "IANA timezone")
		.option("--days <days>", "Comma-separated days (default: Mon-Fri)")
		.requiredOption("--questions <json>", "Questions as JSON array")
		.option("--users <ids>", "Comma-separated user IDs")
		.option("--wait-time <minutes>", "Minutes between users")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot standup create --name "Daily" --channel "#engineering"\n  geekbot standup create --name "Weekly" --channel "#team" --days "Mon" --time "09:00"',
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupCreate(
					{
						name: opts.name,
						channel: opts.channel,
						time: opts.time,
						timezone: opts.timezone,
						days: opts.days,
						questions: opts.questions,
						users: opts.users,
						waitTime: opts.waitTime,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	standup
		.command("update")
		.description("Partially update a standup (PATCH)")
		.argument("<id>", "Standup ID (numeric)")
		.option("--name <name>", "New standup name")
		.option("--channel <channel>", "New channel")
		.option("--time <time>", "New time (HH:MM)")
		.option("--timezone <tz>", "New timezone")
		.option("--days <days>", "New days (comma-separated)")
		.option("--questions <json>", "Questions as JSON array")
		.option("--users <ids>", "Comma-separated user IDs")
		.option("--wait-time <minutes>", "New wait time in minutes")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot standup update 123 --name "Updated Daily"\n  geekbot standup update 123 --time "14:00" --days "Mon,Wed,Fri"\n  geekbot standup update 123 --questions \'["What did you do?","Any blockers?"]\'',
		)
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupUpdate(
					id,
					{
						name: opts.name,
						channel: opts.channel,
						time: opts.time,
						timezone: opts.timezone,
						days: opts.days,
						questions: opts.questions,
						users: opts.users,
						waitTime: opts.waitTime,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	standup
		.command("replace")
		.description("Fully replace a standup (PUT)")
		.argument("<id>", "Standup ID (numeric)")
		.requiredOption("--name <name>", "Standup name")
		.requiredOption("--channel <channel>", "Slack channel")
		.option("--time <time>", "Time (HH:MM)", "10:00")
		.option("--timezone <tz>", "Timezone", "UTC")
		.option("--days <days>", "Days (comma-separated)", "Mon,Tue,Wed,Thu,Fri")
		.option("--questions <json>", "Questions as JSON array")
		.option("--users <ids>", "User IDs (comma-separated)")
		.option("--wait-time <minutes>", "Wait time in minutes")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot standup replace 123 --name "New Daily" --channel "#general"',
		)
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupReplace(
					id,
					{
						name: opts.name,
						channel: opts.channel,
						time: opts.time,
						timezone: opts.timezone,
						days: opts.days,
						questions: opts.questions,
						users: opts.users,
						waitTime: opts.waitTime,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	standup
		.command("delete")
		.description("Delete a standup")
		.argument("<id>", "Standup ID (numeric)")
		.option("--yes", "Confirm deletion (required)")
		.addHelpText("after", "\nExamples:\n  geekbot standup delete 123 --yes")
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupDelete(id, { yes: opts.yes }, globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	standup
		.command("duplicate")
		.description("Duplicate an existing standup")
		.argument("<id>", "Standup ID to duplicate (numeric)")
		.requiredOption("--name <name>", "Name for the new standup")
		.addHelpText("after", '\nExamples:\n  geekbot standup duplicate 123 --name "Copy of Daily"')
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handleStandupDuplicate(id, { name: opts.name }, globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
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
				handleError(error, globalOpts.debug);
			}
		});

	return standup;
}

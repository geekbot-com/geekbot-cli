import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import {
	handlePollCreate,
	handlePollGet,
	handlePollList,
	handlePollParticipation,
	handlePollVotes,
} from "../../handlers/poll-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createPollCommand(): Command {
	const poll = new Command("poll").description("Manage polls (Slack teams only)");

	poll
		.command("list")
		.description("List polls you created (v2)")
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
			"\nExamples:\n  geekbot poll list\n  geekbot poll list --state active --page-size 50\n  geekbot poll list --include questions\n  geekbot poll list --include member_email,member_username,member_realname",
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handlePollList(
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

	poll
		.command("get")
		.description("Get a poll by ID (v2)")
		.argument("<id>", "Poll ID (numeric)")
		.option(
			"--include <fields>",
			"Comma-separated extras: questions, member_email, member_username, member_realname",
		)
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot poll get 456\n  geekbot poll get 456 --include questions\n  geekbot poll get 456 --include member_email",
		)
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handlePollGet(id, { include: opts.include }, globalOpts);
			} catch (error) {
				handleError(error);
			}
		});

	poll
		.command("create")
		.description("Create a new poll (v2)")
		.requiredOption("--name <name>", "Poll name")
		.requiredOption("--channel <channel>", "Broadcast channel id or name where the poll is posted")
		.requiredOption("--question <text>", "Poll question text")
		.requiredOption("--choices <json>", "Choices as JSON array of strings (at least 2)")
		.option("--duration <minutes>", "Duration the poll stays open, in minutes (default: 120)")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot poll create --name "Lunch" --channel "#team" --question "Where?" --choices \'["Pizza", "Sushi"]\'\n  geekbot poll create --name "Lunch" --channel C123 --question "Where?" --choices \'["Pizza","Sushi"]\' --duration 60',
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handlePollCreate(
					{
						name: opts.name,
						channel: opts.channel,
						question: opts.question,
						choices: opts.choices,
						duration: opts.duration,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error);
			}
		});

	poll
		.command("votes")
		.description("Get voting results for a poll")
		.argument("<id>", "Poll ID (numeric)")
		.option("--after <date>", "Votes after date")
		.option("--before <date>", "Votes before date")
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot poll votes 456\n  geekbot poll votes 456 --after 2024-01-01",
		)
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handlePollVotes(id, { after: opts.after, before: opts.before }, globalOpts);
			} catch (error) {
				handleError(error);
			}
		});

	poll
		.command("participation")
		.description("Per-broadcast participation (response rate) for a poll (v2)")
		.argument("<id>", "Poll ID (numeric)")
		.option("--since <date>", "ISO 8601 or YYYY-MM-DD (inclusive lower bound)")
		.option("--until <date>", "ISO 8601 or YYYY-MM-DD (exclusive upper bound)")
		.option("--cursor <token>", "Opaque pagination cursor from a previous response")
		.option("--page-size <n>", "Page size (1-100, default 30)")
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot poll participation 456\n  geekbot poll participation 456 --since 2026-01-01 --until 2026-02-01\n  geekbot poll participation 456 --page-size 50",
		)
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				const opts = this.opts();
				await handlePollParticipation(
					id,
					{
						since: opts.since,
						until: opts.until,
						cursor: opts.cursor,
						pageSize: opts.pageSize,
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error);
			}
		});

	return poll;
}

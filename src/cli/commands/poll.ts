import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import {
	handlePollCreate,
	handlePollGet,
	handlePollList,
	handlePollVotes,
} from "../../handlers/poll-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createPollCommand(): Command {
	const poll = new Command("poll").description("Manage polls (Slack teams only)");

	poll
		.command("list")
		.description("List all polls")
		.addHelpText("after", "\nExamples:\n  geekbot poll list")
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handlePollList(globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	poll
		.command("get")
		.description("Get a poll by ID")
		.argument("<id>", "Poll ID (numeric)")
		.addHelpText("after", "\nExamples:\n  geekbot poll get 456")
		.action(async function (this: Command, id: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handlePollGet(id, globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	poll
		.command("create")
		.description("Create a new poll")
		.requiredOption("--name <name>", "Poll name")
		.requiredOption("--channel <channel>", "Slack channel")
		.requiredOption("--question <text>", "Poll question text")
		.requiredOption("--choices <json>", "Choices as JSON array of strings")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot poll create --name "Lunch" --channel "#team" --question "Where?" --choices \'["Pizza", "Sushi"]\'',
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
					},
					globalOpts,
				);
			} catch (error) {
				handleError(error, globalOpts.debug);
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
				handleError(error, globalOpts.debug);
			}
		});

	return poll;
}

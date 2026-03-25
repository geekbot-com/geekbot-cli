import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import { handleTeamList, handleTeamSearch } from "../../handlers/team-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createTeamCommand(): Command {
	const team = new Command("team").description("View team information");

	team
		.command("list")
		.description("List all teams with members")
		.addHelpText("after", "\nExamples:\n  geekbot team list")
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handleTeamList(globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	team
		.command("search")
		.description("Search team members by name, username, or email")
		.argument("<query>", "Search term (case-insensitive substring match)")
		.addHelpText(
			"after",
			'\nExamples:\n  geekbot team search jenny\n  geekbot team search "smith"\n  geekbot team search @example.com',
		)
		.action(async function (this: Command, query: string) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handleTeamSearch(query, globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	return team;
}

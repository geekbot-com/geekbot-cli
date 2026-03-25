import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import { handleMeShow, handleMeTeams } from "../../handlers/me-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createMeCommand(): Command {
	const me = new Command("me").description("View your profile and teams");

	me.command("show")
		.description("Show your Geekbot profile")
		.addHelpText("after", "\nExamples:\n  geekbot me show")
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handleMeShow(globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	me.command("teams")
		.description("List teams you belong to")
		.addHelpText("after", "\nExamples:\n  geekbot me teams")
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handleMeTeams(globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	return me;
}

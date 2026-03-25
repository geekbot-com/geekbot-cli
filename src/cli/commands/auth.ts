import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import {
	handleAuthRemove,
	handleAuthSetup,
	handleAuthStatus,
} from "../../handlers/auth-handlers.ts";
import { getGlobalOptions } from "../globals.ts";

export function createAuthCommand(): Command {
	const auth = new Command("auth").description("Manage authentication");

	auth
		.command("setup")
		.description("Interactively configure and store API key")
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot auth setup\n  geekbot --api-key YOUR_KEY auth setup",
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handleAuthSetup({ apiKey: globalOpts.apiKey }, globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	auth
		.command("status")
		.description("Verify stored credentials work")
		.addHelpText("after", "\nExamples:\n  geekbot auth status")
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handleAuthStatus(globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	auth
		.command("remove")
		.description("Remove stored API key from OS keychain")
		.addHelpText("after", "\nExamples:\n  geekbot auth remove")
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			try {
				await handleAuthRemove(globalOpts);
			} catch (error) {
				handleError(error, globalOpts.debug);
			}
		});

	return auth;
}

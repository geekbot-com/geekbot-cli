import { Command } from "commander";
import { handleError } from "../../errors/error-handler.ts";
import {
	handleAuthLogin,
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
				handleError(error);
			}
		});

	auth
		.command("login")
		.description("Sign in via OAuth (authorization code + PKCE + loopback redirect)")
		.option("--no-browser", "Do not try to open the authorize URL in a browser")
		.option("--device-name <name>", "Friendly name for this device (default: hostname)")
		.option(
			"--ttl-days <days>",
			"CLI token lifetime in days (7, 30, 90, 180, or 365)",
			(value) => Number.parseInt(value, 10),
			30,
		)
		.addHelpText(
			"after",
			"\nExamples:\n  geekbot auth login\n  geekbot auth login --no-browser\n  geekbot auth login --device-name laptop --ttl-days 90",
		)
		.action(async function (this: Command) {
			const globalOpts = getGlobalOptions(this);
			const opts = this.opts<{ browser: boolean; deviceName?: string; ttlDays: number }>();
			try {
				await handleAuthLogin(
					{
						noBrowser: !opts.browser,
						deviceName: opts.deviceName,
						ttlDays: opts.ttlDays as 7 | 30 | 90 | 180 | 365,
					},
					globalOpts,
				);
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
				handleError(error);
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
				handleError(error);
			}
		});

	return auth;
}

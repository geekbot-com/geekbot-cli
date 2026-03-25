import { type Command, Option } from "commander";

export interface GlobalOptions {
	apiKey?: string;
	output: "json";
	debug: boolean;
}

/**
 * Add global options to the root program.
 * These are inherited by all subcommands via optsWithGlobals().
 */
export function addGlobalOptions(program: Command): void {
	program
		.option("--api-key <key>", "Geekbot API key (overrides GEEKBOT_API_KEY env var)")
		.addOption(new Option("--output <format>", "Output format").choices(["json"]).default("json"))
		.option("--debug", "Show debug output on stderr", false);
}

/**
 * Extract global options from a command's optsWithGlobals().
 * Call this from any action handler.
 */
export function getGlobalOptions(cmd: Command): GlobalOptions {
	const opts = cmd.optsWithGlobals();
	return {
		apiKey: opts.apiKey,
		output: "json",
		debug: opts.debug === true,
	};
}

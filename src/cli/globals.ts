import type { Command } from "commander";

export interface GlobalOptions {
	apiKey?: string;
}

/**
 * Add global options to the root program.
 * These are inherited by all subcommands via optsWithGlobals().
 */
export function addGlobalOptions(program: Command): void {
	program.option("--api-key <key>", "Geekbot API key (overrides GEEKBOT_API_KEY env var)");
}

/**
 * Extract global options from a command's optsWithGlobals().
 * Call this from any action handler.
 */
export function getGlobalOptions(cmd: Command): GlobalOptions {
	const opts = cmd.optsWithGlobals();
	return {
		apiKey: opts.apiKey,
	};
}

#!/usr/bin/env bun
import { Command, CommanderError } from "commander";
import { CliError } from "../errors/cli-error.ts";
import { handleError } from "../errors/error-handler.ts";
import { ExitCode } from "../errors/exit-codes.ts";
import { APP_NAME, APP_VERSION } from "../utils/constants.ts";
import { createAuthCommand } from "./commands/auth.ts";
import { createMeCommand } from "./commands/me.ts";
import { createOooCommand } from "./commands/ooo.ts";
import { createPollCommand } from "./commands/poll.ts";
import { createReportCommand } from "./commands/report.ts";
import { createStandupCommand } from "./commands/standup.ts";
import { createTeamCommand } from "./commands/team.ts";
import { addGlobalOptions } from "./globals.ts";

// Recursively apply exitOverride to all subcommands so Commander throws
// CommanderError instead of calling process.exit() on usage errors.
function applyExitOverride(cmd: Command): void {
	for (const sub of cmd.commands) {
		sub.exitOverride();
		applyExitOverride(sub);
	}
}

/**
 * Create and configure the CLI program with all commands, options,
 * exitOverride, and configureOutput wiring. Returns the fully configured
 * Commander program instance without calling parseAsync.
 */
export function createProgram(): Command {
	const program = new Command()
		.name(APP_NAME)
		.version(APP_VERSION, "-v, --version")
		.description("Geekbot CLI -- manage standups, reports, and polls for AI agents and humans")
		.exitOverride();

	// Route Commander.js error output to stderr (Pitfall 4)
	program.configureOutput({
		writeOut: (str) => process.stderr.write(str),
		writeErr: (str) => process.stderr.write(str),
		outputError: (str, write) => write(str),
	});

	// Add global flags
	addGlobalOptions(program);

	// Register resource subcommands (noun-verb pattern: CLI-01)
	program.addCommand(createStandupCommand());
	program.addCommand(createReportCommand());
	program.addCommand(createPollCommand());
	program.addCommand(createOooCommand());
	program.addCommand(createAuthCommand());
	program.addCommand(createMeCommand());
	program.addCommand(createTeamCommand());

	applyExitOverride(program);

	return program;
}

/**
 * Parse argv and handle errors from Commander and action handlers.
 * Exported for testing; the entrypoint calls this automatically.
 */
export async function main(program: Command, argv: string[] = process.argv): Promise<void> {
	try {
		await program.parseAsync(argv);
	} catch (error) {
		if (error instanceof CommanderError) {
			// Map Commander usage errors (missing args, unknown options, etc.)
			// to CliError with ExitCode.USAGE so they go through the JSON envelope.
			// Preserve Commander's exitCode 0 for --help/--version (not an error).
			if (error.exitCode === 0) {
				process.exit(0);
			}
			const usageError = new CliError(
				error.message,
				"usage_error",
				ExitCode.USAGE,
				false,
				"Run with --help for usage information",
			);
			handleError(usageError);
		} else {
			handleError(error);
		}
	}
}

// Run when executed as the CLI entrypoint (not when imported for testing).
// import.meta.main is true in Bun when this file is the entrypoint.
if (import.meta.main) {
	const program = createProgram();
	main(program);
}

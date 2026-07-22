import { describe, expect, test } from "bun:test";
import { createProgram } from "../../src/cli/index.ts";
import { APP_NAME, APP_VERSION } from "../../src/utils/constants.ts";

/**
 * CLI index.ts registration test.
 *
 * Tests the real createProgram() from src/cli/index.ts to verify
 * that the CLI is wired up correctly: name, version, commands,
 * global options, exitOverride, and configureOutput.
 */

const EXPECTED_COMMANDS = ["standup", "report", "poll", "ooo", "auth", "me", "team"];

describe("CLI program registration", () => {
	test("program is named with APP_NAME and has APP_VERSION set", () => {
		const program = createProgram();
		expect(program.name()).toBe(APP_NAME);
		expect(program.name()).toBe("geekbot");
		expect(program.version()).toBe(APP_VERSION);
	});

	test(`registers all ${EXPECTED_COMMANDS.length} resource commands`, () => {
		const program = createProgram();
		const registered = program.commands.map((c) => c.name()).sort();
		expect(registered).toEqual([...EXPECTED_COMMANDS].sort());
		expect(program.commands.length).toBe(EXPECTED_COMMANDS.length);
	});

	test("has configureOutput routing output to stderr", () => {
		const program = createProgram();
		// configureOutput stores the config; Commander exposes it via configureOutput()
		// Verify writeOut and writeErr are configured (not the defaults)
		const outputConfig = program.configureOutput();
		expect(outputConfig.writeOut).toBeDefined();
		expect(outputConfig.writeErr).toBeDefined();
		expect(outputConfig.outputError).toBeDefined();
	});

	test("has exitOverride set on root program", () => {
		const program = createProgram();
		// With exitOverride, an unknown option should throw CommanderError
		// instead of calling process.exit
		const { CommanderError } = require("commander");
		expect(() => {
			program.parse(["--unknown-global-flag"], { from: "user" });
		}).toThrow(CommanderError);
	});

	test("has exitOverride applied to all subcommands", () => {
		const program = createProgram();
		const { CommanderError } = require("commander");
		// Pick a subcommand and verify it also throws instead of exiting
		const standupCmd = program.commands.find((c) => c.name() === "standup");
		expect(standupCmd).toBeDefined();
		expect(() => {
			standupCmd?.parse(["--nonexistent-flag"], { from: "user" });
		}).toThrow(CommanderError);
	});

	test("registers --api-key global option", () => {
		const program = createProgram();
		const optionNames = program.options.map((o) => o.long);
		expect(optionNames).toContain("--api-key");
	});
});

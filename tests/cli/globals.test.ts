import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { addGlobalOptions, getGlobalOptions } from "../../src/cli/globals.ts";

describe("addGlobalOptions", () => {
	test("adds --api-key option to program", () => {
		const program = new Command();
		addGlobalOptions(program);
		const optionNames = program.options.map((o) => o.long);
		expect(optionNames).toContain("--api-key");
	});
});

describe("getGlobalOptions", () => {
	test("extracts apiKey from command", () => {
		const program = new Command();
		addGlobalOptions(program);
		program.parse(["--api-key", "secret"], { from: "user" });
		const opts = getGlobalOptions(program);
		expect(opts.apiKey).toBe("secret");
	});

	test("apiKey is undefined when --api-key not provided", () => {
		const program = new Command();
		addGlobalOptions(program);
		program.parse([], { from: "user" });
		const opts = getGlobalOptions(program);
		expect(opts.apiKey).toBeUndefined();
	});
});

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { addGlobalOptions, getGlobalOptions } from "../../src/cli/globals.ts";

describe("addGlobalOptions", () => {
	test("adds --api-key, --output, --debug options to program", () => {
		const program = new Command();
		addGlobalOptions(program);
		const opts = program.opts();
		// --debug defaults to false
		expect(opts.debug).toBe(false);
		// --output defaults to "json"
		expect(opts.output).toBe("json");
	});

	test("rejects invalid --output format", () => {
		const program = new Command().exitOverride();
		addGlobalOptions(program);
		expect(() => {
			program.parse(["--output", "xml"], { from: "user" });
		}).toThrow();
	});
});

describe("getGlobalOptions", () => {
	test("extracts typed options from command", () => {
		const program = new Command();
		addGlobalOptions(program);
		program.parse(["--debug", "--output", "json"], { from: "user" });
		const opts = getGlobalOptions(program);
		expect(opts.debug).toBe(true);
		expect(opts.output).toBe("json");
	});

	test("defaults debug to false", () => {
		const program = new Command();
		addGlobalOptions(program);
		program.parse([], { from: "user" });
		const opts = getGlobalOptions(program);
		expect(opts.debug).toBe(false);
	});
});

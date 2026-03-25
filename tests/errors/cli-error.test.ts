import { describe, expect, test } from "bun:test";
import { CliError } from "../../src/errors/cli-error.ts";
import { ExitCode } from "../../src/errors/exit-codes.ts";

describe("CliError", () => {
	test("carries code, message, exitCode, retryable", () => {
		const err = new CliError("Not found", "not_found", ExitCode.NOT_FOUND, false);
		expect(err.message).toBe("Not found");
		expect(err.code).toBe("not_found");
		expect(err.exitCode).toBe(3);
		expect(err.retryable).toBe(false);
	});

	test("carries optional suggestion", () => {
		const err = new CliError("Bad", "bad", ExitCode.GENERAL, false, "Try this");
		expect(err.suggestion).toBe("Try this");
	});

	test("carries optional context", () => {
		const err = new CliError("Err", "err", ExitCode.GENERAL, false, undefined, { id: 123 });
		expect(err.context).toEqual({ id: 123 });
	});

	test("defaults retryable to false", () => {
		const err = new CliError("Err", "err", ExitCode.GENERAL);
		expect(err.retryable).toBe(false);
	});

	test("is an instance of Error", () => {
		const err = new CliError("Err", "err", ExitCode.GENERAL);
		expect(err).toBeInstanceOf(Error);
	});

	test("has name CliError", () => {
		const err = new CliError("Err", "err", ExitCode.GENERAL);
		expect(err.name).toBe("CliError");
	});
});

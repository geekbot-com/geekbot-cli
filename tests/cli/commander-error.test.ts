import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { CommanderError } from "commander";
import { createProgram, main } from "../../src/cli/index.ts";
import { ExitCode } from "../../src/errors/exit-codes.ts";

/**
 * Tests that Commander usage errors (missing args, unknown options) are
 * properly caught via exitOverride() and mapped to CliError with
 * ExitCode.USAGE (code 2) in a JSON envelope, rather than Commander
 * calling process.exit(1) directly with plain-text output.
 *
 * Uses the real createProgram() and main() from src/cli/index.ts
 * so regressions in command registration, configureOutput, or error
 * handling are caught.
 */

describe("Commander exitOverride and usage error handling", () => {
	let stdoutOutput = "";
	let _stderrOutput = "";
	let exitCode: number | undefined;

	const stdoutSpy = spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
		stdoutOutput += String(chunk);
		return true;
	});
	const stderrSpy = spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
		_stderrOutput += String(chunk);
		return true;
	});
	const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
		exitCode = code;
		throw new Error("EXIT");
	});

	afterEach(() => {
		stdoutOutput = "";
		_stderrOutput = "";
		exitCode = undefined;
		stdoutSpy.mockClear();
		stderrSpy.mockClear();
		exitSpy.mockClear();
	});

	/**
	 * Run the real main() error handling with user-supplied argv.
	 * Creates a fresh program for each invocation so tests are isolated.
	 */
	async function runWithErrorHandling(argv: string[]): Promise<void> {
		const program = createProgram();
		await main(program, ["node", "geekbot", ...argv]);
	}

	test("missing required argument produces JSON envelope with usage_error code", async () => {
		try {
			await runWithErrorHandling(["standup", "get"]);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.ok).toBe(false);
		expect(envelope.data).toBeNull();
		expect(envelope.error.code).toBe("usage_error");
		expect(envelope.error.retryable).toBe(false);
		expect(envelope.error.suggestion).toBe("Run with --help for usage information");
		expect(envelope.metadata.timestamp).toBeTruthy();
	});

	test("missing required argument exits with code 2 (USAGE)", async () => {
		try {
			await runWithErrorHandling(["standup", "get"]);
		} catch {}
		expect(exitCode).toBe(ExitCode.USAGE);
		expect(exitCode).toBe(2);
	});

	test("missing required argument error message mentions the missing argument", async () => {
		try {
			await runWithErrorHandling(["standup", "get"]);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		// Commander's error message should reference the missing <id> argument
		expect(envelope.error.message).toContain("id");
	});

	test("unknown option produces JSON envelope with usage_error code", async () => {
		try {
			await runWithErrorHandling(["standup", "list", "--nonexistent-flag"]);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.ok).toBe(false);
		expect(envelope.error.code).toBe("usage_error");
		expect(envelope.error.message).toContain("--nonexistent-flag");
	});

	test("unknown option exits with code 2 (USAGE)", async () => {
		try {
			await runWithErrorHandling(["standup", "list", "--nonexistent-flag"]);
		} catch {}
		expect(exitCode).toBe(2);
	});

	test("missing required argument on poll get produces correct exit code", async () => {
		try {
			await runWithErrorHandling(["poll", "get"]);
		} catch {}
		expect(exitCode).toBe(2);
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.ok).toBe(false);
		expect(envelope.error.code).toBe("usage_error");
		expect(envelope.error.message).toContain("id");
	});

	test("CommanderError is not passed through as internal_error", async () => {
		try {
			await runWithErrorHandling(["standup", "get"]);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		// Should be usage_error, NOT internal_error
		expect(envelope.error.code).not.toBe("internal_error");
	});

	test("exitOverride is set on the program", () => {
		const program = createProgram();
		// Verify that calling parse with bad args throws CommanderError
		// instead of calling process.exit directly
		expect(() => {
			program.parse(["--unknown-global-flag"], { from: "user" });
		}).toThrow(CommanderError);
	});
});

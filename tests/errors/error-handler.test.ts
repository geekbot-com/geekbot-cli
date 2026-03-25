import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { CliError } from "../../src/errors/cli-error.ts";
import { handleError } from "../../src/errors/error-handler.ts";
import { ExitCode } from "../../src/errors/exit-codes.ts";

describe("handleError", () => {
	let stdoutOutput = "";
	let stderrOutput = "";
	let exitCode: number | undefined;

	const stdoutSpy = spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
		stdoutOutput += String(chunk);
		return true;
	});
	const stderrSpy = spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
		stderrOutput += String(chunk);
		return true;
	});
	const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
		exitCode = code;
		throw new Error("EXIT"); // Prevent actual exit
	});

	afterEach(() => {
		stdoutOutput = "";
		stderrOutput = "";
		exitCode = undefined;
		stdoutSpy.mockClear();
		stderrSpy.mockClear();
		exitSpy.mockClear();
	});

	test("produces failure envelope on stdout for CliError", () => {
		const err = new CliError("Not found", "not_found", ExitCode.NOT_FOUND, false, "Try list");
		try {
			handleError(err);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.ok).toBe(false);
		expect(envelope.data).toBeNull();
		expect(envelope.error.code).toBe("not_found");
		expect(envelope.error.message).toBe("Not found");
		expect(envelope.error.retryable).toBe(false);
		expect(envelope.error.suggestion).toBe("Try list");
		expect(envelope.metadata.timestamp).toBeTruthy();
	});

	test("exits with CliError exitCode", () => {
		const err = new CliError("Auth", "auth_missing", ExitCode.AUTH);
		try {
			handleError(err);
		} catch {}
		expect(exitCode).toBe(4);
	});

	test("writes debug context to stderr when debug=true", () => {
		const err = new CliError("Err", "err", ExitCode.GENERAL, false, undefined, {
			foo: "bar",
		});
		try {
			handleError(err, true);
		} catch {}
		expect(stderrOutput).toContain("foo");
		expect(stderrOutput).toContain("bar");
	});

	test("does NOT write debug context when debug=false", () => {
		const err = new CliError("Err", "err", ExitCode.GENERAL, false, undefined, {
			foo: "bar",
		});
		try {
			handleError(err, false);
		} catch {}
		expect(stderrOutput).toBe("");
	});

	test("handles unknown errors with internal_error code", () => {
		try {
			handleError(new Error("oops"));
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.error.code).toBe("internal_error");
		expect(envelope.error.message).toBe("oops");
		expect(exitCode).toBe(1);
	});

	test("handles thrown string with String() fallback", () => {
		try {
			handleError("string error");
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.error.code).toBe("internal_error");
		expect(envelope.error.message).toBe("string error");
		expect(exitCode).toBe(1);
	});

	test("handles thrown null", () => {
		try {
			handleError(null);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.error.code).toBe("internal_error");
		expect(envelope.error.message).toBe("null");
		expect(exitCode).toBe(1);
	});

	test("handles thrown undefined", () => {
		try {
			handleError(undefined);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.error.code).toBe("internal_error");
		expect(envelope.error.message).toBe("undefined");
		expect(exitCode).toBe(1);
	});
});

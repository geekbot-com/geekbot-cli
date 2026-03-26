import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { z } from "zod";
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

	test("handles ZodError with schema_validation_error code", () => {
		const schema = z.object({ name: z.string(), age: z.number() });
		let zodError: unknown;
		try {
			schema.parse({ name: 123, age: "bad" });
		} catch (e) {
			zodError = e;
		}
		try {
			handleError(zodError);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.error.code).toBe("schema_validation_error");
		expect(exitCode).toBe(ExitCode.API_ERROR);
	});

	test("ZodError message summarises field-level issues", () => {
		const schema = z.object({ id: z.number() });
		let zodError: unknown;
		try {
			schema.parse({ id: "not-a-number" });
		} catch (e) {
			zodError = e;
		}
		try {
			handleError(zodError);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.error.message).toContain("id");
	});

	test("ZodError writes debug context to stderr when debug=true", () => {
		const schema = z.object({ id: z.number() });
		let zodError: unknown;
		try {
			schema.parse({});
		} catch (e) {
			zodError = e;
		}
		try {
			handleError(zodError, true);
		} catch {}
		expect(stderrOutput).toContain("ZodError issues");
	});

	test("ZodError envelope is not retryable and has a suggestion", () => {
		const schema = z.object({ x: z.string() });
		let zodError: unknown;
		try {
			schema.parse({});
		} catch (e) {
			zodError = e;
		}
		try {
			handleError(zodError);
		} catch {}
		const envelope = JSON.parse(stdoutOutput.trim());
		expect(envelope.error.retryable).toBe(false);
		expect(envelope.error.suggestion).toBeTruthy();
	});
});

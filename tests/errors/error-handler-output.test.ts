import { afterAll, afterEach, describe, expect, mock, spyOn, test } from "bun:test";

// --- Mocks ---

// Capture writeOutput calls to verify handleError routes through it
const mockWriteOutput = mock(() => {});
mock.module("../../src/output/formatter.ts", () => ({
	writeOutput: mockWriteOutput,
}));

import { z } from "zod";
import { CliError } from "../../src/errors/cli-error.ts";
import { handleError } from "../../src/errors/error-handler.ts";
import { ExitCode } from "../../src/errors/exit-codes.ts";

describe("handleError routes output through writeOutput", () => {
	const exitSpy = spyOn(process, "exit").mockImplementation((_code?: number) => {
		throw new Error("EXIT");
	});

	afterEach(() => {
		mockWriteOutput.mockClear();
		exitSpy.mockClear();
	});

	afterAll(() => {
		mock.restore();
	});

	test("CliError routes through writeOutput", () => {
		const err = new CliError("Not found", "not_found", ExitCode.NOT_FOUND, false, "Try list");
		try {
			handleError(err);
		} catch {}

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(false);
		expect(envelope.error.code).toBe("not_found");
	});

	test("ZodError routes through writeOutput", () => {
		const schema = z.object({ id: z.number() });
		let zodError: unknown;
		try {
			schema.parse({ id: "bad" });
		} catch (e) {
			zodError = e;
		}
		try {
			handleError(zodError);
		} catch {}

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(false);
		expect(envelope.error.code).toBe("schema_validation_error");
	});

	test("unknown error routes through writeOutput", () => {
		try {
			handleError(new Error("boom"));
		} catch {}

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(false);
		expect(envelope.error.code).toBe("internal_error");
	});

	test("does not write to stdout directly", () => {
		const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
		try {
			handleError(new Error("test"));
		} catch {}

		expect(stdoutSpy).not.toHaveBeenCalled();
		stdoutSpy.mockRestore();
	});
});

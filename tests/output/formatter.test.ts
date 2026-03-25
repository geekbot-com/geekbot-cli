import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { success } from "../../src/output/envelope.ts";
import { writeOutput } from "../../src/output/formatter.ts";

describe("writeOutput", () => {
	let stdoutOutput = "";
	let stdoutSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		stdoutOutput = "";
		stdoutSpy = spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
			stdoutOutput += String(chunk);
			return true;
		});
	});

	afterEach(() => {
		stdoutSpy.mockRestore();
	});

	test("writes JSON envelope to stdout", () => {
		const envelope = success({ test: true });
		writeOutput(envelope);
		const parsed = JSON.parse(stdoutOutput.trim());
		expect(parsed.ok).toBe(true);
		expect(parsed.data.test).toBe(true);
	});

	test("outputs pretty-printed JSON with 2-space indent", () => {
		writeOutput(success("x"));
		// Verify 2-space indentation: lines should start with exactly 2 spaces (not tabs, not 4 spaces)
		const lines = stdoutOutput.split("\n");
		const indentedLines = lines.filter((line) => line.startsWith(" "));
		expect(indentedLines.length).toBeGreaterThan(0);
		for (const line of indentedLines) {
			const leadingSpaces = line.match(/^( +)/)?.[1]?.length ?? 0;
			expect(leadingSpaces % 2).toBe(0); // every indent level is a multiple of 2
		}
		// Confirm first indent level is exactly 2 spaces (not 4 or other)
		expect(lines.some((line) => /^ {2}\S/.test(line))).toBe(true);
	});
});

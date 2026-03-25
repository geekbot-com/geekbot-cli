import { describe, expect, test } from "bun:test";
import { ExitCode } from "../../src/errors/exit-codes.ts";

describe("ExitCode", () => {
	test("has exactly 10 entries", () => {
		expect(Object.keys(ExitCode).length).toBe(10);
	});

	test("SUCCESS is 0", () => expect(ExitCode.SUCCESS).toBe(0));
	test("GENERAL is 1", () => expect(ExitCode.GENERAL).toBe(1));
	test("USAGE is 2", () => expect(ExitCode.USAGE).toBe(2));
	test("NOT_FOUND is 3", () => expect(ExitCode.NOT_FOUND).toBe(3));
	test("AUTH is 4", () => expect(ExitCode.AUTH).toBe(4));
	test("FORBIDDEN is 5", () => expect(ExitCode.FORBIDDEN).toBe(5));
	test("VALIDATION is 6", () => expect(ExitCode.VALIDATION).toBe(6));
	test("NETWORK is 7", () => expect(ExitCode.NETWORK).toBe(7));
	test("CONFLICT is 8", () => expect(ExitCode.CONFLICT).toBe(8));
	test("API_ERROR is 9", () => expect(ExitCode.API_ERROR).toBe(9));

	test("all values are unique", () => {
		const values = Object.values(ExitCode);
		expect(new Set(values).size).toBe(values.length);
	});
});

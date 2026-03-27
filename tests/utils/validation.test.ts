import { describe, expect, test } from "bun:test";
import { CliError } from "../../src/errors/cli-error.ts";
import * as validationModule from "../../src/utils/validation.ts";
import {
	validateDayAbbreviations,
	validateLimit,
	validateNumericId,
	validateSlackId,
	validateSlackIdList,
	validateTimeFormat,
	validateWaitTime,
} from "../../src/utils/validation.ts";

describe("validation module public API", () => {
	test("exports only functions used by production code", () => {
		const exportedNames = Object.keys(validationModule).sort();
		expect(exportedNames).toEqual([
			"validateDayAbbreviations",
			"validateLimit",
			"validateNumericId",
			"validateSlackId",
			"validateSlackIdList",
			"validateTimeFormat",
			"validateWaitTime",
		]);
	});
});

describe("validateNumericId", () => {
	test("returns number for valid positive integer string", () => {
		expect(validateNumericId("123")).toBe(123);
	});

	test("returns number for large ID", () => {
		expect(validateNumericId("999999")).toBe(999999);
	});

	test("throws CliError for non-numeric string", () => {
		expect(() => validateNumericId("abc")).toThrow(CliError);
	});

	test("throws CliError for zero", () => {
		expect(() => validateNumericId("0")).toThrow(CliError);
	});

	test("throws CliError for negative number", () => {
		expect(() => validateNumericId("-5")).toThrow(CliError);
	});

	test("throws CliError for decimal", () => {
		expect(() => validateNumericId("1.5")).toThrow(CliError);
	});

	test("error has exitCode 6 (VALIDATION)", () => {
		try {
			validateNumericId("abc", "standup ID");
		} catch (e) {
			expect((e as CliError).exitCode).toBe(6);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("error message includes label", () => {
		try {
			validateNumericId("abc", "standup ID");
		} catch (e) {
			expect((e as CliError).message).toContain("standup ID");
		}
	});

	test("accepts MAX_SAFE_INTEGER as a valid ID", () => {
		expect(validateNumericId("9007199254740991")).toBe(9007199254740991);
	});

	test("throws CliError for integer beyond MAX_SAFE_INTEGER", () => {
		expect(() => validateNumericId("9007199254740993")).toThrow(CliError);
	});
});

describe("validateSlackId", () => {
	test("accepts standard Slack user IDs", () => {
		expect(validateSlackId("U123")).toBe("U123");
		expect(validateSlackId("UHNM44125")).toBe("UHNM44125");
		expect(validateSlackId("U08LXSA31BJ")).toBe("U08LXSA31BJ");
	});

	test("throws CliError for numeric-only strings", () => {
		expect(() => validateSlackId("123")).toThrow(CliError);
	});

	test("throws CliError for lowercase IDs", () => {
		expect(() => validateSlackId("u123abc")).toThrow(CliError);
	});

	test("throws CliError for empty string", () => {
		expect(() => validateSlackId("")).toThrow(CliError);
	});

	test("throws CliError for single character", () => {
		expect(() => validateSlackId("U")).toThrow(CliError);
	});

	test("error has exitCode 6 (VALIDATION)", () => {
		try {
			validateSlackId("123", "user ID");
		} catch (e) {
			expect((e as CliError).exitCode).toBe(6);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("error message includes label", () => {
		try {
			validateSlackId("123", "user ID");
		} catch (e) {
			expect((e as CliError).message).toContain("user ID");
		}
	});
});

describe("validateSlackIdList", () => {
	test("returns array for comma-separated Slack IDs", () => {
		expect(validateSlackIdList("U123,U456", "user ID")).toEqual(["U123", "U456"]);
	});

	test("returns single-element array for single ID", () => {
		expect(validateSlackIdList("UHNM44125", "user ID")).toEqual(["UHNM44125"]);
	});

	test("handles whitespace around values", () => {
		expect(validateSlackIdList("U123, U456, U789", "user ID")).toEqual(["U123", "U456", "U789"]);
	});

	test("throws CliError for numeric values", () => {
		expect(() => validateSlackIdList("123,456", "user ID")).toThrow(CliError);
	});

	test("throws CliError when any value is invalid", () => {
		expect(() => validateSlackIdList("U123,bad,U456", "user ID")).toThrow(CliError);
	});
});

describe("validateWaitTime", () => {
	test("returns number for valid non-negative integer", () => {
		expect(validateWaitTime("15")).toBe(15);
	});

	test("returns 0 for zero", () => {
		expect(validateWaitTime("0")).toBe(0);
	});

	test("throws CliError for non-numeric string", () => {
		expect(() => validateWaitTime("foo")).toThrow(CliError);
	});

	test("throws CliError for decimal", () => {
		expect(() => validateWaitTime("1.5")).toThrow(CliError);
	});

	test("P2-1: accepts -1 as exact-time sentinel", () => {
		expect(validateWaitTime("-1")).toBe(-1);
	});

	test("throws CliError for negative number other than -1", () => {
		expect(() => validateWaitTime("-5")).toThrow(CliError);
	});

	test("throws CliError for text with numbers", () => {
		expect(() => validateWaitTime("10min")).toThrow(CliError);
	});

	test("error message includes the invalid value", () => {
		try {
			validateWaitTime("foo");
		} catch (e) {
			expect((e as CliError).message).toContain("foo");
			expect((e as CliError).message).toContain("wait time");
		}
	});

	test("error has exitCode 6 (VALIDATION)", () => {
		try {
			validateWaitTime("foo");
		} catch (e) {
			expect((e as CliError).exitCode).toBe(6);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("throws CliError for value beyond MAX_SAFE_INTEGER", () => {
		expect(() => validateWaitTime("9007199254740993")).toThrow(CliError);
	});
});

describe("validateTimeFormat", () => {
	test("accepts valid 24-hour times", () => {
		expect(validateTimeFormat("09:30")).toBe("09:30");
		expect(validateTimeFormat("14:00")).toBe("14:00");
		expect(validateTimeFormat("00:00")).toBe("00:00");
		expect(validateTimeFormat("23:59")).toBe("23:59");
	});

	test("rejects invalid time formats", () => {
		expect(() => validateTimeFormat("25:00")).toThrow(CliError);
		expect(() => validateTimeFormat("9:30")).toThrow(CliError);
		expect(() => validateTimeFormat("abc")).toThrow(CliError);
	});
});

describe("validateDayAbbreviations", () => {
	test("accepts valid day abbreviations", () => {
		expect(validateDayAbbreviations(["Mon", "Wed", "Fri"])).toEqual(["Mon", "Wed", "Fri"]);
	});

	test("rejects invalid day abbreviation", () => {
		expect(() => validateDayAbbreviations(["Mon", "Xyz"])).toThrow(CliError);
	});

	test("accepts lowercase day abbreviations and normalizes to title case", () => {
		expect(validateDayAbbreviations(["mon", "wed", "fri"])).toEqual(["Mon", "Wed", "Fri"]);
	});

	test("accepts uppercase day abbreviations and normalizes to title case", () => {
		expect(validateDayAbbreviations(["MON", "TUE"])).toEqual(["Mon", "Tue"]);
	});

	test("accepts mixed-case day abbreviations and normalizes to title case", () => {
		expect(validateDayAbbreviations(["mOn", "tHU"])).toEqual(["Mon", "Thu"]);
	});
});

describe("validateLimit", () => {
	test("returns number for valid positive integer string", () => {
		expect(validateLimit("10")).toBe(10);
	});

	test("returns 1 for minimum valid limit", () => {
		expect(validateLimit("1")).toBe(1);
	});

	test("throws CliError for zero", () => {
		expect(() => validateLimit("0")).toThrow(CliError);
	});

	test("throws CliError for negative number", () => {
		expect(() => validateLimit("-5")).toThrow(CliError);
	});

	test("throws CliError for non-numeric string", () => {
		expect(() => validateLimit("abc")).toThrow(CliError);
	});

	test("throws CliError for decimal", () => {
		expect(() => validateLimit("1.5")).toThrow(CliError);
	});

	test("error has exitCode 6 (VALIDATION)", () => {
		try {
			validateLimit("abc");
		} catch (e) {
			expect((e as CliError).exitCode).toBe(6);
			expect((e as CliError).code).toBe("validation_error");
		}
	});

	test("error message includes the invalid value", () => {
		try {
			validateLimit("abc");
		} catch (e) {
			expect((e as CliError).message).toContain("abc");
		}
	});
});

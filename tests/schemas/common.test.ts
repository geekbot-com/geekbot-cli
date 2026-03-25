import { describe, expect, test } from "bun:test";
import {
	DayAbbreviation,
	NullableString,
	TimezoneSchema,
	UnixTimestampSchema,
} from "../../src/schemas/common.ts";

describe("UnixTimestampSchema", () => {
	test("parses valid integer timestamp", () => {
		expect(UnixTimestampSchema.parse(1700000000)).toBe(1700000000);
	});

	test("rejects non-integer (float)", () => {
		expect(() => UnixTimestampSchema.parse(3.14)).toThrow();
	});

	test("rejects string input", () => {
		expect(() => UnixTimestampSchema.parse("1700000000")).toThrow();
	});
});

describe("NullableString", () => {
	test("parses a string value", () => {
		expect(NullableString.parse("hello")).toBe("hello");
	});

	test("parses null", () => {
		expect(NullableString.parse(null)).toBeNull();
	});

	test("rejects number input", () => {
		expect(() => NullableString.parse(42)).toThrow();
	});
});

describe("DayAbbreviation", () => {
	test("parses valid day abbreviation", () => {
		expect(DayAbbreviation.parse("Mon")).toBe("Mon");
	});

	test("rejects full day name", () => {
		expect(() => DayAbbreviation.parse("Monday")).toThrow();
	});
});

describe("TimezoneSchema", () => {
	test("parses timezone string", () => {
		expect(TimezoneSchema.parse("America/New_York")).toBe("America/New_York");
	});
});

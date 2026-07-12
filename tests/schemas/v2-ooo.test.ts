import { describe, expect, test } from "bun:test";
import {
	V2OooItemResponseSchema,
	V2OooListResponseSchema,
	V2OooPeriodSchema,
} from "../../src/schemas/v2-ooo.ts";

const VALID_PERIOD = {
	id: 12,
	user_id: "U08LXSA31BJ",
	start_date: "2026-08-01",
	end_date: "2026-08-15",
	days: 15,
	timezone: "Europe/Athens",
	created_at: "2026-07-12T10:00:00+00:00",
};

describe("V2OooPeriodSchema", () => {
	test("parses a valid OOO period", () => {
		const parsed = V2OooPeriodSchema.parse(VALID_PERIOD);
		expect(parsed.id).toBe(12);
		expect(parsed.user_id).toBe("U08LXSA31BJ");
		expect(parsed.start_date).toBe("2026-08-01");
		expect(parsed.end_date).toBe("2026-08-15");
		expect(parsed.days).toBe(15);
	});

	test("parses null timezone and created_at", () => {
		const parsed = V2OooPeriodSchema.parse({
			...VALID_PERIOD,
			timezone: null,
			created_at: null,
		});
		expect(parsed.timezone).toBeNull();
		expect(parsed.created_at).toBeNull();
	});

	test("rejects string id", () => {
		expect(() => V2OooPeriodSchema.parse({ ...VALID_PERIOD, id: "12" })).toThrow();
	});

	test("rejects missing user_id", () => {
		const { user_id: _userId, ...rest } = VALID_PERIOD;
		expect(() => V2OooPeriodSchema.parse(rest)).toThrow();
	});

	test("rejects non-numeric days", () => {
		expect(() => V2OooPeriodSchema.parse({ ...VALID_PERIOD, days: "15" })).toThrow();
	});
});

describe("V2OooListResponseSchema", () => {
	test("parses a list envelope with periods", () => {
		const parsed = V2OooListResponseSchema.parse({
			data: [VALID_PERIOD],
			next_cursor: "tok",
			has_more: true,
		});
		expect(parsed.data.length).toBe(1);
		expect(parsed.next_cursor).toBe("tok");
		expect(parsed.has_more).toBe(true);
	});

	test("parses null next_cursor", () => {
		const parsed = V2OooListResponseSchema.parse({
			data: [],
			next_cursor: null,
			has_more: false,
		});
		expect(parsed.next_cursor).toBeNull();
	});

	test("rejects envelope missing has_more", () => {
		expect(() => V2OooListResponseSchema.parse({ data: [], next_cursor: null })).toThrow();
	});
});

describe("V2OooItemResponseSchema", () => {
	test("parses an item envelope", () => {
		const parsed = V2OooItemResponseSchema.parse({ data: VALID_PERIOD });
		expect(parsed.data.id).toBe(12);
	});

	test("rejects a bare period without envelope", () => {
		expect(() => V2OooItemResponseSchema.parse(VALID_PERIOD)).toThrow();
	});
});

import { describe, expect, test } from "bun:test";
import { StandupListSchema, StandupSchema } from "../../src/schemas/standup.ts";

const BASE_STANDUP = {
	id: 1,
	name: "Daily",
	channel: "#general",
	time: "10:00",
	timezone: "UTC",
	days: ["Mon"],
	questions: [],
	users: [],
	personalised: false,
	confidential: false,
	anonymous: false,
};

describe("StandupSchema", () => {
	test("converts wait_time from seconds to minutes", () => {
		const standup = StandupSchema.parse({ ...BASE_STANDUP, wait_time: 600 });
		expect(standup.wait_time).toBe(10);
	});

	test("handles 0 wait_time", () => {
		const standup = StandupSchema.parse({ ...BASE_STANDUP, wait_time: 0 });
		expect(standup.wait_time).toBe(0);
	});

	test("P2-1: preserves -1 wait_time sentinel without dividing", () => {
		const standup = StandupSchema.parse({ ...BASE_STANDUP, wait_time: -1 });
		expect(standup.wait_time).toBe(-1);
	});

	test("preserves all other fields", () => {
		const standup = StandupSchema.parse({ ...BASE_STANDUP, wait_time: 60 });
		expect(standup.name).toBe("Daily");
		expect(standup.channel).toBe("#general");
		expect(standup.days).toEqual(["Mon"]);
	});

	test("preserves optional extended API fields through transform", () => {
		const standup = StandupSchema.parse({
			...BASE_STANDUP,
			wait_time: 60,
			channel_ready: true,
			draft: false,
			paused: false,
			users_total: 5,
			webhooks: [],
			sync_channel_ready: true,
			sync_channel: "#general",
		});
		expect(standup.channel_ready).toBe(true);
		expect(standup.draft).toBe(false);
		expect(standup.paused).toBe(false);
		expect(standup.users_total).toBe(5);
		expect(standup.webhooks).toEqual([]);
		expect(standup.sync_channel_ready).toBe(true);
		expect(standup.sync_channel).toBe("#general");
	});

	test("parses successfully without optional extended fields", () => {
		const standup = StandupSchema.parse({ ...BASE_STANDUP, wait_time: 60 });
		expect(standup.channel_ready).toBeUndefined();
		expect(standup.draft).toBeUndefined();
		expect(standup.paused).toBeUndefined();
	});
});

describe("StandupSchema negative tests", () => {
	test("rejects missing required id field", () => {
		const { id, ...noId } = { ...BASE_STANDUP, wait_time: 60 };
		expect(() => StandupSchema.parse(noId)).toThrow();
	});

	test("rejects non-numeric id", () => {
		expect(() => StandupSchema.parse({ ...BASE_STANDUP, wait_time: 60, id: "abc" })).toThrow();
	});

	test("rejects non-numeric wait_time", () => {
		expect(() => StandupSchema.parse({ ...BASE_STANDUP, wait_time: "not-a-number" })).toThrow();
	});

	test("rejects missing wait_time", () => {
		expect(() => StandupSchema.parse(BASE_STANDUP)).toThrow();
	});

	test("rejects invalid day abbreviation in days array", () => {
		expect(() =>
			StandupSchema.parse({ ...BASE_STANDUP, wait_time: 60, days: ["Monday"] }),
		).toThrow();
	});
});

describe("StandupListSchema", () => {
	test("converts wait_time for each item in list", () => {
		const standups = StandupListSchema.parse([
			{ ...BASE_STANDUP, wait_time: 120 },
			{ ...BASE_STANDUP, id: 2, wait_time: 300 },
		]);
		expect(standups[0]?.wait_time).toBe(2);
		expect(standups[1]?.wait_time).toBe(5);
	});
});

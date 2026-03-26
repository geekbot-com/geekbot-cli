import { describe, expect, test } from "bun:test";
import { SubmittedReportSchema, TimelineReportSchema } from "../../src/schemas/report.ts";

describe("TimelineReportSchema (NORM-03)", () => {
	test("normalizes timeline report with member profile_img", () => {
		const report = TimelineReportSchema.parse({
			id: 1,
			standup_id: 10,
			timestamp: 1705312800,
			questions: [{ id: 1, answer: "done stuff", question: "What did you do?" }],
			member: { id: "U123", username: "jane", realname: "Jane", profileImg: "http://img.png" },
		});
		expect(report.member).not.toBeNull();
		expect(report.member?.profile_img).toBe("http://img.png");
	});

	test("converts timestamp to ISO created_at string", () => {
		const report = TimelineReportSchema.parse({
			id: 1,
			standup_id: 10,
			timestamp: 1705312800,
			questions: [{ id: 1, answer: "done" }],
			member: { id: "U123", username: "jane", realname: null, profileImg: "http://img.png" },
		});
		expect(report.created_at).toBe(new Date(1705312800 * 1000).toISOString());
	});

	test("includes standup_name when present", () => {
		const report = TimelineReportSchema.parse({
			id: 1,
			standup_id: 10,
			timestamp: 1705312800,
			questions: [{ id: 1, answer: "done" }],
			member: { id: "U123", username: "jane", realname: null, profileImg: "http://img.png" },
			standup_name: "Daily",
		});
		expect(report.standup_name).toBe("Daily");
	});
});

describe("SubmittedReportSchema (NORM-03)", () => {
	test("normalizes submitted report with answers -> questions", () => {
		const report = SubmittedReportSchema.parse({
			id: 2,
			standup_id: 10,
			timestamp: 1705312800,
			answers: [{ id: 1, answer: "stuff" }],
		});
		expect(report.questions.length).toBe(1);
		expect(report.questions[0].answer).toBe("stuff");
		expect(report.standup_name).toBe("");
	});

	test("normalizes member profileImg when present in POST response", () => {
		const report = SubmittedReportSchema.parse({
			id: 2,
			standup_id: 10,
			timestamp: 1705312800,
			answers: [{ id: 1, answer: "stuff" }],
			member: { id: "U123", username: "jane", realname: "Jane", profileImg: "http://img.png" },
		});
		expect(report.member).not.toBeNull();
		expect(report.member?.profile_img).toBe("http://img.png");
	});

	test("member is null when not present", () => {
		const report = SubmittedReportSchema.parse({
			id: 2,
			standup_id: 10,
			timestamp: 1705312800,
			answers: [{ id: 1, answer: "stuff" }],
		});
		expect(report.member).toBeNull();
	});
});

describe("TimelineReportSchema negative tests", () => {
	test("rejects missing timestamp", () => {
		expect(() =>
			TimelineReportSchema.parse({
				id: 1,
				standup_id: 10,
				questions: [{ id: 1, answer: "done" }],
				member: { id: "U123", username: "jane", realname: null, profileImg: "http://img.png" },
			}),
		).toThrow();
	});

	test("rejects non-numeric id", () => {
		expect(() =>
			TimelineReportSchema.parse({
				id: "not-a-number",
				standup_id: 10,
				timestamp: 1705312800,
				questions: [{ id: 1, answer: "done" }],
				member: { id: "U123", username: "jane", realname: null, profileImg: "http://img.png" },
			}),
		).toThrow();
	});
});

describe("SubmittedReportSchema negative tests", () => {
	test("rejects missing answers", () => {
		expect(() =>
			SubmittedReportSchema.parse({
				id: 2,
				standup_id: 10,
				timestamp: 1705312800,
			}),
		).toThrow();
	});

	test("rejects non-array answers", () => {
		expect(() =>
			SubmittedReportSchema.parse({
				id: 2,
				standup_id: 10,
				timestamp: 1705312800,
				answers: "not-an-array",
			}),
		).toThrow();
	});
});

describe("Unified Report shape", () => {
	test("timeline and submitted reports have identical top-level keys", () => {
		const timeline = TimelineReportSchema.parse({
			id: 1,
			standup_id: 10,
			timestamp: 1705312800,
			questions: [{ id: 1, answer: "done" }],
			member: { id: "U123", username: "jane", realname: "Jane", profileImg: "http://img.png" },
		});
		const submitted = SubmittedReportSchema.parse({
			id: 2,
			standup_id: 10,
			timestamp: 1705312800,
			answers: [{ id: 1, answer: "stuff" }],
		});
		const timelineKeys = Object.keys(timeline).sort().join(",");
		const submittedKeys = Object.keys(submitted).sort().join(",");
		expect(timelineKeys).toBe(submittedKeys);
	});
});

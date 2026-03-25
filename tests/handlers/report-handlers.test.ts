import { beforeEach, describe, expect, mock, test } from "bun:test";

// --- Mocks ---

const mockGet = mock(() => Promise.resolve([]));
const mockPost = mock(() => Promise.resolve({}));
const mockCreateHttpClient = mock(() => ({
	get: mockGet,
	post: mockPost,
	patch: mock(),
	put: mock(),
	delete: mock(),
}));

mock.module("../../src/http/client.ts", () => ({
	createHttpClient: mockCreateHttpClient,
}));

mock.module("../../src/auth/resolver.ts", () => ({
	resolveCredential: mock(() => Promise.resolve({ apiKey: "test-key", source: "env" })),
}));

// Capture writeOutput calls
const mockWriteOutput = mock(() => {});
mock.module("../../src/output/formatter.ts", () => ({
	writeOutput: mockWriteOutput,
}));

import type { GlobalOptions } from "../../src/cli/globals.ts";
import { handleReportCreate, handleReportList } from "../../src/handlers/report-handlers.ts";

const defaultGlobalOpts: GlobalOptions = {
	apiKey: undefined,
	output: "json",
	debug: false,
};

// Sample timeline report from API (raw, before schema transform)
const sampleTimelineReport = {
	id: 1001,
	standup_id: 42,
	timestamp: 1705312800,
	slack_ts: "1705312800.000000",
	channel: "general",
	questions: [
		{
			id: 201,
			question: "What did you do?",
			answer: "Built feature X",
			answer_type: "text",
			images: [],
			color: "",
		},
	],
	member: {
		id: "U123",
		username: "alice",
		realname: "Alice Smith",
		profileImg: "https://example.com/alice.jpg",
	},
	is_anonymous: false,
	standup_name: "Daily Standup",
};

// Sample submitted report from API (raw, before schema transform)
const sampleSubmittedReport = {
	id: 2001,
	standup_id: 42,
	timestamp: 1705316400,
	slack_ts: null,
	started_at: 1705316400,
	done_at: 1705316400,
	broadcasted_at: null,
	channel: "general",
	answers: [
		{
			id: 201,
			question: "What did you do?",
			answer: "Implemented Y",
			answer_type: "text",
			images: [],
			color: "",
		},
	],
	is_anonymous: false,
};

describe("handleReportList", () => {
	beforeEach(() => {
		mockGet.mockClear();
		mockPost.mockClear();
		mockCreateHttpClient.mockClear();
		mockWriteOutput.mockClear();
	});

	test("calls GET /v1/reports with no params when no filters", async () => {
		mockGet.mockResolvedValueOnce([sampleTimelineReport]);

		await handleReportList({}, defaultGlobalOpts);

		expect(mockGet).toHaveBeenCalledTimes(1);
		const [path, params] = mockGet.mock.calls[0];
		expect(path).toBe("/v1/reports");
		expect(params).toEqual({});
	});

	test("passes standup_id query param when --standup-id given", async () => {
		mockGet.mockResolvedValueOnce([sampleTimelineReport]);

		await handleReportList({ standupId: "123" }, defaultGlobalOpts);

		const [, params] = mockGet.mock.calls[0];
		expect(params).toHaveProperty("standup_id", "123");
	});

	test("passes user_id query param when --user-id given", async () => {
		mockGet.mockResolvedValueOnce([sampleTimelineReport]);

		await handleReportList({ userId: "UHNM44125" }, defaultGlobalOpts);

		const [, params] = mockGet.mock.calls[0];
		expect(params).toHaveProperty("user_id", "UHNM44125");
	});

	test("converts ISO date to unix timestamp for --before", async () => {
		mockGet.mockResolvedValueOnce([]);

		await handleReportList({ before: "2024-01-15" }, defaultGlobalOpts);

		const [, params] = mockGet.mock.calls[0];
		// parseDateFilter converts ISO to unix timestamp
		expect(params).toHaveProperty("before");
		// Should be a numeric string (unix timestamp)
		expect(/^\d+$/.test(params.before)).toBe(true);
	});

	test("passes unix timestamp as-is for --after", async () => {
		mockGet.mockResolvedValueOnce([]);

		await handleReportList({ after: "1705276800" }, defaultGlobalOpts);

		const [, params] = mockGet.mock.calls[0];
		expect(params).toHaveProperty("after", "1705276800");
	});

	test("passes limit query param", async () => {
		mockGet.mockResolvedValueOnce([]);

		await handleReportList({ limit: "10" }, defaultGlobalOpts);

		const [, params] = mockGet.mock.calls[0];
		expect(params).toHaveProperty("limit", "10");
	});

	test("passes all filter params simultaneously", async () => {
		mockGet.mockResolvedValueOnce([]);

		await handleReportList(
			{
				standupId: "42",
				userId: "U99ABC",
				before: "1705363200",
				after: "1705276800",
				limit: "5",
			},
			defaultGlobalOpts,
		);

		const [, params] = mockGet.mock.calls[0];
		expect(params).toHaveProperty("standup_id", "42");
		expect(params).toHaveProperty("user_id", "U99ABC");
		expect(params).toHaveProperty("before", "1705363200");
		expect(params).toHaveProperty("after", "1705276800");
		expect(params).toHaveProperty("limit", "5");
	});

	test("rejects non-numeric limit value", async () => {
		await expect(handleReportList({ limit: "abc" }, defaultGlobalOpts)).rejects.toThrow(
			"Invalid limit",
		);

		expect(mockGet).not.toHaveBeenCalled();
	});

	test("rejects negative limit value", async () => {
		await expect(handleReportList({ limit: "-5" }, defaultGlobalOpts)).rejects.toThrow(
			"Invalid limit",
		);

		expect(mockGet).not.toHaveBeenCalled();
	});

	test("rejects zero limit value", async () => {
		await expect(handleReportList({ limit: "0" }, defaultGlobalOpts)).rejects.toThrow(
			"Invalid limit",
		);

		expect(mockGet).not.toHaveBeenCalled();
	});

	test("passes standup_id, user_id, and limit together without date params", async () => {
		mockGet.mockResolvedValueOnce([]);

		await handleReportList({ standupId: "123", userId: "U456ABC", limit: "10" }, defaultGlobalOpts);

		const [path, params] = mockGet.mock.calls[0];
		expect(path).toBe("/v1/reports");
		expect(params).toEqual({ standup_id: "123", user_id: "U456ABC", limit: "10" });
	});

	test("passes date range params without standup_id or user_id", async () => {
		mockGet.mockResolvedValueOnce([]);

		await handleReportList({ after: "1705276800", before: "1705363200" }, defaultGlobalOpts);

		const [path, params] = mockGet.mock.calls[0];
		expect(path).toBe("/v1/reports");
		expect(params).toEqual({ after: "1705276800", before: "1705363200" });
	});

	test("truncates decimal limit via parseInt (1.5 becomes 1)", async () => {
		mockGet.mockResolvedValueOnce([]);

		await handleReportList({ limit: "1.5" }, defaultGlobalOpts);

		const [, params] = mockGet.mock.calls[0];
		expect(params).toHaveProperty("limit", "1");
	});

	test("truncates scientific notation limit via parseInt (1e10 becomes 1)", async () => {
		mockGet.mockResolvedValueOnce([]);

		await handleReportList({ limit: "1e10" }, defaultGlobalOpts);

		const [, params] = mockGet.mock.calls[0];
		expect(params).toHaveProperty("limit", "1");
	});

	test("accepts very large integer limit", async () => {
		mockGet.mockResolvedValueOnce([]);

		await handleReportList({ limit: "999999999" }, defaultGlobalOpts);

		const [, params] = mockGet.mock.calls[0];
		expect(params).toHaveProperty("limit", "999999999");
	});

	test("writes successList envelope with parsed reports", async () => {
		mockGet.mockResolvedValueOnce([sampleTimelineReport]);

		await handleReportList({}, defaultGlobalOpts);

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		expect(Array.isArray(envelope.data)).toBe(true);
		expect(envelope.data.length).toBe(1);
		expect(envelope.data[0].id).toBe(1001);
		expect(envelope.data[0].member).not.toBeNull();
	});

	test("parses reports with image objects in answers", async () => {
		const reportWithImages = {
			...sampleTimelineReport,
			questions: [
				{
					id: 201,
					question: "What did you do?",
					answer: "Built feature X",
					answer_type: "text",
					images: [{ title: "screenshot", image_url: "https://example.com/img.png" }],
					color: "",
				},
			],
		};
		mockGet.mockResolvedValueOnce([reportWithImages]);

		await handleReportList({}, defaultGlobalOpts);

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		expect(envelope.data[0].questions[0].images).toEqual([
			{ title: "screenshot", image_url: "https://example.com/img.png" },
		]);
	});
});

describe("handleReportCreate", () => {
	beforeEach(() => {
		mockGet.mockClear();
		mockPost.mockClear();
		mockCreateHttpClient.mockClear();
		mockWriteOutput.mockClear();
	});

	test("parses shorthand answers and sends POST with correct body", async () => {
		mockPost.mockResolvedValueOnce(sampleSubmittedReport);

		await handleReportCreate(
			{
				standupId: "123",
				answers: '{"101":"Done X"}',
			},
			defaultGlobalOpts,
		);

		expect(mockPost).toHaveBeenCalledTimes(1);
		const [path, body] = mockPost.mock.calls[0];
		expect(path).toBe("/v1/reports");
		expect(body).toEqual({
			standup_id: 123,
			answers: { "101": { text: "Done X" } },
		});
	});

	test("receipt has operation=created and undo=null", async () => {
		mockPost.mockResolvedValueOnce(sampleSubmittedReport);

		await handleReportCreate(
			{
				standupId: "42",
				answers: '{"201":"Built feature"}',
			},
			defaultGlobalOpts,
		);

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		expect(envelope.metadata.operation).toBe("created");
		expect(envelope.metadata.undo).toBeNull();
	});

	test("validates standup_id is numeric before API call", async () => {
		await expect(
			handleReportCreate(
				{
					standupId: "abc",
					answers: '{"101":"Done X"}',
				},
				defaultGlobalOpts,
			),
		).rejects.toThrow();

		// Should not have made an API call
		expect(mockPost).not.toHaveBeenCalled();
	});

	test("creates report with normalized member=null from submitted schema", async () => {
		mockPost.mockResolvedValueOnce(sampleSubmittedReport);

		await handleReportCreate(
			{
				standupId: "42",
				answers: '{"201":"Built feature"}',
			},
			defaultGlobalOpts,
		);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.data.member).toBeNull();
	});
});

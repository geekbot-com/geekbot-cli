import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

// --- Mocks ---

const mockGet = mock(() => Promise.resolve({ data: [], next_cursor: null, has_more: false }));
const mockPost = mock(() => Promise.resolve({ data: {} }));
const mockPatch = mock(() => Promise.resolve({ data: {} }));
const mockDelete = mock(() => Promise.resolve(null));
const mockCreateHttpClient = mock(() => ({
	get: mockGet,
	post: mockPost,
	patch: mockPatch,
	put: mock(),
	delete: mockDelete,
}));

mock.module("../../src/http/client.ts", () => ({
	createHttpClient: mockCreateHttpClient,
}));

mock.module("../../src/auth/resolver.ts", () => ({
	resolveCredential: mock(() => Promise.resolve({ apiKey: "test-key", source: "env" })),
}));

const mockWriteOutput = mock(() => {});
mock.module("../../src/output/formatter.ts", () => ({
	writeOutput: mockWriteOutput,
}));

import type { GlobalOptions } from "../../src/cli/globals.ts";
import {
	handleReportCreate,
	handleReportDelete,
	handleReportEdit,
	handleReportGet,
	handleReportList,
} from "../../src/handlers/report-handlers.ts";

const defaultGlobalOpts: GlobalOptions = {
	apiKey: undefined,
	output: "json",
	debug: false,
};

const sampleV2Report = {
	id: 1001,
	standup_id: 42,
	standup_name: "Daily Standup",
	user_id: "U123",
	posted_at: "2026-05-20T10:00:00+00:00",
	is_anonymous: false,
	is_confidential: false,
	answers: [
		{
			id: 201,
			question_id: 301,
			question: "What did you do?",
			answer: "Built feature X",
		},
	],
};

afterAll(() => {
	mock.restore();
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resetMocks() {
	mockGet.mockClear();
	mockPost.mockClear();
	mockPatch.mockClear();
	mockDelete.mockClear();
	mockCreateHttpClient.mockClear();
	mockWriteOutput.mockClear();
	mockGet.mockImplementation(() =>
		Promise.resolve({ data: [sampleV2Report], next_cursor: null, has_more: false }),
	);
	mockPost.mockImplementation(() => Promise.resolve({ data: sampleV2Report }));
	mockPatch.mockImplementation(() => Promise.resolve({ data: sampleV2Report }));
	mockDelete.mockImplementation(() => Promise.resolve(null));
}

describe("handleReportList", () => {
	beforeEach(resetMocks);

	test("calls GET /v2/reports without params when no filters", async () => {
		await handleReportList({}, defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/reports", undefined);
	});

	test("maps --before/--after to v2 until/since", async () => {
		await handleReportList({ before: "2026-01-31", after: "2026-01-01" }, defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/reports", {
			until: "2026-01-31",
			since: "2026-01-01",
		});
	});

	test("passes --view, --page-size, --cursor through to v2", async () => {
		await handleReportList(
			{ view: "summary", pageSize: "50", cursor: "abc123" },
			defaultGlobalOpts,
		);
		expect(mockGet).toHaveBeenCalledWith("/v2/reports", {
			view: "summary",
			limit: "50",
			cursor: "abc123",
		});
	});

	test("--limit is an alias for --page-size", async () => {
		await handleReportList({ limit: "75" }, defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/reports", { limit: "75" });
	});

	test("rejects invalid --view", async () => {
		await expect(handleReportList({ view: "bogus" }, defaultGlobalOpts)).rejects.toThrow(
			/Invalid value for --view/,
		);
	});

	test("surfaces next_cursor and has_more in writeOutput metadata", async () => {
		mockGet.mockImplementation(() =>
			Promise.resolve({ data: [sampleV2Report], next_cursor: "next-token", has_more: true }),
		);
		await handleReportList({}, defaultGlobalOpts);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as { metadata: Record<string, unknown> };
		expect(envelope.metadata.next_cursor).toBe("next-token");
		expect(envelope.metadata.has_more).toBe(true);
	});
});

describe("handleReportCreate", () => {
	beforeEach(resetMocks);

	test("POST /v2/reports with answers array and Idempotency-Key header", async () => {
		await handleReportCreate({ standupId: "42", answers: '{"301":"Done X"}' }, defaultGlobalOpts);
		const call = mockPost.mock.calls[0] as [string, unknown, Record<string, string>];
		expect(call[0]).toBe("/v2/reports");
		expect(call[1]).toEqual({
			standup_id: 42,
			answers: [{ question_id: 301, text: "Done X" }],
		});
		expect(call[2]["Idempotency-Key"]).toMatch(UUID_RE);
	});

	test("rejects --answers with non-numeric question ids", async () => {
		await expect(
			handleReportCreate({ standupId: "42", answers: '{"abc":"x"}' }, defaultGlobalOpts),
		).rejects.toThrow(/Invalid question id "abc"/);
	});
});

describe("handleReportGet", () => {
	beforeEach(resetMocks);

	test("GET /v2/reports/{id} with no params by default", async () => {
		mockGet.mockImplementation(() => Promise.resolve({ data: sampleV2Report }));
		await handleReportGet("1001", {}, defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/reports/1001", undefined);
	});

	test("passes --view through", async () => {
		mockGet.mockImplementation(() => Promise.resolve({ data: sampleV2Report }));
		await handleReportGet("1001", { view: "summary" }, defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/reports/1001", { view: "summary" });
	});
});

describe("handleReportEdit", () => {
	beforeEach(resetMocks);

	test("PATCH /v2/reports/{id} with answers and Idempotency-Key header", async () => {
		await handleReportEdit("1001", { answers: '{"301":"Corrected"}' }, defaultGlobalOpts);
		const call = mockPatch.mock.calls[0] as [string, unknown, Record<string, string>];
		expect(call[0]).toBe("/v2/reports/1001");
		expect(call[1]).toEqual({ answers: [{ question_id: 301, text: "Corrected" }] });
		expect(call[2]["Idempotency-Key"]).toMatch(UUID_RE);
	});
});

describe("handleReportDelete", () => {
	beforeEach(resetMocks);

	test("DELETE /v2/reports/{id} with Idempotency-Key header when --yes given", async () => {
		await handleReportDelete("1001", { yes: true }, defaultGlobalOpts);
		const call = mockDelete.mock.calls[0] as [string, Record<string, string>];
		expect(call[0]).toBe("/v2/reports/1001");
		expect(call[1]["Idempotency-Key"]).toMatch(UUID_RE);
	});

	test("refuses to delete without --yes", async () => {
		await expect(handleReportDelete("1001", {}, defaultGlobalOpts)).rejects.toThrow(
			/Refusing to delete without confirmation/,
		);
		expect(mockDelete).not.toHaveBeenCalled();
	});
});

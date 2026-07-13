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
	handleOooCreate,
	handleOooDelete,
	handleOooEdit,
	handleOooGet,
	handleOooList,
} from "../../src/handlers/ooo-handlers.ts";

const defaultGlobalOpts: GlobalOptions = {
	apiKey: undefined,
};

const sampleOooPeriod = {
	id: 12,
	user_id: "U08LXSA31BJ",
	start_date: "2026-08-01",
	end_date: "2026-08-15",
	days: 15,
	timezone: "Europe/Athens",
	created_at: "2026-07-12T10:00:00+00:00",
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
		Promise.resolve({ data: [sampleOooPeriod], next_cursor: null, has_more: false }),
	);
	mockPost.mockImplementation(() => Promise.resolve({ data: sampleOooPeriod }));
	mockPatch.mockImplementation(() => Promise.resolve({ data: sampleOooPeriod }));
	mockDelete.mockImplementation(() => Promise.resolve(null));
}

describe("handleOooList", () => {
	beforeEach(resetMocks);

	test("calls GET /v2/ooo without params when no filters", async () => {
		await handleOooList({}, defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/ooo", undefined);
	});

	test("maps --user, --cursor, --page-size to user_id, cursor, limit", async () => {
		await handleOooList({ user: "U08LXSA31BJ", cursor: "tok", pageSize: "50" }, defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/ooo", {
			user_id: "U08LXSA31BJ",
			cursor: "tok",
			limit: "50",
		});
	});

	test("maps --after/--before to since/until and omits them by default", async () => {
		await handleOooList({ after: "2026-01-01", before: "2026-07-01" }, defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/ooo", {
			since: "2026-01-01",
			until: "2026-07-01",
		});

		mockGet.mockClear();
		await handleOooList({}, defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/ooo", undefined);
	});

	test("rejects invalid --after/--before dates before any request", async () => {
		await expect(handleOooList({ after: "not-a-date" }, defaultGlobalOpts)).rejects.toThrow(
			/Invalid date for --after/,
		);
		await expect(handleOooList({ before: "2026-02-31" }, defaultGlobalOpts)).rejects.toThrow(
			/Invalid date for --before/,
		);
		expect(mockGet).not.toHaveBeenCalled();
	});

	test("rejects invalid --user value", async () => {
		await expect(handleOooList({ user: "not-a-slack-id" }, defaultGlobalOpts)).rejects.toThrow(
			/Invalid user ID/,
		);
		expect(mockGet).not.toHaveBeenCalled();
	});

	test("rejects invalid --page-size value", async () => {
		await expect(handleOooList({ pageSize: "0" }, defaultGlobalOpts)).rejects.toThrow(
			/Invalid limit/,
		);
		expect(mockGet).not.toHaveBeenCalled();
	});

	test("surfaces next_cursor and has_more in writeOutput metadata", async () => {
		mockGet.mockImplementation(() =>
			Promise.resolve({ data: [sampleOooPeriod], next_cursor: "next-token", has_more: true }),
		);
		await handleOooList({}, defaultGlobalOpts);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			data: Array<{ id: number }>;
			metadata: Record<string, unknown>;
		};
		expect(envelope.data[0]?.id).toBe(12);
		expect(envelope.metadata.next_cursor).toBe("next-token");
		expect(envelope.metadata.has_more).toBe(true);
	});
});

describe("handleOooGet", () => {
	beforeEach(resetMocks);

	test("GET /v2/ooo/{id} by id, no query params", async () => {
		mockGet.mockImplementation(() => Promise.resolve({ data: sampleOooPeriod }));
		await handleOooGet("12", defaultGlobalOpts);
		expect(mockGet).toHaveBeenCalledWith("/v2/ooo/12");
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as { ok: boolean; data: { id: number } };
		expect(envelope.ok).toBe(true);
		expect(envelope.data.id).toBe(12);
	});

	test("rejects non-numeric id", async () => {
		await expect(handleOooGet("abc", defaultGlobalOpts)).rejects.toThrow(/Invalid OOO period ID/);
		expect(mockGet).not.toHaveBeenCalled();
	});
});

describe("handleOooCreate", () => {
	beforeEach(resetMocks);

	test("POST /v2/ooo with snake_case dates and Idempotency-Key header", async () => {
		await handleOooCreate({ startDate: "2026-08-01", endDate: "2026-08-15" }, defaultGlobalOpts);
		const call = mockPost.mock.calls[0] as [string, unknown, Record<string, string>];
		expect(call[0]).toBe("/v2/ooo");
		expect(call[1]).toEqual({ start_date: "2026-08-01", end_date: "2026-08-15" });
		expect(call[2]["Idempotency-Key"]).toMatch(UUID_RE);
	});

	test("includes user_id in body when --user given", async () => {
		await handleOooCreate(
			{ startDate: "2026-08-01", endDate: "2026-08-15", user: "U08LXSA31BJ" },
			defaultGlobalOpts,
		);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.user_id).toBe("U08LXSA31BJ");
	});

	test("returns receipt with operation=created and undo delete command", async () => {
		await handleOooCreate({ startDate: "2026-08-01", endDate: "2026-08-15" }, defaultGlobalOpts);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			metadata: { operation: string; undo: string | null };
		};
		expect(envelope.metadata.operation).toBe("created");
		expect(envelope.metadata.undo).toBe("geekbot ooo delete 12 --yes");
	});

	test("undo command is by-id even when creating for another member", async () => {
		await handleOooCreate(
			{ startDate: "2026-08-01", endDate: "2026-08-15", user: "U08LXSA31BJ" },
			defaultGlobalOpts,
		);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			metadata: { undo: string | null };
		};
		expect(envelope.metadata.undo).toBe("geekbot ooo delete 12 --yes");
	});

	test("rejects non-YYYY-MM-DD start date", async () => {
		await expect(
			handleOooCreate({ startDate: "01/08/2026", endDate: "2026-08-15" }, defaultGlobalOpts),
		).rejects.toThrow(/Invalid date for --start-date/);
		expect(mockPost).not.toHaveBeenCalled();
	});

	test("rejects impossible calendar date", async () => {
		await expect(
			handleOooCreate({ startDate: "2026-02-31", endDate: "2026-03-05" }, defaultGlobalOpts),
		).rejects.toThrow(/not a valid calendar date/);
		expect(mockPost).not.toHaveBeenCalled();
	});
});

describe("handleOooEdit", () => {
	beforeEach(resetMocks);

	test("PATCH /v2/ooo/{id} with both dates and Idempotency-Key header", async () => {
		await handleOooEdit(
			"12",
			{ startDate: "2026-08-03", endDate: "2026-08-20" },
			defaultGlobalOpts,
		);
		const call = mockPatch.mock.calls[0] as [string, unknown, Record<string, string>];
		expect(call[0]).toBe("/v2/ooo/12");
		expect(call[1]).toEqual({ start_date: "2026-08-03", end_date: "2026-08-20" });
		expect(call[2]["Idempotency-Key"]).toMatch(UUID_RE);
	});

	test("sends only end_date when --start-date omitted", async () => {
		await handleOooEdit("12", { endDate: "2026-08-20" }, defaultGlobalOpts);
		const [, body] = mockPatch.mock.calls[0] as [string, Record<string, unknown>];
		expect(body).toEqual({ end_date: "2026-08-20" });
	});

	test("rejects edit with neither --start-date nor --end-date", async () => {
		await expect(handleOooEdit("12", {}, defaultGlobalOpts)).rejects.toThrow(
			/At least one of --start-date or --end-date is required/,
		);
		expect(mockPatch).not.toHaveBeenCalled();
	});

	test("returns receipt with operation=updated and undo=null", async () => {
		await handleOooEdit("12", { endDate: "2026-08-20" }, defaultGlobalOpts);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			metadata: { operation: string; undo: string | null };
		};
		expect(envelope.metadata.operation).toBe("updated");
		expect(envelope.metadata.undo).toBeNull();
	});
});

describe("handleOooDelete", () => {
	beforeEach(resetMocks);

	test("DELETE /v2/ooo/{id} with Idempotency-Key header when --yes given", async () => {
		await handleOooDelete("12", { yes: true }, defaultGlobalOpts);
		const call = mockDelete.mock.calls[0] as [string, Record<string, string>];
		expect(call[0]).toBe("/v2/ooo/12");
		expect(call[1]["Idempotency-Key"]).toMatch(UUID_RE);
	});

	test("refuses to delete without --yes", async () => {
		await expect(handleOooDelete("12", {}, defaultGlobalOpts)).rejects.toThrow(
			/Refusing to delete without confirmation/,
		);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	test("returns receipt with operation=deleted and the deleted id", async () => {
		await handleOooDelete("12", { yes: true }, defaultGlobalOpts);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			data: { id: number };
			metadata: { operation: string; undo: string | null };
		};
		expect(envelope.data.id).toBe(12);
		expect(envelope.metadata.operation).toBe("deleted");
		expect(envelope.metadata.undo).toBeNull();
	});

	test("rejects non-numeric id", async () => {
		await expect(handleOooDelete("abc", {}, defaultGlobalOpts)).rejects.toThrow(
			/Invalid OOO period ID/,
		);
		expect(mockDelete).not.toHaveBeenCalled();
	});
});

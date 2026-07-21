import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Standup handlers test suite.
 *
 * Strategy: mock resolveCredential, createHttpClient, and writeOutput
 * to isolate handler logic. Each handler test verifies:
 * - correct API endpoint called
 * - correct parameters/body sent
 * - response parsed through schema
 * - output envelope shape
 * - receipt metadata for mutations
 */

// ── Fixtures ──────────────────────────────────────────────────────────

/** Raw standup as returned by API (wait_time in seconds) */
const RAW_STANDUP = {
	id: 42,
	name: "Daily Standup",
	channel: "#engineering",
	time: "10:00:00",
	timezone: "America/New_York",
	days: ["Mon", "Wed", "Fri"],
	questions: [
		{
			id: 101,
			color: "#000",
			text: "What did you do?",
			schedule: null,
			answer_type: "text",
			answer_choices: [],
			hasAnswers: false,
			is_random: false,
			random_texts: [],
			prefilled_by: null,
			text_id: null,
			preconditions: [],
			label: null,
			flavor: "default",
		},
	],
	users: [],
	wait_time: 600, // 10 minutes in seconds
	personalised: false,
	confidential: false,
	anonymous: false,
	sync_channel_members: true,
};

/** V2 standup shape as returned by /v2/standups */
const V2_STANDUP = {
	id: 42,
	name: "Daily Standup",
	state: "active" as const,
	time: "10:00:00",
	wait_time: 10,
	timezone: "America/New_York",
	days: ["Mon", "Wed", "Fri"],
	broadcast_channel: { id: "C123", name: "engineering" },
	is_anonymous: false,
	is_confidential: false,
	owner: "U123",
	created: "2026-01-01T00:00:00+00:00",
	updated: "2026-01-01T00:00:00+00:00",
	members: [{ id: "U123" }, { id: "U456" }],
};

// ── Mock Setup ────────────────────────────────────────────────────────

const mockGet = mock(() => Promise.resolve(RAW_STANDUP));
const mockPost = mock(() => Promise.resolve(RAW_STANDUP));

const mockClient = {
	get: mockGet,
	post: mockPost,
};

mock.module("../../src/auth/resolver.ts", () => ({
	resolveCredential: mock(() => Promise.resolve({ apiKey: "test-key", source: "env" })),
}));

mock.module("../../src/http/client.ts", () => ({
	createHttpClient: mock(() => mockClient),
}));

// Capture writeOutput calls
const mockWriteOutput = mock(() => {});
mock.module("../../src/output/formatter.ts", () => ({
	writeOutput: mockWriteOutput,
}));

const mockBuildNotFoundSuggestion = mock(() =>
	Promise.resolve("Available standups: 42 (Daily Standup)"),
);
mock.module("../../src/errors/not-found-helper.ts", () => ({
	buildNotFoundSuggestion: mockBuildNotFoundSuggestion,
}));

// Import handlers AFTER mocks are set up
const {
	handleStandupList,
	handleStandupGet,
	handleStandupCreate,
	handleStandupStart,
	handleStandupParticipation,
} = await import("../../src/handlers/standup-handlers.ts");

const { CliError } = await import("../../src/errors/cli-error.ts");

const GLOBAL_OPTS = { apiKey: undefined };

beforeEach(() => {
	mockGet.mockReset();
	mockPost.mockReset();
	mockWriteOutput.mockReset();

	// Reset to defaults
	mockGet.mockImplementation(() => Promise.resolve(RAW_STANDUP));
	mockPost.mockImplementation(() => Promise.resolve(RAW_STANDUP));
	mockBuildNotFoundSuggestion.mockReset();
	mockBuildNotFoundSuggestion.mockImplementation(() =>
		Promise.resolve("Available standups: 42 (Daily Standup)"),
	);
});

afterAll(() => {
	mock.restore();
});

// ── handleStandupList (v2) ───────────────────────────────────────────

describe("handleStandupList", () => {
	test("calls GET /v2/standups with no params by default", async () => {
		mockGet.mockImplementation(() =>
			Promise.resolve({ data: [V2_STANDUP], next_cursor: null, has_more: false }),
		);
		await handleStandupList({}, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v2/standups", undefined);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			data: Array<{ id: number }>;
			metadata: Record<string, unknown>;
		};
		expect(envelope.data[0]?.id).toBe(42);
		expect(envelope.metadata.has_more).toBe(false);
		expect(envelope.metadata.next_cursor).toBeNull();
	});

	test("passes v2 server-side filters as query params", async () => {
		mockGet.mockImplementation(() =>
			Promise.resolve({ data: [], next_cursor: null, has_more: false }),
		);
		await handleStandupList(
			{
				state: "active",
				isAnonymous: "true",
				broadcastChannel: "C123",
				createdSince: "2026-01-01",
				createdUntil: "2026-02-01",
				cursor: "tok",
				pageSize: "50",
				include: "questions",
			},
			GLOBAL_OPTS,
		);
		expect(mockGet).toHaveBeenCalledWith("/v2/standups", {
			state: "active",
			is_anonymous: "true",
			broadcast_channel: "C123",
			created_since: "2026-01-01",
			created_until: "2026-02-01",
			cursor: "tok",
			limit: "50",
			include: "questions",
		});
	});
});

// ── handleStandupGet (v2) ────────────────────────────────────────────

describe("handleStandupGet", () => {
	test("calls GET /v2/standups/<id> with no params by default", async () => {
		mockGet.mockImplementation(() => Promise.resolve({ data: V2_STANDUP }));
		await handleStandupGet("42", {}, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v2/standups/42", undefined);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as { ok: boolean; data: { id: number } };
		expect(envelope.ok).toBe(true);
		expect(envelope.data.id).toBe(42);
	});

	test("passes --include through as query param", async () => {
		mockGet.mockImplementation(() => Promise.resolve({ data: V2_STANDUP }));
		await handleStandupGet("42", { include: "questions" }, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v2/standups/42", { include: "questions" });
	});
});

// ── handleStandupCreate ──────────────────────────────────────────────

describe("handleStandupCreate (v2)", () => {
	const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const MINIMAL_OPTS = { channel: "#eng", questions: '["What did you do?"]' };

	beforeEach(() => {
		mockPost.mockImplementation(() => Promise.resolve({ data: V2_STANDUP }));
	});

	test("POSTs /v2/standups with broadcast_channel, days, time, questions", async () => {
		await handleStandupCreate(MINIMAL_OPTS, GLOBAL_OPTS);

		expect(mockPost).toHaveBeenCalledTimes(1);
		const call = mockPost.mock.calls[0] as [
			string,
			Record<string, unknown>,
			Record<string, string>,
		];
		expect(call[0]).toBe("/v2/standups");
		expect(call[1].broadcast_channel).toBe("#eng");
		expect(call[1].time).toBe("10:00:00");
		expect(call[1].days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
		expect(call[1].questions).toEqual([{ text: "What did you do?" }]);
		expect(call[2]["Idempotency-Key"]).toMatch(UUID_RE);
	});

	test("omits name when not provided (api applies default)", async () => {
		await handleStandupCreate(MINIMAL_OPTS, GLOBAL_OPTS);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect("name" in body).toBe(false);
	});

	test("passes --name through", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, name: "Daily" }, GLOBAL_OPTS);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.name).toBe("Daily");
	});

	test("--time HH:MM is normalized to HH:MM:SS", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, time: "09:30" }, GLOBAL_OPTS);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.time).toBe("09:30:00");
	});

	test("passes --timezone through", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, timezone: "Europe/London" }, GLOBAL_OPTS);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.timezone).toBe("Europe/London");
	});

	test("--questions accepts native v2 shape with choices", async () => {
		await handleStandupCreate(
			{
				...MINIMAL_OPTS,
				questions: '[{"text":"Pick","choices":["A","B"]}]',
			},
			GLOBAL_OPTS,
		);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.questions).toEqual([{ text: "Pick", choices: ["A", "B"] }]);
	});

	test("--users sends explicit member list (no sync_channel)", async () => {
		await handleStandupCreate(
			{ ...MINIMAL_OPTS, users: "U1,U2", syncChannel: "#ignored" },
			GLOBAL_OPTS,
		);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.users).toEqual(["U1", "U2"]);
		expect("sync_channel" in body).toBe(false);
	});

	test("--sync-channel sets sync_channel when no --users", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, syncChannel: "#alt" }, GLOBAL_OPTS);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.sync_channel).toBe("#alt");
		expect("users" in body).toBe(false);
	});

	test("--is-anonymous sends is_anonymous=true", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, isAnonymous: true }, GLOBAL_OPTS);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.is_anonymous).toBe(true);
	});

	test("returns receipt with operation=created and undo=null", async () => {
		await handleStandupCreate(MINIMAL_OPTS, GLOBAL_OPTS);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			metadata: { operation: string; undo: string | null };
		};
		expect(envelope.metadata.operation).toBe("created");
		expect(envelope.metadata.undo).toBeNull();
	});

	test("throws CliError for invalid user IDs", async () => {
		try {
			await handleStandupCreate({ ...MINIMAL_OPTS, users: "bad,ids" }, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			expect((err as InstanceType<typeof CliError>).code).toBe("validation_error");
		}
	});
});

// ── handleStandupStart ───────────────────────────────────────────────

describe("handleStandupStart", () => {
	beforeEach(() => {
		mockGet.mockImplementation(() => Promise.resolve({ data: V2_STANDUP }));
		mockPost.mockImplementation(() => Promise.resolve("ok"));
	});

	test("pre-fetches standup (v2) then sends POST to /v1/standups/<id>/start", async () => {
		await handleStandupStart("42", {}, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v2/standups/42");
		expect(mockPost).toHaveBeenCalledTimes(1);
		const [path, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(path).toBe("/v1/standups/42/start");
		expect(body).toEqual({});
	});

	test("returns receipt with operation=started and undo=null", async () => {
		await handleStandupStart("42", {}, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			metadata: { operation: string; undo: string | null };
		};
		expect(envelope.metadata.operation).toBe("started");
		expect(envelope.metadata.undo).toBeNull();
	});

	test("sends users array in body when users option provided", async () => {
		await handleStandupStart("42", { users: "U1,U2" }, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.users).toEqual(["U1", "U2"]);
	});

	test("accepts Slack-style user IDs", async () => {
		await handleStandupStart("42", { users: "U123,U456" }, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.users).toEqual(["U123", "U456"]);
	});

	test("throws CliError for invalid user IDs", async () => {
		try {
			await handleStandupStart("42", { users: "bad,ids" }, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("validation_error");
		}
	});

	test("uses pre-fetched standup data for output (not POST response)", async () => {
		await handleStandupStart("42", {}, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			data: { id: number; name: string };
		};
		expect(envelope.data.id).toBe(42);
		expect(envelope.data.name).toBe("Daily Standup");
	});
});

// ── 404 Suggestion Enrichment ─────────────────────────────────────────

describe("404 suggestion enrichment", () => {
	const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
		path: "/v2/standups/99999",
		status: 404,
	});

	test("handleStandupGet enriches 404 with suggestion from buildNotFoundSuggestion", async () => {
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() =>
			Promise.resolve("Available standups: 42 (Daily Standup)"),
		);

		try {
			await handleStandupGet("99999", {}, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("not_found");
			expect(cliErr.suggestion).toBe("Available standups: 42 (Daily Standup)");
		}

		expect(mockBuildNotFoundSuggestion).toHaveBeenCalledTimes(1);
	});

	test("handleStandupGet re-throws original error when suggestion is null", async () => {
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() => Promise.resolve(null));

		try {
			await handleStandupGet("99999", {}, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("not_found");
			expect(cliErr.suggestion).toBeUndefined();
		}
	});

	test("non-404 errors pass through without enrichment", async () => {
		const serverError = new CliError("Server error", "server_error", 4, true);
		mockGet.mockImplementation(() => Promise.reject(serverError));

		try {
			await handleStandupGet("42", {}, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("server_error");
		}

		expect(mockBuildNotFoundSuggestion).not.toHaveBeenCalled();
	});
});

// ── handleStandupParticipation (v2) ──────────────────────────────────

describe("handleStandupParticipation", () => {
	const PART = {
		data: [
			{
				standup_id: 42,
				is_poll: false,
				date: "2026-04-27",
				expected: 5,
				responded: 4,
				participation_rate: 0.8,
				excluded: { vacation: 1 },
			},
		],
		next_cursor: null,
		has_more: false,
	};

	test("calls the v2 participation endpoint with mapped params", async () => {
		mockGet.mockImplementation(() => Promise.resolve(PART));
		await handleStandupParticipation(
			"42",
			{ since: "2026-01-01", until: "2026-02-01", cursor: "C2", pageSize: "30" },
			GLOBAL_OPTS,
		);
		expect(mockGet).toHaveBeenCalledWith("/v2/standups/42/participation", {
			since: "2026-01-01",
			until: "2026-02-01",
			cursor: "C2",
			limit: "30",
		});
	});

	test("no params yields an undefined query and surfaces pagination metadata", async () => {
		mockGet.mockImplementation(() => Promise.resolve(PART));
		await handleStandupParticipation("42", {}, GLOBAL_OPTS);
		expect(mockGet).toHaveBeenCalledWith("/v2/standups/42/participation", undefined);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			data: Array<{ participation_rate: number }>;
			metadata: Record<string, unknown>;
		};
		expect(envelope.data[0]?.participation_rate).toBe(0.8);
		expect(envelope.metadata.has_more).toBe(false);
	});

	test("throws validation error for a non-numeric ID", async () => {
		await expect(handleStandupParticipation("abc", {}, GLOBAL_OPTS)).rejects.toBeInstanceOf(
			CliError,
		);
	});
});

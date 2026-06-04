import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Poll handlers test suite.
 *
 * Mocks resolveCredential, createHttpClient, writeOutput. Verifies:
 * - correct v2 endpoint called (list/get/votes)
 * - poll create still uses v1 (no v2 equivalent)
 * - server-side filter mapping
 * - platform_not_supported / poll_not_found error layering
 */

// ── Fixtures ──────────────────────────────────────────────────────────

/** v1 poll shape (used by handlePollCreate response parsing). */
const V1_POLL = {
	id: 456,
	name: "Lunch Poll",
	time: "12:00:00",
	timezone: "UTC",
	questions: [
		{
			id: 1,
			text: "Where should we eat?",
			answer_type: "multiple_choice",
			answer_choices: ["Pizza", "Sushi", "Tacos"],
			add_own_options: false,
			one_option_limit: true,
		},
	],
	users: [],
	recurrence: null,
	sync_channel_members: true,
	sync_channel: "#team",
	dm_mode: false,
	anonymous: false,
	intro: "Time to vote!",
	creator: {
		id: "1",
		email: "creator@test.com",
		username: "creator",
		realname: "Creator",
		role: "admin",
		profile_img: "https://example.com/img.png",
	},
	users_total: 5,
	paused: false,
};

/** v2 poll shape (used by handlePollList/handlePollGet). */
const V2_POLL = {
	id: 456,
	name: "Lunch Poll",
	state: "active" as const,
	time: "12:00:00",
	timezone: "UTC",
	days: ["Mon", "Wed"],
	broadcast_channel: { id: "C123", name: "team" },
	is_anonymous: false,
	owner: "U999",
	created: "2026-01-01T00:00:00+00:00",
	updated: "2026-01-01T00:00:00+00:00",
	members: [{ id: "U1" }, { id: "U2" }],
};

const V2_VOTES = {
	poll_id: 456,
	poll_name: "Lunch Poll",
	is_anonymous: false,
	instances: [
		{
			instance_id: 100,
			date: "2026-01-15",
			questions: [
				{
					question_id: 1,
					text: "Where should we eat?",
					answer_type: "multiple_choice" as const,
					total_responses: 5,
					total_responders: 5,
					choices: [{ text: "Pizza", votes: 3, voters: ["U1", "U2", "U3"] }],
				},
			],
		},
	],
};

// ── Mock Setup ────────────────────────────────────────────────────────

const mockGet = mock(() =>
	Promise.resolve({ data: [V2_POLL], next_cursor: null, has_more: false }),
);
const mockPost = mock(() => Promise.resolve(V1_POLL));
const mockPatch = mock(() => Promise.resolve({}));
const mockPut = mock(() => Promise.resolve({}));
const mockDelete = mock(() => Promise.resolve(null));

const mockClient = {
	get: mockGet,
	post: mockPost,
	patch: mockPatch,
	put: mockPut,
	delete: mockDelete,
};

mock.module("../../src/auth/resolver.ts", () => ({
	resolveCredential: mock(() => Promise.resolve({ apiKey: "test-key", source: "env" })),
}));

mock.module("../../src/http/client.ts", () => ({
	createHttpClient: mock(() => mockClient),
}));

const mockWriteOutput = mock(() => {});
mock.module("../../src/output/formatter.ts", () => ({
	writeOutput: mockWriteOutput,
}));

const mockBuildNotFoundSuggestion = mock(() =>
	Promise.resolve("Available polls: 456 (Lunch Poll)"),
);
mock.module("../../src/errors/not-found-helper.ts", () => ({
	buildNotFoundSuggestion: mockBuildNotFoundSuggestion,
}));

const { handlePollList, handlePollGet, handlePollCreate, handlePollVotes } = await import(
	"../../src/handlers/poll-handlers.ts"
);

const { CliError } = await import("../../src/errors/cli-error.ts");

const GLOBAL_OPTS = { apiKey: undefined };

beforeEach(() => {
	mockGet.mockReset();
	mockPost.mockReset();
	mockPatch.mockReset();
	mockPut.mockReset();
	mockDelete.mockReset();
	mockWriteOutput.mockReset();
	mockBuildNotFoundSuggestion.mockReset();

	mockGet.mockImplementation(() =>
		Promise.resolve({ data: [V2_POLL], next_cursor: null, has_more: false }),
	);
	mockPost.mockImplementation(() => Promise.resolve(V1_POLL));
	mockBuildNotFoundSuggestion.mockImplementation(() =>
		Promise.resolve("Available polls: 456 (Lunch Poll)"),
	);
});

afterAll(() => {
	mock.restore();
});

// ── handlePollList ────────────────────────────────────────────────────

describe("handlePollList", () => {
	test("calls GET /v2/polls with no params by default", async () => {
		await handlePollList({}, GLOBAL_OPTS);
		expect(mockGet).toHaveBeenCalledWith("/v2/polls", undefined);
		const envelope = mockWriteOutput.mock.calls[0]?.[0] as {
			data: unknown[];
			metadata: Record<string, unknown>;
		};
		expect(envelope.metadata.has_more).toBe(false);
	});

	test("passes v2 server-side filters as query params", async () => {
		mockGet.mockImplementation(() =>
			Promise.resolve({ data: [], next_cursor: null, has_more: false }),
		);
		await handlePollList(
			{
				state: "active",
				isAnonymous: "false",
				broadcastChannel: "C999",
				createdSince: "2026-01-01",
				cursor: "tok",
				pageSize: "25",
				include: "questions",
			},
			GLOBAL_OPTS,
		);
		expect(mockGet).toHaveBeenCalledWith("/v2/polls", {
			state: "active",
			is_anonymous: "false",
			broadcast_channel: "C999",
			created_since: "2026-01-01",
			cursor: "tok",
			limit: "25",
			include: "questions",
		});
	});

	test("throws platform_not_supported on 404 from /v2/polls", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v2/polls",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));

		await expect(handlePollList({}, GLOBAL_OPTS)).rejects.toMatchObject({
			code: "platform_not_supported",
		});
	});
});

// ── handlePollGet ─────────────────────────────────────────────────────

describe("handlePollGet", () => {
	test("calls GET /v2/polls/<id> with no params by default", async () => {
		mockGet.mockImplementation(() => Promise.resolve({ data: V2_POLL }));
		await handlePollGet("456", {}, GLOBAL_OPTS);
		expect(mockGet).toHaveBeenCalledWith("/v2/polls/456", undefined);
	});

	test("passes --include through", async () => {
		mockGet.mockImplementation(() => Promise.resolve({ data: V2_POLL }));
		await handlePollGet("456", { include: "questions" }, GLOBAL_OPTS);
		expect(mockGet).toHaveBeenCalledWith("/v2/polls/456", { include: "questions" });
	});

	test("throws validation error for non-numeric ID", async () => {
		await expect(handlePollGet("abc", {}, GLOBAL_OPTS)).rejects.toBeInstanceOf(CliError);
	});

	test("enriches 404 from /v2/polls/<id> with poll_not_found", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v2/polls/99999",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));

		await expect(handlePollGet("99999", {}, GLOBAL_OPTS)).rejects.toMatchObject({
			code: "poll_not_found",
			suggestion: "Available polls: 456 (Lunch Poll)",
		});
	});

	test("falls through to platform_not_supported when suggestion is null", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v2/polls/99999",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() => Promise.resolve(null));

		await expect(handlePollGet("99999", {}, GLOBAL_OPTS)).rejects.toMatchObject({
			code: "platform_not_supported",
		});
	});
});

// ── handlePollCreate (v2) ─────────────────────────────────────────────

describe("handlePollCreate (v2)", () => {
	const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	test("POSTs /v2/polls with broadcast_channel, question, choices, Idempotency-Key", async () => {
		mockPost.mockImplementation(() => Promise.resolve({ data: V2_POLL }));
		await handlePollCreate(
			{
				name: "Test",
				channel: "#team",
				question: "Q?",
				choices: '["A","B"]',
			},
			GLOBAL_OPTS,
		);
		const call = mockPost.mock.calls[0] as [
			string,
			Record<string, unknown>,
			Record<string, string>,
		];
		expect(call[0]).toBe("/v2/polls");
		expect(call[1].name).toBe("Test");
		expect(call[1].broadcast_channel).toBe("#team");
		expect(call[1].question).toBe("Q?");
		expect(call[1].choices).toEqual(["A", "B"]);
		expect(call[2]["Idempotency-Key"]).toMatch(UUID_RE);
	});

	test("--duration sends integer minutes", async () => {
		mockPost.mockImplementation(() => Promise.resolve({ data: V2_POLL }));
		await handlePollCreate(
			{
				name: "Test",
				channel: "#team",
				question: "Q?",
				choices: '["A","B"]',
				duration: "60",
			},
			GLOBAL_OPTS,
		);
		const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
		expect(body.duration).toBe(60);
	});

	test("rejects non-integer --duration", async () => {
		await expect(
			handlePollCreate(
				{
					name: "Test",
					channel: "#team",
					question: "Q?",
					choices: '["A","B"]',
					duration: "abc",
				},
				GLOBAL_OPTS,
			),
		).rejects.toThrow(/Invalid value for --duration/);
	});
});

// ── handlePollVotes ───────────────────────────────────────────────────

describe("handlePollVotes", () => {
	test("calls GET /v2/polls/<id>/votes with no params", async () => {
		mockGet.mockImplementation(() => Promise.resolve({ data: V2_VOTES }));
		await handlePollVotes("456", {}, GLOBAL_OPTS);
		expect(mockGet).toHaveBeenCalledWith("/v2/polls/456/votes", undefined);
	});

	test("maps --after to since and --before to until", async () => {
		mockGet.mockImplementation(() => Promise.resolve({ data: V2_VOTES }));
		await handlePollVotes("456", { after: "2026-01-01", before: "2026-02-01" }, GLOBAL_OPTS);
		expect(mockGet).toHaveBeenCalledWith("/v2/polls/456/votes", {
			since: "2026-01-01",
			until: "2026-02-01",
		});
	});

	test("enriches 404 from votes path with poll_not_found", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v2/polls/99999/votes",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));

		await expect(handlePollVotes("99999", {}, GLOBAL_OPTS)).rejects.toMatchObject({
			code: "poll_not_found",
		});
	});
});

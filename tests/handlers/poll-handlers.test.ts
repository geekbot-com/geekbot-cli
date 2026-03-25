import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Poll handlers test suite.
 *
 * Strategy: mock resolveCredential, createHttpClient, and writeOutput
 * to isolate handler logic. Each handler test verifies:
 * - correct API endpoint called
 * - correct parameters/body sent
 * - response parsed through schema
 * - output envelope shape
 * - receipt metadata for mutations
 * - platform error detection for non-Slack teams
 */

// ── Fixtures ──────────────────────────────────────────────────────────

const RAW_POLL = {
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

const RAW_VOTES_RESPONSE = {
	total_results: 10,
	questions: [
		{
			id: 1,
			text: "Where should we eat?",
			answer_type: "multiple_choice",
			categories: [],
			total_responses: 10,
			total_responders: 5,
			results: [
				{
					date: "2024-01-15",
					answers: [
						{
							text: "Pizza",
							catergory_id: "uncategorized",
							votes: 3,
							percentage: 60,
						},
						{
							text: "Sushi",
							catergory_id: "uncategorized",
							votes: 2,
							percentage: 40,
						},
					],
				},
			],
		},
	],
	instances: [
		{
			id: 100,
			date: "2024-01-15",
			answer_count: 5,
		},
	],
};

// ── Mock Setup ────────────────────────────────────────────────────────

const mockGet = mock(() => Promise.resolve(RAW_POLL));
const mockPost = mock(() => Promise.resolve(RAW_POLL));
const mockPatch = mock(() => Promise.resolve(RAW_POLL));
const mockPut = mock(() => Promise.resolve(RAW_POLL));
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

// Import handlers AFTER mocks are set up
const { handlePollList, handlePollGet, handlePollCreate, handlePollVotes } = await import(
	"../../src/handlers/poll-handlers.ts"
);

const { CliError } = await import("../../src/errors/cli-error.ts");

const GLOBAL_OPTS = {
	apiKey: undefined,
	output: "json" as const,
	debug: false,
};

beforeEach(() => {
	mockGet.mockReset();
	mockPost.mockReset();
	mockPatch.mockReset();
	mockPut.mockReset();
	mockDelete.mockReset();
	mockWriteOutput.mockReset();

	mockGet.mockImplementation(() => Promise.resolve(RAW_POLL));
	mockPost.mockImplementation(() => Promise.resolve(RAW_POLL));
	mockBuildNotFoundSuggestion.mockReset();
	mockBuildNotFoundSuggestion.mockImplementation(() =>
		Promise.resolve("Available polls: 456 (Lunch Poll)"),
	);
});

// ── handlePollList ────────────────────────────────────────────────────

describe("handlePollList", () => {
	test("calls GET /v1/polls and writes successList envelope", async () => {
		mockGet.mockImplementation(() => Promise.resolve([RAW_POLL]));
		await handlePollList(GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/polls");
		expect(mockWriteOutput).toHaveBeenCalledTimes(1);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			ok: boolean;
			data: unknown[];
			metadata: { count: number };
		};
		expect(envelope.ok).toBe(true);
		expect(Array.isArray(envelope.data)).toBe(true);
		expect(envelope.metadata.count).toBe(1);
	});

	test("throws platform error on 404 from /v1/polls", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v1/polls",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));

		try {
			await handlePollList(GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("platform_not_supported");
			expect(cliErr.message).toContain("Polls are only available for Slack teams");
		}
	});
});

// ── handlePollGet ─────────────────────────────────────────────────────

describe("handlePollGet", () => {
	test("validates ID and calls GET /v1/polls/<id>", async () => {
		await handlePollGet("456", GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/polls/456");
		expect(mockWriteOutput).toHaveBeenCalledTimes(1);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			ok: boolean;
			data: { id: number };
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.id).toBe(456);
	});

	test("throws validation error for non-numeric ID", async () => {
		try {
			await handlePollGet("abc", GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("validation_error");
		}
	});
});

// ── handlePollCreate ──────────────────────────────────────────────────

describe("handlePollCreate", () => {
	test("parses choices, calls POST /v1/polls, returns receipt", async () => {
		await handlePollCreate(
			{
				name: "Lunch",
				channel: "#team",
				question: "Where?",
				choices: '["Pizza", "Sushi"]',
			},
			GLOBAL_OPTS,
		);

		expect(mockPost).toHaveBeenCalledTimes(1);
		const [path, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(path).toBe("/v1/polls");
		expect(body.name).toBe("Lunch");
		expect(body.channel).toBe("#team");
		expect(body.question).toBe("Where?");
		expect(body.choices).toEqual(["Pizza", "Sushi"]);
	});

	test("returns receipt with operation=created and undo=null", async () => {
		await handlePollCreate(
			{
				name: "Lunch",
				channel: "#team",
				question: "Where?",
				choices: '["Pizza", "Sushi"]',
			},
			GLOBAL_OPTS,
		);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			metadata: { operation: string; undo: string | null };
		};
		expect(envelope.metadata.operation).toBe("created");
		expect(envelope.metadata.undo).toBeNull();
	});
});

// ── handlePollVotes ───────────────────────────────────────────────────

describe("handlePollVotes", () => {
	test("calls GET /v1/polls/<id>/votes and returns success envelope", async () => {
		mockGet.mockImplementation(() => Promise.resolve(RAW_VOTES_RESPONSE));
		await handlePollVotes("456", {}, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/polls/456/votes", undefined);
		expect(mockWriteOutput).toHaveBeenCalledTimes(1);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			ok: boolean;
			data: { total_results: number };
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.total_results).toBe(10);
	});

	test("maps --after to 'from' param and --before to 'to' param", async () => {
		mockGet.mockImplementation(() => Promise.resolve(RAW_VOTES_RESPONSE));
		await handlePollVotes("456", { after: "1705276800", before: "1705363200" }, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/polls/456/votes", {
			from: "1705276800",
			to: "1705363200",
		});
	});

	test("passes both from and to params and returns envelope when both date filters provided", async () => {
		mockGet.mockImplementation(() => Promise.resolve(RAW_VOTES_RESPONSE));
		await handlePollVotes("456", { after: "2024-01-15", before: "2024-01-16" }, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/polls/456/votes", {
			from: "1705276800",
			to: "1705363200",
		});
		expect(mockWriteOutput).toHaveBeenCalledTimes(1);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			ok: boolean;
			data: { total_results: number };
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.total_results).toBe(10);
	});

	test("passes undefined params when neither date filter provided", async () => {
		mockGet.mockImplementation(() => Promise.resolve(RAW_VOTES_RESPONSE));
		await handlePollVotes("456", {}, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/polls/456/votes", undefined);
		expect(mockWriteOutput).toHaveBeenCalledTimes(1);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			ok: boolean;
			data: { total_results: number };
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.total_results).toBe(10);
	});

	test("enriches 404 from /v1/polls/<id>/votes with poll_not_found, not platform error", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v1/polls/456/votes",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() =>
			Promise.resolve("Available polls: 456 (Lunch Poll)"),
		);

		try {
			await handlePollVotes("456", {}, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("poll_not_found");
			expect(cliErr.suggestion).toContain("Available polls");
		}
	});
});

// ── 404 Suggestion Enrichment ─────────────────────────────────────────

describe("404 suggestion enrichment", () => {
	test("handlePollGet enriches 404 with poll_not_found code and suggestion", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v1/polls/99999",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() =>
			Promise.resolve("Available polls: 456 (Lunch Poll)"),
		);

		try {
			await handlePollGet("99999", GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("poll_not_found");
			expect(cliErr.suggestion).toContain("Available polls");
		}

		expect(mockBuildNotFoundSuggestion).toHaveBeenCalledTimes(1);
	});

	test("handlePollGet falls through to platform error when suggestion returns null", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v1/polls/99999",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() => Promise.resolve(null));

		try {
			await handlePollGet("99999", GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			// When enrichment returns null, the original not_found error propagates
			// and wrapPlatformError catches it as platform_not_supported
			expect(cliErr.code).toBe("platform_not_supported");
		}
	});

	test("handlePollVotes enriches 404 with poll_not_found code and suggestion", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v1/polls/99999/votes",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() =>
			Promise.resolve("Available polls: 456 (Lunch Poll)"),
		);

		try {
			await handlePollVotes("99999", {}, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("poll_not_found");
			expect(cliErr.suggestion).toContain("Available polls");
		}

		expect(mockBuildNotFoundSuggestion).toHaveBeenCalledTimes(1);
	});

	test("handlePollVotes falls through to platform error when suggestion returns null", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v1/polls/99999/votes",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() => Promise.resolve(null));

		try {
			await handlePollVotes("99999", {}, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("platform_not_supported");
		}
	});
});

// ── Platform vs Poll Not-Found Distinction ───────────────────────────

describe("platform 404 vs poll-specific 404 distinction", () => {
	test("handlePollList 404 produces platform_not_supported (no enrichment layer)", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v1/polls",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));

		try {
			await handlePollList(GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("platform_not_supported");
			expect(cliErr.message).toContain("Polls are only available for Slack teams");
		}
	});

	test("handlePollGet 404 for specific poll produces poll_not_found, not platform_not_supported", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v1/polls/99999",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() =>
			Promise.resolve("Available polls: 456 (Lunch Poll)"),
		);

		try {
			await handlePollGet("99999", GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("poll_not_found");
			expect(cliErr.message).toBe("Not found");
			expect(cliErr.suggestion).toContain("Available polls");
		}
	});

	test("handlePollVotes 404 for specific poll produces poll_not_found, not platform_not_supported", async () => {
		const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
			path: "/v1/polls/99999/votes",
			status: 404,
		});
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() =>
			Promise.resolve("Available polls: 456 (Lunch Poll)"),
		);

		try {
			await handlePollVotes("99999", {}, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("poll_not_found");
			expect(cliErr.suggestion).toContain("Available polls");
		}
	});

	test("non-404 errors pass through wrapPlatformError without being converted", async () => {
		const serverError = new CliError("Server error", "server_error", 9, true);
		mockGet.mockImplementation(() => Promise.reject(serverError));

		try {
			await handlePollList(GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("server_error");
		}
	});
});

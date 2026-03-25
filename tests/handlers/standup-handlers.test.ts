import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Standup } from "../../src/schemas/standup.ts";

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

/** Normalized standup (after schema transform) for receipt expectations */
const _NORMALIZED_STANDUP: Standup = {
	...RAW_STANDUP,
	wait_time: 10, // 600s / 60 = 10min
};

// ── Mock Setup ────────────────────────────────────────────────────────

const mockGet = mock(() => Promise.resolve(RAW_STANDUP));
const mockPost = mock(() => Promise.resolve(RAW_STANDUP));
const mockPatch = mock(() => Promise.resolve(RAW_STANDUP));
const mockPut = mock(() => Promise.resolve(RAW_STANDUP));
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
	handleStandupUpdate,
	handleStandupReplace,
	handleStandupDelete,
	handleStandupDuplicate,
	handleStandupStart,
} = await import("../../src/handlers/standup-handlers.ts");

const { CliError } = await import("../../src/errors/cli-error.ts");

const GLOBAL_OPTS = { apiKey: undefined, output: "json" as const, debug: false };

beforeEach(() => {
	mockGet.mockReset();
	mockPost.mockReset();
	mockPatch.mockReset();
	mockPut.mockReset();
	mockDelete.mockReset();
	mockWriteOutput.mockReset();

	// Reset to defaults
	mockGet.mockImplementation(() => Promise.resolve(RAW_STANDUP));
	mockPost.mockImplementation(() => Promise.resolve(RAW_STANDUP));
	mockPatch.mockImplementation(() => Promise.resolve(RAW_STANDUP));
	mockPut.mockImplementation(() => Promise.resolve(RAW_STANDUP));
	mockDelete.mockImplementation(() => Promise.resolve(null));
	mockBuildNotFoundSuggestion.mockReset();
	mockBuildNotFoundSuggestion.mockImplementation(() =>
		Promise.resolve("Available standups: 42 (Daily Standup)"),
	);
});

// ── handleStandupList ────────────────────────────────────────────────

describe("handleStandupList", () => {
	test("calls GET /v1/standups and writes successList envelope", async () => {
		mockGet.mockImplementation(() => Promise.resolve([RAW_STANDUP]));
		await handleStandupList({}, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/standups", undefined);
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

	test("passes admin=true query param when admin option set", async () => {
		mockGet.mockImplementation(() => Promise.resolve([RAW_STANDUP]));
		await handleStandupList({ admin: true }, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/standups", { admin: "true" });
	});

	test("normalizes wait_time from seconds to minutes in list items", async () => {
		mockGet.mockImplementation(() => Promise.resolve([RAW_STANDUP]));
		await handleStandupList({}, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: Array<{ wait_time: number }>;
		};
		expect(envelope.data[0]!.wait_time).toBe(10);
	});

	test("--brief strips to only id, name, channel", async () => {
		mockGet.mockImplementation(() => Promise.resolve([RAW_STANDUP]));
		await handleStandupList({ brief: true }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: Array<Record<string, unknown>>;
		};
		expect(envelope.data).toHaveLength(1);
		const item = envelope.data[0]!;
		expect(Object.keys(item).sort()).toEqual(["channel", "id", "name"]);
		expect(item.id).toBe(42);
		expect(item.name).toBe("Daily Standup");
		expect(item.channel).toBe("#engineering");
		expect(item.questions).toBeUndefined();
		expect(item.users).toBeUndefined();
		expect(item.time).toBeUndefined();
		expect(item.timezone).toBeUndefined();
		expect(item.days).toBeUndefined();
	});

	test("--name filters by case-insensitive substring match", async () => {
		const second = { ...RAW_STANDUP, id: 43, name: "Weekly Retro", channel: "#retro" };
		mockGet.mockImplementation(() => Promise.resolve([RAW_STANDUP, second]));
		await handleStandupList({ name: "daily" }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: Array<{ id: number }>;
			metadata: { count: number };
		};
		expect(envelope.data).toHaveLength(1);
		expect(envelope.data[0]!.id).toBe(42);
		expect(envelope.metadata.count).toBe(1);
	});

	test("--channel filters by case-insensitive substring match", async () => {
		const second = { ...RAW_STANDUP, id: 43, name: "Weekly Retro", channel: "#retro" };
		mockGet.mockImplementation(() => Promise.resolve([RAW_STANDUP, second]));
		await handleStandupList({ channel: "retro" }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: Array<{ id: number }>;
		};
		expect(envelope.data).toHaveLength(1);
		expect(envelope.data[0]!.id).toBe(43);
	});

	test("--mine fetches /v1/me and filters by user membership", async () => {
		const withUser = {
			...RAW_STANDUP,
			users: [
				{
					id: "U123",
					role: "member",
					email: "me@test.com",
					username: "me",
					realname: "Me",
					profile_img: "https://example.com/img.png",
				},
			],
		};
		const withoutUser = { ...RAW_STANDUP, id: 43, name: "Other", users: [] };
		mockGet.mockImplementation((path: string) => {
			if (path === "/v1/me")
				return Promise.resolve({
					user: {
						id: "U123",
						username: "me",
						realname: "Me",
						firstname: "Me",
						email: "me@test.com",
						profile_img: "https://example.com/img.png",
						timezone: "UTC",
						is_admin: false,
						is_billing_admin: false,
						role: "member",
					},
					team: { id: 1, name: "Test" },
				});
			return Promise.resolve([withUser, withoutUser]);
		});

		await handleStandupList({ mine: true }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: Array<{ id: number }>;
		};
		expect(envelope.data).toHaveLength(1);
		expect(envelope.data[0]!.id).toBe(42);
		expect(mockGet).toHaveBeenCalledWith("/v1/me");
	});

	test("--mine returns empty array when user has no matching standups", async () => {
		const standupNoUser = { ...RAW_STANDUP, users: [] };
		mockGet.mockImplementation((path: string) => {
			if (path === "/v1/me")
				return Promise.resolve({
					user: {
						id: "U999",
						username: "ghost",
						realname: "Ghost",
						firstname: "Ghost",
						email: "ghost@test.com",
						profile_img: "https://example.com/img.png",
						timezone: "UTC",
						is_admin: false,
						is_billing_admin: false,
						role: "member",
					},
					team: { id: 1, name: "Test" },
				});
			return Promise.resolve([standupNoUser]);
		});

		await handleStandupList({ mine: true }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: unknown[];
			metadata: { count: number };
		};
		expect(envelope.data).toHaveLength(0);
		expect(envelope.metadata.count).toBe(0);
	});

	test("--member filters standups by user ID", async () => {
		const withMember = {
			...RAW_STANDUP,
			users: [
				{
					id: "UHNM44125",
					role: "member",
					email: "jenny@geekbot.com",
					username: "Jenny",
					realname: "Jenny Ralli",
					profile_img: "https://example.com/jenny.png",
				},
			],
		};
		const withoutMember = { ...RAW_STANDUP, id: 43, name: "Other", users: [] };
		mockGet.mockImplementation(() => Promise.resolve([withMember, withoutMember]));

		await handleStandupList({ member: "UHNM44125" }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: Array<{ id: number }>;
		};
		expect(envelope.data).toHaveLength(1);
		expect(envelope.data[0]!.id).toBe(42);
	});

	test("--member with no matches returns empty list", async () => {
		const standupNoUser = { ...RAW_STANDUP, users: [] };
		mockGet.mockImplementation(() => Promise.resolve([standupNoUser]));

		await handleStandupList({ member: "U_NONEXISTENT" }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: unknown[];
			metadata: { count: number };
		};
		expect(envelope.data).toHaveLength(0);
		expect(envelope.metadata.count).toBe(0);
	});

	test("--brief combined with --name filters then projects", async () => {
		const second = { ...RAW_STANDUP, id: 43, name: "Weekly Retro", channel: "#retro" };
		mockGet.mockImplementation(() => Promise.resolve([RAW_STANDUP, second]));
		await handleStandupList({ brief: true, name: "daily" }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: Array<Record<string, unknown>>;
		};
		expect(envelope.data).toHaveLength(1);
		expect(envelope.data[0]!.id).toBe(42);
		expect(envelope.data[0]!.questions).toBeUndefined();
	});
	test("--limit caps results after filters", async () => {
		const items = [
			{ ...RAW_STANDUP, id: 1 },
			{ ...RAW_STANDUP, id: 2 },
			{ ...RAW_STANDUP, id: 3 },
		];
		mockGet.mockImplementation(() => Promise.resolve(items));
		await handleStandupList({ limit: "2" }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: Array<{ id: number }>;
			metadata: { count: number };
		};
		expect(envelope.data).toHaveLength(2);
		expect(envelope.data[0]!.id).toBe(1);
		expect(envelope.data[1]!.id).toBe(2);
		expect(envelope.metadata.count).toBe(2);
	});

	test("--limit with invalid value throws validation error", async () => {
		mockGet.mockImplementation(() => Promise.resolve([RAW_STANDUP]));
		await expect(handleStandupList({ limit: "abc" }, GLOBAL_OPTS)).rejects.toThrow(CliError);
	});

	test("--limit with zero throws validation error", async () => {
		mockGet.mockImplementation(() => Promise.resolve([RAW_STANDUP]));
		await expect(handleStandupList({ limit: "0" }, GLOBAL_OPTS)).rejects.toThrow(CliError);
	});

	test("--limit combined with --brief and --name applies all three", async () => {
		const items = [
			{ ...RAW_STANDUP, id: 1, name: "Daily A" },
			{ ...RAW_STANDUP, id: 2, name: "Daily B" },
			{ ...RAW_STANDUP, id: 3, name: "Weekly Retro" },
		];
		mockGet.mockImplementation(() => Promise.resolve(items));
		await handleStandupList({ name: "daily", limit: "1", brief: true }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: Array<Record<string, unknown>>;
			metadata: { count: number };
		};
		expect(envelope.data).toHaveLength(1);
		expect(envelope.data[0]!.id).toBe(1);
		expect(Object.keys(envelope.data[0]!).sort()).toEqual(["channel", "id", "name"]);
	});
});

// ── handleStandupGet ─────────────────────────────────────────────────

describe("handleStandupGet", () => {
	test("calls GET /v1/standups/<id> and writes success envelope", async () => {
		await handleStandupGet("42", GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/standups/42");
		expect(mockWriteOutput).toHaveBeenCalledTimes(1);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			ok: boolean;
			data: { id: number };
		};
		expect(envelope.ok).toBe(true);
		expect(envelope.data.id).toBe(42);
	});

	test("normalizes wait_time from seconds to minutes", async () => {
		await handleStandupGet("42", GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: { wait_time: number };
		};
		expect(envelope.data.wait_time).toBe(10);
	});
});

// ── handleStandupCreate ──────────────────────────────────────────────

describe("handleStandupCreate", () => {
	const MINIMAL_OPTS = { name: "Daily", channel: "#eng", questions: '["What did you do?"]' };

	test("sends POST /v1/standups with name and channel", async () => {
		await handleStandupCreate(MINIMAL_OPTS, GLOBAL_OPTS);

		expect(mockPost).toHaveBeenCalledTimes(1);
		const [path, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(path).toBe("/v1/standups");
		expect(body.name).toBe("Daily");
		expect(body.channel).toBe("#eng");
	});

	test("uses default time 10:00 when --time omitted", async () => {
		await handleStandupCreate(MINIMAL_OPTS, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.time).toBe("10:00:00");
	});

	test("uses default weekdays when --days omitted", async () => {
		await handleStandupCreate(MINIMAL_OPTS, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
	});

	test("with only --name and --questions uses sensible defaults for time and days", async () => {
		await handleStandupCreate(MINIMAL_OPTS, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.time).toBe("10:00:00");
		expect(body.days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
		expect(body.questions).toEqual([{ question: "What did you do?" }]);
	});

	test("returns receipt with operation=created and undo=delete command", async () => {
		await handleStandupCreate(MINIMAL_OPTS, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			metadata: { operation: string; undo: string };
		};
		expect(envelope.metadata.operation).toBe("created");
		expect(envelope.metadata.undo).toBe("geekbot standup delete 42 --yes");
	});

	test("validates and appends :00 to time", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, time: "09:30" }, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.time).toBe("09:30:00");
	});

	test("passes timezone through", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, timezone: "Europe/London" }, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.timezone).toBe("Europe/London");
	});

	test("splits and validates days", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, days: "Mon,Wed,Fri" }, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.days).toEqual(["Mon", "Wed", "Fri"]);
	});

	test("parses questions JSON via parseQuestionsInput", async () => {
		await handleStandupCreate(
			{
				...MINIMAL_OPTS,
				questions: '["What did you do?", "Any blockers?"]',
			},
			GLOBAL_OPTS,
		);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.questions).toEqual([
			{ question: "What did you do?" },
			{ question: "Any blockers?" },
		]);
	});

	test("splits users and sets sync_channel_members=false", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, users: "U1,U2,U3" }, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.users).toEqual(["U1", "U2", "U3"]);
		expect(body.sync_channel_members).toBe(false);
	});

	test("sets sync_channel_members=true when no users specified", async () => {
		await handleStandupCreate(MINIMAL_OPTS, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.sync_channel_members).toBe(true);
	});

	test("passes waitTime as number", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, waitTime: "15" }, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.wait_time).toBe(15);
	});

	test("accepts Slack-style user IDs", async () => {
		await handleStandupCreate({ ...MINIMAL_OPTS, users: "U123,U456" }, GLOBAL_OPTS);
		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.users).toEqual(["U123", "U456"]);
	});

	test("throws CliError for invalid user IDs", async () => {
		try {
			await handleStandupCreate({ ...MINIMAL_OPTS, users: "bad,ids" }, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("validation_error");
		}
	});

	test("throws CliError for non-numeric waitTime", async () => {
		try {
			await handleStandupCreate({ ...MINIMAL_OPTS, waitTime: "foo" }, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("validation_error");
			expect(cliErr.message).toContain("foo");
		}
	});
});

// ── handleStandupUpdate ──────────────────────────────────────────────

describe("handleStandupUpdate", () => {
	test("pre-fetches current standup then sends PATCH", async () => {
		await handleStandupUpdate("42", { name: "New Name" }, GLOBAL_OPTS);

		// First call: pre-fetch GET
		expect(mockGet).toHaveBeenCalledWith("/v1/standups/42");
		// Second call: PATCH
		expect(mockPatch).toHaveBeenCalledTimes(1);
		const [path, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(path).toBe("/v1/standups/42");
		expect(body.name).toBe("New Name");
	});

	test("returns receipt with operation=updated and undo command", async () => {
		await handleStandupUpdate("42", { name: "New Name" }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			metadata: { operation: string; undo: string };
		};
		expect(envelope.metadata.operation).toBe("updated");
		expect(envelope.metadata.undo).toContain("geekbot standup update 42");
		expect(envelope.metadata.undo).toContain("--name 'Daily Standup'");
	});

	test("validates and appends :00 to time in body", async () => {
		await handleStandupUpdate("42", { time: "14:00" }, GLOBAL_OPTS);

		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.time).toBe("14:00:00");
	});

	test("splits and validates days in body", async () => {
		await handleStandupUpdate("42", { days: "Tue,Thu" }, GLOBAL_OPTS);

		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.days).toEqual(["Tue", "Thu"]);
	});

	test("passes channel in PATCH body", async () => {
		await handleStandupUpdate("42", { channel: "#new" }, GLOBAL_OPTS);
		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.channel).toBe("#new");
	});

	test("passes timezone in PATCH body", async () => {
		await handleStandupUpdate("42", { timezone: "US/Pacific" }, GLOBAL_OPTS);
		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.timezone).toBe("US/Pacific");
	});

	test("passes waitTime as number in PATCH body", async () => {
		await handleStandupUpdate("42", { waitTime: "10" }, GLOBAL_OPTS);
		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.wait_time).toBe(10);
	});

	test("throws CliError for non-numeric waitTime", async () => {
		try {
			await handleStandupUpdate("42", { waitTime: "abc" }, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("validation_error");
			expect(cliErr.message).toContain("abc");
		}
	});

	test("throws CliError when no update options provided", async () => {
		try {
			await handleStandupUpdate("42", {}, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("validation_error");
			expect(cliErr.message).toContain("No update options");
		}
		// Should NOT have made any API calls
		expect(mockGet).not.toHaveBeenCalled();
		expect(mockPatch).not.toHaveBeenCalled();
	});

	test("only includes non-undefined options in body", async () => {
		await handleStandupUpdate("42", { name: "New" }, GLOBAL_OPTS);

		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body).toEqual({ name: "New" });
	});

	test("sends timezone + days together in PATCH body", async () => {
		await handleStandupUpdate(
			"42",
			{ timezone: "Europe/Berlin", days: "Mon,Wed,Fri" },
			GLOBAL_OPTS,
		);

		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body).toEqual({ timezone: "Europe/Berlin", days: ["Mon", "Wed", "Fri"] });
	});

	test("sends time + timezone without days in PATCH body", async () => {
		await handleStandupUpdate("42", { time: "09:00", timezone: "Asia/Tokyo" }, GLOBAL_OPTS);

		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body).toEqual({ time: "09:00:00", timezone: "Asia/Tokyo" });
	});

	test("sends all 7 options together in PATCH body", async () => {
		await handleStandupUpdate(
			"42",
			{
				name: "All Fields",
				channel: "#all",
				time: "08:30",
				timezone: "US/Pacific",
				days: "Mon,Tue,Wed,Thu,Fri",
				users: "U123,U456",
				waitTime: "20",
			},
			GLOBAL_OPTS,
		);

		const [path, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(path).toBe("/v1/standups/42");
		expect(body).toEqual({
			name: "All Fields",
			channel: "#all",
			time: "08:30:00",
			timezone: "US/Pacific",
			days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
			users: ["U123", "U456"],
			sync_channel_members: false,
			wait_time: 20,
		});
	});

	test("passes users as validated Slack ID list in PATCH body", async () => {
		await handleStandupUpdate("42", { users: "U111,U222,U333" }, GLOBAL_OPTS);
		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.users).toEqual(["U111", "U222", "U333"]);
		expect(body.sync_channel_members).toBe(false);
	});

	test("users-only update does not include other fields", async () => {
		await handleStandupUpdate("42", { users: "U111" }, GLOBAL_OPTS);
		const [, body] = mockPatch.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body).toEqual({ users: ["U111"], sync_channel_members: false });
	});
});

// ── handleStandupReplace ─────────────────────────────────────────────

describe("handleStandupReplace", () => {
	test("pre-fetches then sends PUT with full body", async () => {
		await handleStandupReplace("42", { name: "Replaced", channel: "#new" }, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/standups/42");
		expect(mockPut).toHaveBeenCalledTimes(1);
		const [path, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(path).toBe("/v1/standups/42");
		expect(body.name).toBe("Replaced");
		expect(body.channel).toBe("#new");
	});

	test("validates and appends :00 to time in PUT body", async () => {
		await handleStandupReplace("42", { name: "R", channel: "#c", time: "14:00" }, GLOBAL_OPTS);
		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.time).toBe("14:00:00");
	});

	test("passes timezone in PUT body", async () => {
		await handleStandupReplace(
			"42",
			{ name: "R", channel: "#c", timezone: "US/Eastern" },
			GLOBAL_OPTS,
		);
		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.timezone).toBe("US/Eastern");
	});

	test("splits and validates days in PUT body", async () => {
		await handleStandupReplace("42", { name: "R", channel: "#c", days: "Mon,Fri" }, GLOBAL_OPTS);
		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.days).toEqual(["Mon", "Fri"]);
	});

	test("parses questions JSON in PUT body", async () => {
		await handleStandupReplace(
			"42",
			{ name: "R", channel: "#c", questions: '["Q1"]' },
			GLOBAL_OPTS,
		);
		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.questions).toEqual([{ question: "Q1" }]);
	});

	test("splits users and sets sync_channel_members=false", async () => {
		await handleStandupReplace("42", { name: "R", channel: "#c", users: "U1,U2" }, GLOBAL_OPTS);
		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.users).toEqual(["U1", "U2"]);
		expect(body.sync_channel_members).toBe(false);
	});

	test("passes waitTime as number in PUT body", async () => {
		await handleStandupReplace("42", { name: "R", channel: "#c", waitTime: "5" }, GLOBAL_OPTS);
		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.wait_time).toBe(5);
	});

	test("throws CliError for invalid user IDs", async () => {
		try {
			await handleStandupReplace(
				"42",
				{ name: "R", channel: "#c", users: "bad,ids" },
				GLOBAL_OPTS,
			);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("validation_error");
		}
	});

	test("throws CliError for non-numeric waitTime", async () => {
		try {
			await handleStandupReplace("42", { name: "R", channel: "#c", waitTime: "foo" }, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("validation_error");
		}
	});

	test("returns receipt with operation=updated and undo=replace command", async () => {
		await handleStandupReplace("42", { name: "Replaced", channel: "#new" }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			metadata: { operation: string; undo: string };
		};
		expect(envelope.metadata.operation).toBe("updated");
		expect(envelope.metadata.undo).toContain("geekbot standup replace 42");
	});

	test("PUT body always includes time (uses default 10:00 when not provided)", async () => {
		await handleStandupReplace("42", { name: "R", channel: "#c" }, GLOBAL_OPTS);
		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.time).toBe("10:00:00");
	});

	test("PUT body always includes days (uses default weekdays when not provided)", async () => {
		await handleStandupReplace("42", { name: "R", channel: "#c" }, GLOBAL_OPTS);
		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
	});

	test("PUT body carries forward existing questions when --questions not provided", async () => {
		await handleStandupReplace("42", { name: "R", channel: "#c" }, GLOBAL_OPTS);
		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.questions).toBeDefined();
		expect(Array.isArray(body.questions)).toBe(true);
	});

	test("carries forward pre-fetched standup questions verbatim when --questions omitted", async () => {
		const customStandup = {
			...RAW_STANDUP,
			questions: [
				{ ...RAW_STANDUP.questions[0]!, id: 101, text: "What did you do?" },
				{ ...RAW_STANDUP.questions[0]!, id: 102, text: "Any blockers?" },
			],
		};
		mockGet.mockImplementation(() => Promise.resolve(customStandup));

		await handleStandupReplace("42", { name: "R", channel: "#c" }, GLOBAL_OPTS);

		const [, body] = mockPut.mock.calls[0]! as [string, Record<string, unknown>];
		const questions = body.questions as Array<{ id: number; text: string }>;
		expect(questions).toHaveLength(2);
		expect(questions[0]!.text).toBe("What did you do?");
		expect(questions[1]!.text).toBe("Any blockers?");
	});
});

// ── handleStandupDelete ──────────────────────────────────────────────

describe("handleStandupDelete", () => {
	test("throws CliError with confirmation_required when --yes not provided, before any API call", async () => {
		try {
			await handleStandupDelete("42", {}, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("confirmation_required");
			expect(cliErr.exitCode).toBe(6); // ExitCode.VALIDATION
			expect(cliErr.message).toContain("42");
		}
		// Should NOT have made any API calls
		expect(mockGet).not.toHaveBeenCalled();
		expect(mockDelete).not.toHaveBeenCalled();
	});

	test("pre-fetches, sends DELETE, returns receipt when --yes provided", async () => {
		await handleStandupDelete("42", { yes: true }, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/standups/42");
		expect(mockDelete).toHaveBeenCalledWith("/v1/standups/42");

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			metadata: { operation: string; undo: string };
		};
		expect(envelope.metadata.operation).toBe("deleted");
		expect(envelope.metadata.undo).toContain("geekbot standup create");
	});
});

// ── handleStandupDuplicate ───────────────────────────────────────────

describe("handleStandupDuplicate", () => {
	test("sends POST to /v1/standups/<id>/duplicate with name", async () => {
		await handleStandupDuplicate("42", { name: "Copy" }, GLOBAL_OPTS);

		expect(mockPost).toHaveBeenCalledTimes(1);
		const [path, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(path).toBe("/v1/standups/42/duplicate");
		expect(body.name).toBe("Copy");
	});

	test("returns receipt with operation=duplicated and undo=delete new standup", async () => {
		await handleStandupDuplicate("42", { name: "Copy" }, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			metadata: { operation: string; undo: string };
		};
		expect(envelope.metadata.operation).toBe("duplicated");
		expect(envelope.metadata.undo).toBe("geekbot standup delete 42 --yes");
	});
});

// ── handleStandupStart ───────────────────────────────────────────────

describe("handleStandupStart", () => {
	test("pre-fetches standup then sends POST to /v1/standups/<id>/start", async () => {
		mockPost.mockImplementation(() => Promise.resolve("ok"));
		await handleStandupStart("42", {}, GLOBAL_OPTS);

		expect(mockGet).toHaveBeenCalledWith("/v1/standups/42");
		expect(mockPost).toHaveBeenCalledTimes(1);
		const [path, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(path).toBe("/v1/standups/42/start");
		expect(body).toEqual({});
	});

	test("returns receipt with operation=started and undo=null", async () => {
		mockPost.mockImplementation(() => Promise.resolve("ok"));
		await handleStandupStart("42", {}, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			metadata: { operation: string; undo: string | null };
		};
		expect(envelope.metadata.operation).toBe("started");
		expect(envelope.metadata.undo).toBeNull();
	});

	test("sends users array in body when users option provided", async () => {
		mockPost.mockImplementation(() => Promise.resolve("ok"));
		await handleStandupStart("42", { users: "U1,U2" }, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
		expect(body.users).toEqual(["U1", "U2"]);
	});

	test("accepts Slack-style user IDs", async () => {
		mockPost.mockImplementation(() => Promise.resolve("ok"));
		await handleStandupStart("42", { users: "U123,U456" }, GLOBAL_OPTS);

		const [, body] = mockPost.mock.calls[0]! as [string, Record<string, unknown>];
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
		mockPost.mockImplementation(() => Promise.resolve("ok"));
		await handleStandupStart("42", {}, GLOBAL_OPTS);

		const envelope = mockWriteOutput.mock.calls[0]![0] as {
			data: { id: number; name: string };
		};
		expect(envelope.data.id).toBe(42);
		expect(envelope.data.name).toBe("Daily Standup");
	});
});

// ── 404 Suggestion Enrichment ─────────────────────────────────────────

describe("404 suggestion enrichment", () => {
	const notFoundError = new CliError("Not found", "not_found", 3, false, undefined, {
		path: "/v1/standups/99999",
		status: 404,
	});

	test("handleStandupGet enriches 404 with suggestion from buildNotFoundSuggestion", async () => {
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() =>
			Promise.resolve("Available standups: 42 (Daily Standup)"),
		);

		try {
			await handleStandupGet("99999", GLOBAL_OPTS);
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
			await handleStandupGet("99999", GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("not_found");
			expect(cliErr.suggestion).toBeUndefined();
		}
	});

	test("handleStandupDelete enriches 404 with suggestion", async () => {
		mockGet.mockImplementation(() => Promise.reject(notFoundError));
		mockBuildNotFoundSuggestion.mockImplementation(() =>
			Promise.resolve("Available standups: 42 (Daily Standup)"),
		);

		try {
			await handleStandupDelete("99999", { yes: true }, GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("not_found");
			expect(cliErr.suggestion).toBe("Available standups: 42 (Daily Standup)");
		}
	});

	test("non-404 errors pass through without enrichment", async () => {
		const serverError = new CliError("Server error", "server_error", 4, true);
		mockGet.mockImplementation(() => Promise.reject(serverError));

		try {
			await handleStandupGet("42", GLOBAL_OPTS);
			expect.unreachable("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(CliError);
			const cliErr = err as InstanceType<typeof CliError>;
			expect(cliErr.code).toBe("server_error");
		}

		expect(mockBuildNotFoundSuggestion).not.toHaveBeenCalled();
	});
});

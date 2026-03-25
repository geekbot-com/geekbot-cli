import { beforeEach, describe, expect, mock, test } from "bun:test";

// --- Mocks ---

const mockGet = mock(() => Promise.resolve({}));
const mockCreateHttpClient = mock(() => ({
	get: mockGet,
	post: mock(),
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

const mockWriteOutput = mock(() => {});
mock.module("../../src/output/formatter.ts", () => ({
	writeOutput: mockWriteOutput,
}));

import type { GlobalOptions } from "../../src/cli/globals.ts";
import { handleTeamList, handleTeamSearch } from "../../src/handlers/team-handlers.ts";

const defaultGlobalOpts: GlobalOptions = {
	apiKey: undefined,
	output: "json",
	debug: false,
};

// Sample /v1/teams response (single object, NOT array)
const sampleTeamResponse = {
	id: 1,
	name: "Engineering",
	users: [
		{
			id: "U123",
			role: "admin" as const,
			email: "alice@example.com",
			username: "alice",
			realname: "Alice Smith",
			profile_img: "https://example.com/alice.jpg",
		},
		{
			id: "U456",
			role: "member" as const,
			email: "bob@example.com",
			username: "bob",
			realname: "Bob Jones",
			profile_img: "https://example.com/bob.jpg",
		},
	],
};

describe("handleTeamList", () => {
	beforeEach(() => {
		mockGet.mockClear();
		mockCreateHttpClient.mockClear();
		mockWriteOutput.mockClear();
	});

	test("calls GET /v1/teams", async () => {
		mockGet.mockResolvedValueOnce(sampleTeamResponse);

		await handleTeamList(defaultGlobalOpts);

		expect(mockGet).toHaveBeenCalledTimes(1);
		expect(mockGet.mock.calls[0][0]).toBe("/v1/teams");
	});

	test("outputs single team object via success (not successList)", async () => {
		mockGet.mockResolvedValueOnce(sampleTeamResponse);

		await handleTeamList(defaultGlobalOpts);

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		// Should be a single object, NOT an array
		expect(Array.isArray(envelope.data)).toBe(false);
		expect(envelope.data.id).toBe(1);
		expect(envelope.data.name).toBe("Engineering");
		// Should NOT have count in metadata (that's successList)
		expect(envelope.metadata.count).toBeUndefined();
	});

	test("includes users array in response", async () => {
		mockGet.mockResolvedValueOnce(sampleTeamResponse);

		await handleTeamList(defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(Array.isArray(envelope.data.users)).toBe(true);
		expect(envelope.data.users.length).toBe(2);
		expect(envelope.data.users[0].username).toBe("alice");
		expect(envelope.data.users[1].username).toBe("bob");
	});

	test("wraps output in success envelope", async () => {
		mockGet.mockResolvedValueOnce(sampleTeamResponse);

		await handleTeamList(defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		expect(envelope.error).toBeNull();
		expect(envelope.metadata.timestamp).toBeDefined();
	});
});

// ── handleTeamSearch ─────────────────────────────────────────────────

describe("handleTeamSearch", () => {
	beforeEach(() => {
		mockGet.mockClear();
		mockCreateHttpClient.mockClear();
		mockWriteOutput.mockClear();
	});

	test("matches by username (case-insensitive)", async () => {
		mockGet.mockResolvedValueOnce(sampleTeamResponse);

		await handleTeamSearch("ALICE", defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		expect(envelope.data).toHaveLength(1);
		expect(envelope.data[0].username).toBe("alice");
		expect(envelope.metadata.count).toBe(1);
	});

	test("matches by realname", async () => {
		mockGet.mockResolvedValueOnce(sampleTeamResponse);

		await handleTeamSearch("Jones", defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.data).toHaveLength(1);
		expect(envelope.data[0].username).toBe("bob");
	});

	test("matches by email", async () => {
		mockGet.mockResolvedValueOnce(sampleTeamResponse);

		await handleTeamSearch("@example.com", defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.data).toHaveLength(2);
	});

	test("returns empty list when no matches", async () => {
		mockGet.mockResolvedValueOnce(sampleTeamResponse);

		await handleTeamSearch("zzz-no-match", defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		expect(envelope.data).toHaveLength(0);
		expect(envelope.metadata.count).toBe(0);
	});

	test("handles null realname without crashing", async () => {
		const teamWithNullRealname = {
			...sampleTeamResponse,
			users: [
				{
					id: "U789",
					role: "member" as const,
					email: "charlie@example.com",
					username: "charlie",
					realname: null,
					profile_img: "https://example.com/charlie.jpg",
				},
			],
		};
		mockGet.mockResolvedValueOnce(teamWithNullRealname);

		await handleTeamSearch("charlie", defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.data).toHaveLength(1);
	});

	test("wraps results in successList envelope with count", async () => {
		mockGet.mockResolvedValueOnce(sampleTeamResponse);

		await handleTeamSearch("alice", defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		expect(Array.isArray(envelope.data)).toBe(true);
		expect(envelope.metadata.count).toBe(1);
		expect(envelope.metadata.timestamp).toBeDefined();
	});
});

import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

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
import { handleMeShow, handleMeTeams } from "../../src/handlers/me-handlers.ts";

const defaultGlobalOpts: GlobalOptions = {
	apiKey: undefined,
};

// Sample /v1/me response
const sampleMeResponse = {
	user: {
		id: "U123",
		username: "alice",
		realname: "Alice Smith",
		firstname: "Alice",
		email: "alice@example.com",
		profile_img: "https://example.com/alice.jpg",
		timezone: "America/New_York",
		is_admin: true,
		is_billing_admin: false,
		role: "admin" as const,
	},
	team: {
		id: 1,
		name: "Engineering",
	},
};

// Sample /v1/me/teams response
const sampleMeTeamsResponse = {
	teams: [
		{
			id: 1,
			name: "Engineering",
			is_admin: true,
			standup_count: 3,
		},
		{
			id: 2,
			name: "Design",
			is_admin: false,
			standup_count: 1,
		},
	],
};

afterAll(() => {
	mock.restore();
});

describe("handleMeShow", () => {
	beforeEach(() => {
		mockGet.mockClear();
		mockCreateHttpClient.mockClear();
		mockWriteOutput.mockClear();
	});

	test("calls GET /v1/me", async () => {
		mockGet.mockResolvedValueOnce(sampleMeResponse);

		await handleMeShow(defaultGlobalOpts);

		expect(mockGet).toHaveBeenCalledTimes(1);
		expect(mockGet.mock.calls[0][0]).toBe("/v1/me");
	});

	test("outputs only the user portion, not team", async () => {
		mockGet.mockResolvedValueOnce(sampleMeResponse);

		await handleMeShow(defaultGlobalOpts);

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		// Should have user fields
		expect(envelope.data.id).toBe("U123");
		expect(envelope.data.username).toBe("alice");
		expect(envelope.data.email).toBe("alice@example.com");
		// Should NOT have team data at the top level
		expect(envelope.data.team).toBeUndefined();
	});

	test("wraps output in success envelope", async () => {
		mockGet.mockResolvedValueOnce(sampleMeResponse);

		await handleMeShow(defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		expect(envelope.error).toBeNull();
		expect(envelope.metadata.timestamp).toBeDefined();
	});
});

describe("handleMeTeams", () => {
	beforeEach(() => {
		mockGet.mockClear();
		mockCreateHttpClient.mockClear();
		mockWriteOutput.mockClear();
	});

	test("calls GET /v1/me/teams", async () => {
		mockGet.mockResolvedValueOnce(sampleMeTeamsResponse);

		await handleMeTeams(defaultGlobalOpts);

		expect(mockGet).toHaveBeenCalledTimes(1);
		expect(mockGet.mock.calls[0][0]).toBe("/v1/me/teams");
	});

	test("outputs unwrapped teams array via successList", async () => {
		mockGet.mockResolvedValueOnce(sampleMeTeamsResponse);

		await handleMeTeams(defaultGlobalOpts);

		expect(mockWriteOutput).toHaveBeenCalledTimes(1);
		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.ok).toBe(true);
		expect(Array.isArray(envelope.data)).toBe(true);
		expect(envelope.data.length).toBe(2);
		expect(envelope.data[0].name).toBe("Engineering");
		expect(envelope.data[1].name).toBe("Design");
		expect(envelope.metadata.count).toBe(2);
	});

	test("handles empty teams list", async () => {
		mockGet.mockResolvedValueOnce({ teams: [] });

		await handleMeTeams(defaultGlobalOpts);

		const envelope = mockWriteOutput.mock.calls[0][0];
		expect(envelope.data).toEqual([]);
		expect(envelope.metadata.count).toBe(0);
	});
});

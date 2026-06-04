import { describe, expect, test } from "bun:test";
import { buildNotFoundSuggestion } from "../../src/errors/not-found-helper.ts";
import type { HttpClient } from "../../src/http/client.ts";

function mockClient(getResponse: unknown): HttpClient {
	return {
		get: async () => getResponse,
		post: async () => null,
		patch: async () => null,
		put: async () => null,
		delete: async () => null,
	} as HttpClient;
}

function failingClient(): HttpClient {
	return {
		get: async () => {
			throw new Error("Network error");
		},
		post: async () => null,
		patch: async () => null,
		put: async () => null,
		delete: async () => null,
	} as HttpClient;
}

describe("buildNotFoundSuggestion", () => {
	test("formats standup alternatives into suggestion string", async () => {
		const client = mockClient({
			data: [
				{ id: 123, name: "Daily Standup" },
				{ id: 456, name: "Weekly Review" },
			],
		});
		const suggestion = await buildNotFoundSuggestion(client, "standup");
		expect(suggestion).toContain("123 (Daily Standup)");
		expect(suggestion).toContain("456 (Weekly Review)");
		expect(suggestion).toContain("geekbot standup list");
	});

	test("formats poll alternatives into suggestion string", async () => {
		const client = mockClient({ data: [{ id: 10, name: "Lunch Poll" }] });
		const suggestion = await buildNotFoundSuggestion(client, "poll");
		expect(suggestion).toContain("10 (Lunch Poll)");
		expect(suggestion).toContain("geekbot poll list");
	});

	test("truncates long lists to maxItems", async () => {
		const items = Array.from({ length: 10 }, (_, i) => ({
			id: i + 1,
			name: `Standup ${i + 1}`,
		}));
		const client = mockClient({ data: items });
		const suggestion = await buildNotFoundSuggestion(client, "standup", 3);
		expect(suggestion).toContain("1 (Standup 1)");
		expect(suggestion).toContain("3 (Standup 3)");
		expect(suggestion).toContain("and 7 more");
		// Should NOT contain item 4+
		expect(suggestion).not.toContain("4 (Standup 4)");
	});

	test("returns create suggestion when list is empty", async () => {
		const client = mockClient({ data: [] });
		const suggestion = await buildNotFoundSuggestion(client, "standup");
		expect(suggestion).toContain("No standups found");
		expect(suggestion).toContain("geekbot standup create");
	});

	test("returns null when fetch fails", async () => {
		const client = failingClient();
		const suggestion = await buildNotFoundSuggestion(client, "standup");
		expect(suggestion).toBeNull();
	});

	test("returns create suggestion for malformed response data", async () => {
		const client = mockClient("not an envelope");
		const suggestion = await buildNotFoundSuggestion(client, "standup");
		expect(suggestion).toContain("No standups found");
	});
});

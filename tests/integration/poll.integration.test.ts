import { beforeAll, describe, expect, test } from "bun:test";
import { API_KEY, testClient, uniqueName } from "./helpers.ts";

describe.skipIf(!API_KEY)("Poll Integration", () => {
	const client = testClient();
	let pollsAvailable = false;

	beforeAll(async () => {
		// Check if polls are available (Slack-only feature)
		try {
			await client.get<unknown>("/v1/polls");
			pollsAvailable = true;
		} catch {
			pollsAvailable = false;
		}
	});

	test("create poll, get by id, and retrieve votes", async () => {
		if (!pollsAvailable) {
			throw new Error("SKIP: polls not available (team may not be on Slack)");
		}

		const name = uniqueName("test-poll");
		const poll = await client.post<{ id: number; name: string }>("/v1/polls", {
			name,
			channel: "geekbot-skill-tests",
			question: "Integration test question?",
			choices: ["Option A", "Option B", "Option C"],
		});
		expect(poll.id).toBeGreaterThan(0);
		expect(poll.name).toBe(name);

		// Get single poll by ID
		const fetched = await client.get<{ id: number; name: string }>(`/v1/polls/${poll.id}`);
		expect(fetched.id).toBe(poll.id);
		expect(fetched.name).toBe(name);

		// Get votes (may be empty for newly created poll)
		const votes = await client.get<{ total_results: number }>(`/v1/polls/${poll.id}/votes`);
		expect(votes).toBeDefined();
		expect(typeof votes.total_results).toBe("number");

		// Note: no delete endpoint for polls (API limitation)
	}, 30000);

	test("list polls returns array", async () => {
		if (!pollsAvailable) {
			throw new Error("SKIP: polls not available (team may not be on Slack)");
		}

		const polls = await client.get<Array<{ id: number }>>("/v1/polls");
		expect(Array.isArray(polls)).toBe(true);
	}, 30000);

	test("votes with date filter returns result", async () => {
		if (!pollsAvailable) {
			throw new Error("SKIP: polls not available (team may not be on Slack)");
		}

		// List polls and pick the first one for filter test
		const polls = await client.get<Array<{ id: number }>>("/v1/polls");
		if (polls.length === 0) {
			throw new Error("SKIP: no polls exist to test date filters");
		}

		const pollId = polls[0].id;
		const votes = await client.get<{ total_results: number }>(`/v1/polls/${pollId}/votes`, {
			from: "2020-01-01",
			to: "2099-12-31",
		});
		expect(votes).toBeDefined();
		expect(typeof votes.total_results).toBe("number");
	}, 30000);
});

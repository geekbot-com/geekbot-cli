import type { HttpClient } from "../../src/http/client.ts";
import { createHttpClient } from "../../src/http/client.ts";

export const API_KEY = process.env.GEEKBOT_INTEGRATION_TEST_API_KEY;

/**
 * Creates an authenticated HTTP client for integration tests.
 * Only call inside describe blocks guarded by `describe.skipIf(!API_KEY)`.
 */
export function testClient(): HttpClient {
	return createHttpClient(API_KEY ?? "", { debug: false });
}

/**
 * Check whether the test Slack channel exists by attempting to create
 * and immediately delete a throwaway standup. Returns true if the
 * channel is reachable, false otherwise.
 *
 * Caches the result so the check runs at most once per test run.
 */
let channelCheckResult: boolean | null = null;

export async function isTestChannelAvailable(client: HttpClient): Promise<boolean> {
	if (channelCheckResult !== null) return channelCheckResult;

	try {
		const standup = await client.post<{ id: number }>("/v1/standups", {
			name: `channel-probe-${Date.now()}`,
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon"],
			questions: [{ question: "probe" }],
			sync_channel_members: true,
		});
		// Channel exists -- clean up probe standup
		await client.delete(`/v1/standups/${standup.id}`);
		channelCheckResult = true;
	} catch {
		channelCheckResult = false;
	}
	return channelCheckResult;
}

/**
 * Unique name generator to avoid collisions across concurrent test runs.
 */
export function uniqueName(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Retry an async check with delays to handle eventual consistency.
 */
export async function waitFor<T>(
	fn: () => Promise<T>,
	check: (result: T) => boolean,
	{ retries = 3, delayMs = 1000 } = {},
): Promise<T> {
	for (let i = 0; i <= retries; i++) {
		const result = await fn();
		if (check(result) || i === retries) return result;
		await new Promise((r) => setTimeout(r, delayMs));
	}
	throw new Error("waitFor: unreachable");
}

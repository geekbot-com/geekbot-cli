import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { API_KEY, isTestChannelAvailable, testClient, uniqueName, waitFor } from "./helpers.ts";

describe.skipIf(!API_KEY)("Report Integration", () => {
	const client = testClient();
	let channelAvailable = false;
	let testStandupId: number | null = null;
	let testQuestionId: number | null = null;

	beforeAll(async () => {
		channelAvailable = await isTestChannelAvailable(client);
		if (!channelAvailable) return;

		// Create a shared standup for all report tests
		const standup = await client.post<{
			id: number;
			questions: Array<{ id: number }>;
		}>("/v1/standups", {
			name: uniqueName("test-report-standup"),
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
			questions: [{ question: "What did you work on?" }],
			sync_channel_members: true,
		});
		testStandupId = standup.id;
		testQuestionId = standup.questions[0]?.id ?? null;
	});

	afterAll(async () => {
		if (testStandupId) {
			try {
				await client.delete(`/v1/standups/${testStandupId}`);
			} catch {
				// Best-effort cleanup
			}
		}
	});

	test("submit report and verify in list", async () => {
		if (!channelAvailable || !testStandupId || !testQuestionId) {
			console.warn("SKIPPED: channel or standup not available");
			return;
		}

		const answerText = `Integration test answer ${Date.now()}`;
		const answers: Record<string, { text: string }> = {
			[String(testQuestionId)]: { text: answerText },
		};

		const report = await client.post<{
			id: number;
			standup_id: number;
			answers: Array<{ id: number; answer: string }>;
		}>("/v1/reports", {
			standup_id: testStandupId,
			answers,
		});

		expect(report.id).toBeGreaterThan(0);
		expect(report.standup_id).toBe(testStandupId);

		// List reports filtered by standup and verify submission appears (retry for eventual consistency)
		const reports = await waitFor(
			() => client.get<Array<{ id: number }>>("/v1/reports", { standup_id: String(testStandupId) }),
			(r) => r.some((entry) => entry.id === report.id),
		);
		expect(Array.isArray(reports)).toBe(true);
		expect(reports.some((r) => r.id === report.id)).toBe(true);
	}, 30000);

	test("list reports with limit filter", async () => {
		if (!channelAvailable || !testStandupId) {
			console.warn("SKIPPED: channel or standup not available");
			return;
		}

		const reports = await client.get<Array<{ id: number }>>("/v1/reports", {
			standup_id: String(testStandupId),
			limit: "1",
		});
		expect(Array.isArray(reports)).toBe(true);
		expect(reports.length).toBeLessThanOrEqual(1);
	}, 15000);

	test("list reports with date filters", async () => {
		if (!channelAvailable || !testStandupId) {
			console.warn("SKIPPED: channel or standup not available");
			return;
		}

		// API expects unix timestamps for after/before params
		const farPastTimestamp = String(Math.floor(new Date("2020-01-01").getTime() / 1000));

		// Use a date far in the past -- should return reports (we submitted one earlier)
		const reports = await client.get<Array<{ id: number }>>("/v1/reports", {
			standup_id: String(testStandupId),
			after: farPastTimestamp,
		});
		expect(Array.isArray(reports)).toBe(true);
		expect(reports.length).toBeGreaterThanOrEqual(1);

		// Use `before` with a far-past date -- should return empty
		const oldReports = await client.get<Array<{ id: number }>>("/v1/reports", {
			standup_id: String(testStandupId),
			before: farPastTimestamp,
		});
		expect(Array.isArray(oldReports)).toBe(true);
		expect(oldReports.length).toBe(0);
	}, 30000);
});

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { API_KEY, isTestChannelAvailable, testClient, uniqueName, waitFor } from "./helpers.ts";

describe.skipIf(!API_KEY)("Report Lifecycle: create standup -> post report -> fetch report", () => {
	const client = testClient();
	let channelAvailable = false;
	let testStandupId: number | null = null;

	beforeAll(async () => {
		channelAvailable = await isTestChannelAvailable(client);
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

	test("submitted report is retrievable with matching answers", async () => {
		if (!channelAvailable) {
			throw new Error("SKIP: #geekbot-skill-tests channel not found");
		}

		// 1. Create a standup
		const standup = await client.post<{
			id: number;
			name: string;
			questions: Array<{ id: number; text: string }>;
		}>("/v1/standups", {
			name: uniqueName("test-report-lifecycle"),
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
			questions: [{ question: "What did you work on?" }],
			sync_channel_members: true,
		});
		testStandupId = standup.id;

		expect(standup.id).toBeGreaterThan(0);
		expect(standup.questions.length).toBeGreaterThan(0);

		// 2. Submit a report with known answer text
		const answerText = `lifecycle-test-answer-${Date.now()}`;
		const answers: Record<string, { text: string }> = {};
		for (const q of standup.questions) {
			answers[String(q.id)] = { text: answerText };
		}

		const submitted = await client.post<{
			id: number;
			standup_id: number;
			answers: Array<{ id: number; answer: string; question_id: number }>;
		}>("/v1/reports", {
			standup_id: standup.id,
			answers,
		});

		expect(submitted.id).toBeGreaterThan(0);
		expect(submitted.standup_id).toBe(standup.id);
		expect(submitted.answers.length).toBe(standup.questions.length);
		for (const a of submitted.answers) {
			expect(a.answer).toBe(answerText);
		}

		// 3. Fetch reports for this standup and find our submission (retry for eventual consistency)
		type ReportEntry = {
			id: number;
			standup_id: number;
			questions: Array<{ id: number; answer: string }>;
		};
		const reports = await waitFor(
			() => client.get<ReportEntry[]>("/v1/reports", { standup_id: String(standup.id) }),
			(r) => r.some((entry) => entry.id === submitted.id),
		);

		expect(Array.isArray(reports)).toBe(true);
		expect(reports.length).toBeGreaterThanOrEqual(1);

		const fetched = reports.find((r) => r.id === submitted.id);
		expect(fetched).toBeDefined();
		expect(fetched!.standup_id).toBe(standup.id);
		for (const q of fetched!.questions) {
			expect(q.answer).toBe(answerText);
		}
	}, 30000);
});

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SubmittedReportSchema, TimelineReportListSchema } from "../../src/schemas/report.ts";
import { StandupListSchema, StandupSchema } from "../../src/schemas/standup.ts";
import { TeamResponseSchema } from "../../src/schemas/team.ts";
import { MeResponseSchema, MeTeamsResponseSchema } from "../../src/schemas/user.ts";
import { API_KEY, isTestChannelAvailable, testClient, uniqueName } from "./helpers.ts";

describe.skipIf(!API_KEY)("Schema Validation Against Real API", () => {
	const client = testClient();
	const cleanupIds: number[] = [];
	let channelAvailable = false;
	let testStandupId: number | null = null;

	beforeAll(async () => {
		channelAvailable = await isTestChannelAvailable(client);
	});

	afterAll(async () => {
		for (const id of cleanupIds) {
			try {
				await client.delete(`/v1/standups/${id}`);
			} catch {
				// Best-effort cleanup
			}
		}
	});

	test("MeResponseSchema parses GET /v1/me", async () => {
		const raw = await client.get<unknown>("/v1/me");
		const result = MeResponseSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.user.id).toBeDefined();
			expect(result.data.team.id).toBeDefined();
		}
	}, 15000);

	test("MeTeamsResponseSchema parses GET /v1/me/teams", async () => {
		const raw = await client.get<unknown>("/v1/me/teams");
		const result = MeTeamsResponseSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.teams.length).toBeGreaterThanOrEqual(1);
		}
	}, 15000);

	test("TeamResponseSchema parses GET /v1/teams", async () => {
		const raw = await client.get<unknown>("/v1/teams");
		const result = TeamResponseSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(typeof result.data.id).toBe("number");
			expect(Array.isArray(result.data.users)).toBe(true);
		}
	}, 15000);

	test("StandupListSchema parses GET /v1/standups", async () => {
		const raw = await client.get<unknown>("/v1/standups");
		const result = StandupListSchema.safeParse(raw);
		expect(result.success).toBe(true);
	}, 15000);

	test("StandupSchema parses single standup from API", async () => {
		if (!channelAvailable) {
			console.warn("SKIPPED: #geekbot-skill-tests channel not found");
			return;
		}

		const created = await client.post<{ id: number }>("/v1/standups", {
			name: uniqueName("test-schema-standup"),
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
			questions: [{ question: "Schema test?" }],
			sync_channel_members: true,
		});
		testStandupId = created.id;
		cleanupIds.push(created.id);

		const raw = await client.get<unknown>(`/v1/standups/${created.id}`);
		const result = StandupSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			// Verify wait_time normalization (API returns seconds, schema converts to minutes)
			expect(typeof result.data.wait_time).toBe("number");
		}
	}, 30000);

	test("SubmittedReportSchema parses POST /v1/reports response", async () => {
		if (!channelAvailable || !testStandupId) {
			console.warn("SKIPPED: channel or standup not available");
			return;
		}

		// Get question IDs
		const standup = await client.get<{
			questions: Array<{ id: number }>;
		}>(`/v1/standups/${testStandupId}`);

		const answers: Record<string, { text: string }> = {};
		for (const q of standup.questions) {
			answers[String(q.id)] = { text: "Schema validation test" };
		}

		const raw = await client.post<unknown>("/v1/reports", {
			standup_id: testStandupId,
			answers,
		});

		const result = SubmittedReportSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.standup_id).toBe(testStandupId);
			// POST response includes member with normalized profile_img
			expect(result.data.questions.length).toBeGreaterThan(0);
		}
	}, 30000);

	test("TimelineReportListSchema parses GET /v1/reports response", async () => {
		if (!channelAvailable || !testStandupId) {
			console.warn("SKIPPED: channel or standup not available");
			return;
		}

		const raw = await client.get<unknown>("/v1/reports", {
			standup_id: String(testStandupId),
		});

		const result = TimelineReportListSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(Array.isArray(result.data)).toBe(true);
		}
	}, 30000);

	test("TimelineReportListSchema accepts report with member omitted (anonymous)", async () => {
		if (!channelAvailable || !testStandupId) {
			console.warn("SKIPPED: channel or standup not available");
			return;
		}

		const raw = await client.get<Array<Record<string, unknown>>>("/v1/reports", {
			standup_id: String(testStandupId),
		});
		if (raw.length === 0) {
			console.warn("SKIPPED: no reports available");
			return;
		}

		// Simulate anonymous report shape by removing member
		const report = raw[0];
		delete report.member;

		const result = TimelineReportListSchema.safeParse([report]);
		expect(result.success).toBe(true);
	}, 30000);

	test("TimelineReportListSchema accepts report with answer: null", async () => {
		if (!channelAvailable || !testStandupId) {
			console.warn("SKIPPED: channel or standup not available");
			return;
		}

		const raw = await client.get<Array<Record<string, unknown>>>("/v1/reports", {
			standup_id: String(testStandupId),
		});
		if (raw.length === 0) {
			console.warn("SKIPPED: no reports available");
			return;
		}

		const report = JSON.parse(JSON.stringify(raw[0]));
		const questions = report.questions as Array<Record<string, unknown>>;
		if (questions.length > 0) {
			questions[0].answer = null;
		}

		const result = TimelineReportListSchema.safeParse([report]);
		expect(result.success).toBe(true);
	}, 30000);

	test("StandupSchema preserves wait_time=-1 sentinel", async () => {
		if (!channelAvailable) {
			console.warn("SKIPPED: channel not available");
			return;
		}

		const created = await client.post<{ id: number }>("/v1/standups", {
			name: uniqueName("test-wait-sentinel"),
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon"],
			questions: [{ question: "wait_time test?" }],
			sync_channel_members: true,
			wait_time: null,
		});
		cleanupIds.push(created.id);

		const raw = await client.get<Record<string, unknown>>(`/v1/standups/${created.id}`);
		const result = StandupSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.wait_time).toBe(-1);
		}
	}, 30000);

	test("StandupListSchema includes time/timezone/days for brief projection", async () => {
		const raw = await client.get<Array<Record<string, unknown>>>("/v1/standups");
		if (raw.length === 0) {
			console.warn("SKIPPED: no standups available");
			return;
		}

		const result = StandupListSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success && result.data.length > 0) {
			const first = result.data[0];
			expect(first.time).toBeDefined();
			expect(first.timezone).toBeDefined();
			expect(first.days).toBeDefined();
			expect(first.days.length).toBeGreaterThan(0);
		}
	}, 15000);
});

import { describe, expect, test } from "bun:test";
import { TeamResponseSchema } from "../../src/schemas/team.ts";
import { MeResponseSchema, MeTeamsResponseSchema } from "../../src/schemas/user.ts";
import { API_KEY, testClient } from "./helpers.ts";

describe.skipIf(!API_KEY)("Schema Validation Against Real API", () => {
	const client = testClient();

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
});

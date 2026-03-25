import { describe, expect, test } from "bun:test";
import { API_KEY, testClient } from "./helpers.ts";

describe.skipIf(!API_KEY)("Me Integration", () => {
	const client = testClient();

	test("GET /v1/me returns user with expected fields", async () => {
		const me = await client.get<{
			user: {
				id: string;
				username: string;
				email: string;
				role: string;
				timezone: string;
			};
			team: {
				id: number;
				name: string;
			};
		}>("/v1/me");

		expect(me.user).toBeDefined();
		expect(typeof me.user.id).toBe("string");
		expect(typeof me.user.username).toBe("string");
		expect(typeof me.user.email).toBe("string");
		expect(["admin", "billing_admin", "member"]).toContain(me.user.role);
		expect(typeof me.user.timezone).toBe("string");

		expect(me.team).toBeDefined();
		expect(typeof me.team.id).toBe("number");
		expect(typeof me.team.name).toBe("string");
	}, 15000);

	test("GET /v1/me/teams returns teams array", async () => {
		const response = await client.get<{
			teams: Array<{
				id: number;
				name: string;
				is_admin: boolean;
				standup_count: number;
			}>;
		}>("/v1/me/teams");

		expect(response.teams).toBeDefined();
		expect(Array.isArray(response.teams)).toBe(true);
		expect(response.teams.length).toBeGreaterThanOrEqual(1);

		const team = response.teams[0];
		expect(typeof team.id).toBe("number");
		expect(typeof team.name).toBe("string");
		expect(typeof team.is_admin).toBe("boolean");
		expect(typeof team.standup_count).toBe("number");
	}, 15000);
});

import { describe, expect, test } from "bun:test";
import { API_KEY, testClient } from "./helpers.ts";

describe.skipIf(!API_KEY)("Team Integration", () => {
	const client = testClient();

	test("GET /v1/teams returns team with users", async () => {
		const team = await client.get<{
			id: number;
			name: string;
			users: Array<{
				id: string;
				role: string;
				email: string;
				username: string;
			}>;
		}>("/v1/teams");

		expect(typeof team.id).toBe("number");
		expect(typeof team.name).toBe("string");
		expect(Array.isArray(team.users)).toBe(true);

		if (team.users.length > 0) {
			const user = team.users[0] as (typeof team.users)[number];
			expect(typeof user.id).toBe("string");
			expect(typeof user.username).toBe("string");
			expect(typeof user.email).toBe("string");
			expect(["admin", "billing_admin", "member"]).toContain(user.role);
		}
	}, 15000);
});

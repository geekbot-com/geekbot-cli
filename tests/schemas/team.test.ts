import { describe, expect, test } from "bun:test";
import { TeamResponseSchema } from "../../src/schemas/team.ts";

const teamFixture = {
	id: 1,
	name: "Engineering",
	users: [
		{
			id: "U10",
			username: "alice",
			email: "alice@test.com",
			role: "admin" as const,
			profile_img: "https://img.test/a.png",
			realname: "Alice Smith",
		},
	],
};

describe("TeamResponseSchema", () => {
	test("parses valid team response", () => {
		const result = TeamResponseSchema.parse(teamFixture);
		expect(result.id).toBe(1);
		expect(result.name).toBe("Engineering");
		expect(result.users).toHaveLength(1);
	});

	test("users[0] has expected normalized fields", () => {
		const result = TeamResponseSchema.parse(teamFixture);
		const user = result.users[0]!;
		expect(user.id).toBe("U10");
		expect(user.username).toBe("alice");
		expect(user.email).toBe("alice@test.com");
		expect(user.role).toBe("admin");
		expect(user.profile_img).toBe("https://img.test/a.png");
		expect(user.realname).toBe("Alice Smith");
	});

	test("fails when id is missing", () => {
		expect(() =>
			TeamResponseSchema.parse({
				name: "Engineering",
				users: [],
			}),
		).toThrow();
	});
});

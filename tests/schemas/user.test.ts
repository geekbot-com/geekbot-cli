import { describe, expect, test } from "bun:test";
import { TeamResponseSchema } from "../../src/schemas/team.ts";
import {
	CompactUserSchema,
	FullUserSchema,
	MeResponseSchema,
	MeTeamsResponseSchema,
} from "../../src/schemas/user.ts";

describe("FullUserSchema", () => {
	test("parses full user with snake_case profile_img", () => {
		const user = FullUserSchema.parse({
			id: "U123",
			role: "admin",
			email: "j@e.com",
			username: "jane",
			realname: "Jane",
			profile_img: "http://img.png",
		});
		expect(user.profile_img).toBe("http://img.png");
	});

	test("rejects invalid role", () => {
		expect(() =>
			FullUserSchema.parse({
				id: "U123",
				role: "superadmin",
				email: "j@e.com",
				username: "jane",
				realname: "Jane",
				profile_img: "http://img.png",
			}),
		).toThrow();
	});

	test("accepts null realname", () => {
		const user = FullUserSchema.parse({
			id: "U123",
			role: "member",
			email: "j@e.com",
			username: "jane",
			realname: null,
			profile_img: "http://img.png",
		});
		expect(user.realname).toBeNull();
	});
});

describe("CompactUserSchema (NORM-01)", () => {
	test("normalizes profileImg to profile_img", () => {
		const user = CompactUserSchema.parse({
			id: "U123",
			username: "jane",
			realname: "Jane",
			profileImg: "http://img.png",
		});
		expect(user.profile_img).toBe("http://img.png");
		expect("profileImg" in user).toBe(false);
	});

	test("preserves all other fields unchanged", () => {
		const user = CompactUserSchema.parse({
			id: "U999",
			username: "bob",
			realname: null,
			profileImg: "http://bob.png",
		});
		expect(user.id).toBe("U999");
		expect(user.username).toBe("bob");
		expect(user.realname).toBeNull();
	});
});

describe("MeResponseSchema", () => {
	test("parses nested user and team from /v1/me", () => {
		const response = MeResponseSchema.parse({
			user: {
				id: "U123",
				username: "jane",
				realname: "Jane Doe",
				firstname: "Jane",
				email: "jane@example.com",
				profile_img: "https://img.example.com/jane.png",
				timezone: "America/New_York",
				is_admin: true,
				is_billing_admin: false,
				role: "admin",
			},
			team: {
				id: 42,
				name: "Engineering",
			},
		});
		expect(response.user.id).toBe("U123");
		expect(response.user.firstname).toBe("Jane");
		expect(response.user.timezone).toBe("America/New_York");
		expect(response.user.is_admin).toBe(true);
		expect(response.team.id).toBe(42);
		expect(response.team.name).toBe("Engineering");
	});

	test("accepts null realname in me user", () => {
		const response = MeResponseSchema.parse({
			user: {
				id: "U123",
				username: "jane",
				realname: null,
				firstname: "Jane",
				email: "jane@example.com",
				profile_img: "https://img.png",
				timezone: "UTC",
				is_admin: false,
				is_billing_admin: false,
				role: "member",
			},
			team: { id: 1, name: "Team" },
		});
		expect(response.user.realname).toBeNull();
	});
});

describe("MeTeamsResponseSchema", () => {
	test("parses teams array from /v1/me/teams", () => {
		const response = MeTeamsResponseSchema.parse({
			teams: [
				{ id: 1, name: "Engineering", is_admin: true, standup_count: 3 },
				{ id: 2, name: "Design", is_admin: false, standup_count: 1 },
			],
		});
		expect(response.teams).toHaveLength(2);
		expect(response.teams[0]?.name).toBe("Engineering");
		expect(response.teams[0]?.is_admin).toBe(true);
		expect(response.teams[0]?.standup_count).toBe(3);
	});

	test("parses empty teams array", () => {
		const response = MeTeamsResponseSchema.parse({ teams: [] });
		expect(response.teams).toHaveLength(0);
	});
});

describe("TeamResponseSchema", () => {
	test("parses single team object with users from /v1/teams", () => {
		const response = TeamResponseSchema.parse({
			id: 42,
			name: "Engineering",
			users: [
				{
					id: "U123",
					role: "admin",
					email: "jane@example.com",
					username: "jane",
					realname: "Jane Doe",
					profile_img: "https://img.png",
				},
			],
		});
		expect(response.id).toBe(42);
		expect(response.name).toBe("Engineering");
		expect(response.users).toHaveLength(1);
		expect(response.users[0]?.username).toBe("jane");
	});

	test("parses team with empty users array", () => {
		const response = TeamResponseSchema.parse({
			id: 1,
			name: "Empty Team",
			users: [],
		});
		expect(response.users).toHaveLength(0);
	});
});

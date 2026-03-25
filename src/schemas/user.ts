import { z } from "zod";

/** Full user object (standups, polls, teams) -- API returns snake_case here */
export const FullUserSchema = z.object({
	id: z.string(),
	role: z.enum(["admin", "billing_admin", "member"]),
	email: z.string(),
	username: z.string(),
	realname: z.string().nullable(),
	profile_img: z.string(),
});

export type FullUser = z.output<typeof FullUserSchema>;

/** Compact user object (report members) -- API returns camelCase profileImg */
const CompactUserRawSchema = z.object({
	id: z.string(),
	username: z.string(),
	realname: z.string().nullable(),
	profileImg: z.string(),
});

export const CompactUserSchema = CompactUserRawSchema.transform((raw) => ({
	id: raw.id,
	username: raw.username,
	realname: raw.realname,
	profile_img: raw.profileImg, // NORM-01: camelCase -> snake_case
}));

export type CompactUser = z.output<typeof CompactUserSchema>;

/** Extended user from GET /v1/me response - has extra fields beyond FullUser */
export const MeUserSchema = z.object({
	id: z.string(),
	username: z.string(),
	realname: z.string().nullable(),
	firstname: z.string(),
	email: z.string(),
	profile_img: z.string(),
	timezone: z.string(),
	is_admin: z.boolean(),
	is_billing_admin: z.boolean(),
	role: z.enum(["admin", "billing_admin", "member"]),
});
export type MeUser = z.output<typeof MeUserSchema>;

/** GET /v1/me returns nested {user, team} */
export const MeResponseSchema = z.object({
	user: MeUserSchema,
	team: z.object({
		id: z.number(),
		name: z.string(),
	}),
});
export type MeResponse = z.output<typeof MeResponseSchema>;

/** Single team in GET /v1/me/teams response */
export const MeTeamSchema = z.object({
	id: z.number(),
	name: z.string(),
	is_admin: z.boolean(),
	standup_count: z.number(),
});
export type MeTeam = z.output<typeof MeTeamSchema>;

/** GET /v1/me/teams returns {teams: [...]} */
export const MeTeamsResponseSchema = z.object({
	teams: z.array(MeTeamSchema),
});
export type MeTeamsResponse = z.output<typeof MeTeamsResponseSchema>;

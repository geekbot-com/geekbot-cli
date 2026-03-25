import { z } from "zod";
import { FullUserSchema } from "./user.ts";

/** GET /v1/teams returns a single team object (not array) */
export const TeamResponseSchema = z.object({
	id: z.number(),
	name: z.string(),
	users: z.array(FullUserSchema),
});

export type TeamResponse = z.output<typeof TeamResponseSchema>;

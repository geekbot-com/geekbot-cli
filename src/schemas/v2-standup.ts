import { z } from "zod";
import {
	V2BroadcastChannelSchema,
	V2QuestionSchema,
	v2ItemEnvelope,
	v2ListEnvelope,
} from "./v2-common.ts";

export const V2StandupStateSchema = z.enum(["active", "paused"]);

export const V2StandupSchema = z.object({
	id: z.number(),
	name: z.string(),
	state: V2StandupStateSchema,
	time: z.string(),
	wait_time: z.number().nullable(),
	timezone: z.string(),
	days: z.array(z.string()),
	broadcast_channel: V2BroadcastChannelSchema,
	is_anonymous: z.boolean(),
	is_confidential: z.boolean(),
	owner: z.string(),
	created: z.string(),
	updated: z.string(),
	members: z.array(z.string()),
	questions: z.array(V2QuestionSchema).optional(),
});

export type V2Standup = z.output<typeof V2StandupSchema>;

export const V2StandupListResponseSchema = v2ListEnvelope(V2StandupSchema);
export const V2StandupItemResponseSchema = v2ItemEnvelope(V2StandupSchema);

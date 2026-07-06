import { z } from "zod";
import {
	V2BroadcastChannelSchema,
	V2QuestionSchema,
	v2ItemEnvelope,
	v2ListEnvelope,
} from "./v2-common.ts";

export const V2PollStateSchema = z.enum(["active", "paused"]);

export const V2PollSchema = z.object({
	id: z.number(),
	name: z.string(),
	state: V2PollStateSchema,
	time: z.string(),
	timezone: z.string(),
	days: z.array(z.string()),
	broadcast_channel: V2BroadcastChannelSchema,
	is_anonymous: z.boolean(),
	owner: z.string(),
	created: z.string(),
	updated: z.string(),
	members: z.array(
		z.object({
			id: z.string(),
			email: z.string().optional(),
			username: z.string().optional(),
			realname: z.string().optional(),
		}),
	),
	questions: z.array(V2QuestionSchema).optional(),
});

export type V2Poll = z.output<typeof V2PollSchema>;

export const V2PollListResponseSchema = v2ListEnvelope(V2PollSchema);
export const V2PollItemResponseSchema = v2ItemEnvelope(V2PollSchema);

const V2PollChoiceSchema = z.object({
	text: z.string(),
	votes: z.number(),
	voters: z.array(z.string()).nullable(),
});

const V2PollCategorySchema = z.object({
	name: z.string(),
	count: z.number(),
});

const V2PollResponseSchema = z.object({
	text: z.string(),
	categories: z.array(z.string()).optional().default([]),
	user_id: z.string().nullable(),
});

const V2PollQuestionResultSchema = z.object({
	question_id: z.number(),
	text: z.string(),
	answer_type: z.enum(["multiple_choice", "open_ended"]),
	total_responses: z.number(),
	total_responders: z.number(),
	choices: z.array(V2PollChoiceSchema).optional(),
	categorization_status: z
		.enum(["pending", "processing", "completed", "failed"])
		.nullable()
		.optional(),
	categories: z.array(V2PollCategorySchema).optional(),
	responses: z.array(V2PollResponseSchema).optional(),
});

const V2PollInstanceSchema = z.object({
	instance_id: z.number(),
	date: z.string(),
	questions: z.array(V2PollQuestionResultSchema),
});

export const V2PollVotesSchema = z.object({
	poll_id: z.number(),
	poll_name: z.string(),
	is_anonymous: z.boolean(),
	instances: z.array(V2PollInstanceSchema),
});

export type V2PollVotes = z.output<typeof V2PollVotesSchema>;

export const V2PollVotesResponseSchema = v2ItemEnvelope(V2PollVotesSchema);

export const V2PollParticipationSchema = z.object({
	poll_id: z.number(),
	is_poll: z.boolean(),
	date: z.string(),
	expected: z.number(),
	responded: z.number(),
	participation_rate: z.number(),
});
export const V2PollParticipationResponseSchema = v2ListEnvelope(V2PollParticipationSchema);

import { z } from "zod";
import { FullUserSchema } from "./user.ts";

/** Poll question within a poll */
const PollQuestionSchema = z.object({
	id: z.number(),
	text: z.string(),
	answer_type: z.string(),
	answer_choices: z.array(z.string()),
	add_own_options: z.boolean(),
	one_option_limit: z.boolean(),
});

/**
 * Recurrence day/month fields. The upstream poll-job-scheduler emits these as objects
 * with `value` and/or `order` keys (e.g. `{ value: "monday" }`, `{ order: "2nd", value: "wednesday" }`,
 * `{ order: "1st" }`, `{ value: "july" }`). A legacy string form (`"Mon"`) is also accepted
 * for forward/backward compatibility — no consumer reads these fields.
 */
const PollRecurrenceDaySchema = z.union([
	z.string(),
	z.object({
		value: z.string().optional(),
		order: z.string().optional(),
	}),
]);

const PollRecurrenceMonthSchema = z.union([
	z.string(),
	z.object({
		value: z.string().optional(),
		order: z.string().optional(),
	}),
]);

/** Poll recurrence settings */
const PollRecurrenceSchema = z
	.object({
		type: z.string(),
		repeat: z.number().nullable(),
		every: z.string().nullable(),
		day: PollRecurrenceDaySchema.nullable(),
		month: PollRecurrenceMonthSchema.nullable(),
	})
	.nullable();

/** Poll schema matching actual Geekbot API response */
export const PollSchema = z.object({
	id: z.number(),
	name: z.string(),
	time: z.string(),
	timezone: z.string(),
	questions: z.array(PollQuestionSchema),
	users: z.array(FullUserSchema),
	recurrence: PollRecurrenceSchema,
	sync_channel_members: z.boolean(),
	sync_channel: z.string().nullable(),
	dm_mode: z.boolean(),
	anonymous: z.boolean(),
	intro: z.string(),
	creator: FullUserSchema,
	users_total: z.number(),
	paused: z.boolean(),
});

export type Poll = z.output<typeof PollSchema>;

/** Poll list schema */
export const PollListSchema = z.array(PollSchema);

/** Poll vote answer within a result */
const PollVoteAnswerSchema = z.object({
	text: z.string(),
	catergory_id: z.union([z.string(), z.number()]), // API typo preserved, can be "uncategorized" or number
	votes: z.number(),
	percentage: z.number(),
	users: z.array(FullUserSchema).optional(),
});

/** Poll vote result for a specific date */
const PollVoteResultSchema = z.object({
	date: z.string().nullable(),
	answers: z.array(PollVoteAnswerSchema),
});

/** Poll vote question with aggregated results */
const PollVoteQuestionSchema = z.object({
	id: z.number(),
	text: z.string(),
	answer_type: z.string(),
	categories: z.array(z.union([z.string(), z.number()])),
	total_responses: z.number(),
	total_responders: z.number(),
	results: z.array(PollVoteResultSchema),
});

/** Poll vote instance */
const PollVoteInstanceSchema = z.object({
	id: z.number(),
	date: z.string().nullable(),
	answer_count: z.number(),
});

/** Aggregated votes response from GET /v1/polls/{id}/votes */
export const PollVotesResponseSchema = z.object({
	total_results: z.number(),
	questions: z.array(PollVoteQuestionSchema),
	instances: z.array(PollVoteInstanceSchema),
});

export type PollVotesResponse = z.output<typeof PollVotesResponseSchema>;

import { z } from "zod";
import { DayAbbreviation, NullableString, TimezoneSchema } from "./common.ts";
import { FullUserSchema } from "./user.ts";

export const QuestionSchema = z.object({
	id: z.number(),
	color: z.string(),
	text: z.string(),
	schedule: z.unknown().nullable(),
	answer_type: z.string(),
	answer_choices: z.array(z.string()),
	hasAnswers: z.boolean(),
	is_random: z.boolean(),
	random_texts: z.array(z.string()),
	prefilled_by: z.unknown().nullable(),
	text_id: z.number().nullable(),
	preconditions: z.array(z.unknown()),
	label: NullableString,
	flavor: z.string(),
});

export type Question = z.output<typeof QuestionSchema>;

/** Raw standup schema as returned by the API (wait_time in seconds) */
const StandupRawSchema = z.object({
	id: z.number(),
	name: z.string(),
	channel: z.string(),
	channel_id: z.string().optional(),
	time: z.string(),
	timezone: TimezoneSchema,
	days: z.array(DayAbbreviation),
	questions: z.array(QuestionSchema),
	users: z.array(FullUserSchema),
	wait_time: z.number(), // API returns seconds
	personalised: z.boolean().optional(),
	confidential: z.boolean(),
	anonymous: z.boolean(),
	sync_channel_members: z.boolean().optional(),
	master_id: z.number().nullable().optional(),
	channel_ready: z.boolean().optional(),
	draft: z.boolean().optional(),
	paused: z.boolean().optional(),
	users_total: z.number().optional(),
	webhooks: z.array(z.unknown()).optional(),
	master: z.unknown().nullable().optional(),
	sync_channel_ready: z.boolean().optional(),
	sync_channel: z.string().nullable().optional(),
});

/** Normalize a raw standup: convert wait_time from seconds to minutes */
function normalizeStandup(raw: z.output<typeof StandupRawSchema>) {
	return { ...raw, wait_time: raw.wait_time / 60 }; // NORM: seconds -> minutes (Pitfall 1)
}

/** Normalized standup -- wait_time converted from seconds to minutes */
export const StandupSchema = StandupRawSchema.transform(normalizeStandup);

export type Standup = z.output<typeof StandupSchema>;

/** Schema for an array of standups */
export const StandupListSchema = z
	.array(StandupRawSchema)
	.transform((items) => items.map(normalizeStandup));

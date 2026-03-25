import { z } from "zod";
import { CompactUserSchema } from "./user.ts";

/** Answer within a report (shared fields between GET and POST responses) */
const ReportAnswerSchema = z.object({
	id: z.number(),
	question: z.string().optional().default(""),
	question_id: z.number().optional(),
	answer: z.string(),
	answer_type: z.string().optional().default("text"),
	images: z.array(z.object({
		title: z.string(),
		image_url: z.string(),
	})).optional().default([]),
	color: z.string().optional().default(""),
});

export type ReportAnswer = z.output<typeof ReportAnswerSchema>;

/**
 * Timeline report format (GET /v1/reports).
 * API returns: id, slack_ts, standup_id, timestamp, channel, is_anonymous,
 * broadcast_thread, is_confidential, member (CompactUser), questions (answers array)
 */
const TimelineReportRawSchema = z.object({
	id: z.number(),
	standup_id: z.number(),
	timestamp: z.number(),
	slack_ts: z.string().nullable().optional(),
	channel: z.string().optional().default(""),
	questions: z.array(ReportAnswerSchema),
	member: CompactUserSchema,
	is_anonymous: z.boolean().optional().default(false),
	broadcast_thread: z.boolean().optional().default(false),
	is_confidential: z.boolean().optional().default(false),
	standup_name: z.string().optional().default(""),
});

/**
 * Submitted report format (POST /v1/reports).
 * API returns: id, slack_ts, standup_id, timestamp, started_at, done_at,
 * broadcasted_at, channel, member (CompactUser with role), answers (array)
 */
const SubmittedReportRawSchema = z.object({
	id: z.number(),
	standup_id: z.number(),
	timestamp: z.number(),
	slack_ts: z.string().nullable().optional(),
	started_at: z.number().optional(),
	done_at: z.number().optional(),
	broadcasted_at: z.number().nullable().optional(),
	channel: z.string().optional().default(""),
	member: z
		.object({
			id: z.string(),
			role: z.string().optional(),
			username: z.string(),
			realname: z.string().nullable(),
			profileImg: z.string(),
		})
		.optional(),
	answers: z.array(ReportAnswerSchema),
	is_anonymous: z.boolean().optional().default(false),
});

/**
 * Unified Report type. Both formats normalize to this shape.
 * NORM-03: Two different API response formats -> one consistent type.
 */
export interface Report {
	id: number;
	standup_id: number;
	created_at: string;
	questions: ReportAnswer[];
	member: { id: string; username: string; realname: string | null; profile_img: string } | null;
	is_anonymous: boolean;
	standup_name: string;
}

/** Normalize a raw timeline report to the unified Report shape */
function normalizeTimelineReport(raw: z.output<typeof TimelineReportRawSchema>): Report {
	return {
		id: raw.id,
		standup_id: raw.standup_id,
		created_at: new Date(raw.timestamp * 1000).toISOString(),
		questions: raw.questions,
		member: raw.member, // Already normalized by CompactUserSchema (profileImg -> profile_img)
		is_anonymous: raw.is_anonymous,
		standup_name: raw.standup_name,
	};
}

/** Parse a timeline report (GET) and normalize to unified Report */
export const TimelineReportSchema = TimelineReportRawSchema.transform(normalizeTimelineReport);

/** Parse a submitted report (POST) and normalize to unified Report */
export const SubmittedReportSchema = SubmittedReportRawSchema.transform(
	(raw): Report => ({
		id: raw.id,
		standup_id: raw.standup_id,
		created_at: new Date(raw.timestamp * 1000).toISOString(),
		questions: raw.answers, // POST uses "answers" key, normalize to "questions"
		member: raw.member
			? {
					id: raw.member.id,
					username: raw.member.username,
					realname: raw.member.realname,
					profile_img: raw.member.profileImg,
				}
			: null,
		is_anonymous: raw.is_anonymous,
		standup_name: "",
	}),
);

/** Parse a list of timeline reports */
export const TimelineReportListSchema = z
	.array(TimelineReportRawSchema)
	.transform((items) => items.map(normalizeTimelineReport));

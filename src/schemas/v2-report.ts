import { z } from "zod";
import { v2ItemEnvelope, v2ListEnvelope } from "./v2-common.ts";

export const V2ReportAnswerSchema = z.object({
	id: z.number(),
	question_id: z.number(),
	question: z.string(),
	answer: z.string().nullable(),
});

export type V2ReportAnswer = z.output<typeof V2ReportAnswerSchema>;

export const V2ReportSchema = z.object({
	id: z.number(),
	standup_id: z.number(),
	standup_name: z.string(),
	user_id: z.string().nullable(),
	posted_at: z.string().nullable(),
	is_anonymous: z.boolean(),
	is_confidential: z.boolean(),
	answers: z.array(V2ReportAnswerSchema).optional(),
});

export type V2Report = z.output<typeof V2ReportSchema>;

export const V2ReportListResponseSchema = v2ListEnvelope(V2ReportSchema);
export const V2ReportItemResponseSchema = v2ItemEnvelope(V2ReportSchema);

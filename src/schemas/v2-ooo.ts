import { z } from "zod";
import { v2ItemEnvelope, v2ListEnvelope } from "./v2-common.ts";

export const V2OooPeriodSchema = z.object({
	id: z.number(),
	user_id: z.string(),
	start_date: z.string(),
	end_date: z.string(),
	days: z.number(),
	timezone: z.string().nullable(),
	created_at: z.string().nullable(),
});

export type V2OooPeriod = z.output<typeof V2OooPeriodSchema>;

export const V2OooListResponseSchema = v2ListEnvelope(V2OooPeriodSchema);
export const V2OooItemResponseSchema = v2ItemEnvelope(V2OooPeriodSchema);

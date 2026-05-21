import { z } from "zod";

export const V2BroadcastChannelSchema = z
	.object({
		id: z.string(),
		name: z.string(),
	})
	.nullable();

export const V2QuestionSchema = z.object({
	id: z.number(),
	question: z.string(),
	position: z.number(),
	answer_type: z.string(),
});

export function v2ListEnvelope<T extends z.ZodTypeAny>(item: T) {
	return z.object({
		data: z.array(item),
		next_cursor: z.string().nullable(),
		has_more: z.boolean(),
	});
}

export function v2ItemEnvelope<T extends z.ZodTypeAny>(item: T) {
	return z.object({
		data: item,
	});
}

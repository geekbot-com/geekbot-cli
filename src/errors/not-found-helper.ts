import type { HttpClient } from "../http/client.ts";

/**
 * Resource types that support not-found suggestions.
 * Each maps to a list endpoint and a display formatter.
 */
export type ResourceType = "standup" | "poll";

interface ResourceListItem {
	id: number;
	name: string;
}

/**
 * Extract items with id+name from a v2 list envelope `{ data: [...] }`.
 * Shared across all resource types since the shape is identical.
 */
function extractItems(raw: unknown): ResourceListItem[] {
	if (typeof raw !== "object" || raw === null) return [];
	const data = (raw as { data?: unknown }).data;
	if (!Array.isArray(data)) return [];
	return data
		.filter(
			(item): item is { id: number; name: string } =>
				typeof item === "object" &&
				item !== null &&
				typeof item.id === "number" &&
				typeof item.name === "string",
		)
		.map(({ id, name }) => ({ id, name }));
}

/**
 * Resource type configurations for fetching alternatives.
 * Maps each resource to its list endpoint and how to extract id+name.
 */
const RESOURCE_CONFIG: Record<
	ResourceType,
	{
		listPath: string;
		extractItems: (data: unknown) => ResourceListItem[];
	}
> = {
	standup: { listPath: "/v2/standups", extractItems },
	poll: { listPath: "/v2/polls", extractItems },
};

/**
 * Build a suggestion string for a 404 error by fetching and listing
 * available alternatives for the given resource type.
 *
 * Returns a suggestion string like:
 *   "Available standups: 123 (Daily Standup), 456 (Weekly Review). Run `geekbot standup list` to see all."
 *
 * Returns null if the list fetch fails or returns no items.
 * Silently catches errors so a failed suggestion never blocks the main error flow.
 *
 * @param client - An authenticated HttpClient
 * @param resourceType - The type of resource that was not found
 * @param maxItems - Maximum number of alternatives to show (default: 5)
 */
export async function buildNotFoundSuggestion(
	client: HttpClient,
	resourceType: ResourceType,
	maxItems = 5,
): Promise<string | null> {
	const config = RESOURCE_CONFIG[resourceType];
	if (!config) return null;

	try {
		const rawData = await client.get<unknown>(config.listPath);
		const items = config.extractItems(rawData);

		if (items.length === 0) {
			return `No ${resourceType}s found. Run \`geekbot ${resourceType} create\` to create one.`;
		}

		const shown = items.slice(0, maxItems);
		const formatted = shown.map((item) => `${item.id} (${item.name})`).join(", ");
		const suffix = items.length > maxItems ? ` and ${items.length - maxItems} more` : "";

		return `Available ${resourceType}s: ${formatted}${suffix}. Run \`geekbot ${resourceType} list\` to see all.`;
	} catch {
		// Suggestion is best-effort. If the list fetch fails (e.g., auth issues),
		// return null and let the original 404 error propagate without a suggestion.
		return null;
	}
}

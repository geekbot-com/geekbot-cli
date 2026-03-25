import type { GlobalOptions } from "../cli/globals.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import { TeamResponseSchema } from "../schemas/team.ts";

/**
 * Handle `geekbot team list` command.
 * GET /v1/teams returns a SINGLE team object {id, name, users: [...]}, NOT an array.
 * Uses success() not successList() because the API returns one team.
 */
export async function handleTeamList(globalOpts: GlobalOptions): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);
	const raw = await client.get<unknown>("/v1/teams");
	const team = TeamResponseSchema.parse(raw);
	writeOutput(success(team));
}

/**
 * Handle `geekbot team search` command.
 * Fetches team members and filters by case-insensitive substring match
 * across username, realname, and email.
 */
export async function handleTeamSearch(query: string, globalOpts: GlobalOptions): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);
	const raw = await client.get<unknown>("/v1/teams");
	const team = TeamResponseSchema.parse(raw);

	const needle = query.toLowerCase();
	const matches = team.users.filter(
		(u) =>
			u.username.toLowerCase().includes(needle) ||
			(u.realname?.toLowerCase().includes(needle) ?? false) ||
			u.email.toLowerCase().includes(needle),
	);

	writeOutput(successList(matches));
}

import type { GlobalOptions } from "../cli/globals.ts";
import { createAuthenticatedClient } from "../http/authenticated-client.ts";
import { success, successList } from "../output/envelope.ts";
import { writeOutput } from "../output/formatter.ts";
import { MeResponseSchema, MeTeamsResponseSchema } from "../schemas/user.ts";

/**
 * Handle `geekbot me show` command.
 * GET /v1/me returns {user, team}. We extract user portion only.
 */
export async function handleMeShow(globalOpts: GlobalOptions): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);
	const raw = await client.get<unknown>("/v1/me");
	const meResponse = MeResponseSchema.parse(raw);
	writeOutput(success(meResponse.user));
}

/**
 * Handle `geekbot me teams` command.
 * GET /v1/me/teams returns {teams: [...]}.
 */
export async function handleMeTeams(globalOpts: GlobalOptions): Promise<void> {
	const client = await createAuthenticatedClient(globalOpts);
	const raw = await client.get<unknown>("/v1/me/teams");
	const teamsResponse = MeTeamsResponseSchema.parse(raw);
	writeOutput(successList(teamsResponse.teams));
}

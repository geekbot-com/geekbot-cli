import { describe, expect, test } from "bun:test";
import { CliError } from "../../src/errors/cli-error.ts";
import { createHttpClient } from "../../src/http/client.ts";
import { API_KEY, testClient } from "./helpers.ts";

describe.skipIf(!API_KEY)("Error Path Integration", () => {
	const client = testClient();

	test("GET non-existent standup returns not_found error", async () => {
		try {
			await client.get<unknown>("/v2/standups/999999999");
			// Should not reach here
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(CliError);
			const cliErr = error as CliError;
			expect(cliErr.code).toBe("not_found");
			expect(cliErr.exitCode).toBe(3); // ExitCode.NOT_FOUND
		}
	}, 15000);

	test("GET non-existent poll returns not_found error", async () => {
		try {
			await client.get<unknown>("/v2/polls/999999999");
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(CliError);
			const cliErr = error as CliError;
			expect(cliErr.code).toBe("not_found");
			expect(cliErr.exitCode).toBe(3); // ExitCode.NOT_FOUND
		}
	}, 15000);

	test("invalid API key returns auth error", async () => {
		const badClient = createHttpClient("invalid-api-key-12345");
		try {
			await badClient.get<unknown>("/v1/me");
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(CliError);
			const cliErr = error as CliError;
			expect(cliErr.code).toBe("unauthorized");
			expect(cliErr.exitCode).toBe(4); // ExitCode.AUTH
		}
	}, 15000);
});

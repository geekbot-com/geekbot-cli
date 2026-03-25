import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CliError } from "../../src/errors/cli-error.ts";
import { ExitCode } from "../../src/errors/exit-codes.ts";

// --- Mocks ---
// Only mock resolveCredential — let createHttpClient run for real
// (it just creates a client object, no network calls during construction).
// This avoids mock.module on client.ts which leaks into client.test.ts.

const mockResolveCredential = mock(() =>
	Promise.resolve({ apiKey: "resolved-key", source: "env" as const }),
);

mock.module("../../src/auth/resolver.ts", () => ({
	resolveCredential: mockResolveCredential,
}));

// Import AFTER mocks are wired up
import type { GlobalOptions } from "../../src/cli/globals.ts";
import { createAuthenticatedClient } from "../../src/http/authenticated-client.ts";

const defaultGlobalOpts: GlobalOptions = {
	apiKey: undefined,
	output: "json",
	debug: false,
};

describe("createAuthenticatedClient", () => {
	beforeEach(() => {
		mockResolveCredential.mockClear();
		mockResolveCredential.mockImplementation(() =>
			Promise.resolve({ apiKey: "resolved-key", source: "env" as const }),
		);
	});

	test("resolves credential and returns an HTTP client with expected methods", async () => {
		const client = await createAuthenticatedClient(defaultGlobalOpts);

		expect(mockResolveCredential).toHaveBeenCalledTimes(1);
		expect(client).toBeDefined();
		expect(typeof client.get).toBe("function");
		expect(typeof client.post).toBe("function");
		expect(typeof client.patch).toBe("function");
		expect(typeof client.put).toBe("function");
		expect(typeof client.delete).toBe("function");
	});

	test("passes apiKey flag through to resolveCredential", async () => {
		const opts: GlobalOptions = { apiKey: "flag-key", output: "json", debug: false };

		await createAuthenticatedClient(opts);

		expect(mockResolveCredential).toHaveBeenCalledWith({ apiKeyFlag: "flag-key" });
	});

	test("passes undefined apiKeyFlag when no --api-key flag given", async () => {
		await createAuthenticatedClient(defaultGlobalOpts);

		expect(mockResolveCredential).toHaveBeenCalledWith({ apiKeyFlag: undefined });
	});

	test("propagates CliError when resolveCredential fails", async () => {
		const authError = new CliError(
			"No API key found.",
			"auth_missing",
			ExitCode.AUTH,
			false,
			"Set GEEKBOT_API_KEY environment variable or run: geekbot auth setup",
		);
		mockResolveCredential.mockRejectedValueOnce(authError);

		try {
			await createAuthenticatedClient(defaultGlobalOpts);
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(CliError);
			const err = e as CliError;
			expect(err.code).toBe("auth_missing");
			expect(err.exitCode).toBe(ExitCode.AUTH);
		}
	});

	test("propagates unexpected errors from resolveCredential", async () => {
		mockResolveCredential.mockRejectedValueOnce(new Error("keychain locked"));

		try {
			await createAuthenticatedClient(defaultGlobalOpts);
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(Error);
			expect((e as Error).message).toBe("keychain locked");
		}
	});
});

import { describe, expect, test } from "bun:test";
import { API_KEY } from "./helpers.ts";

const CLI_PATH = `${import.meta.dir}/../../src/cli/index.ts`;

/**
 * Run the CLI as a subprocess and capture stdout, stderr, and exit code.
 */
async function runCli(args: string[]): Promise<{
	stdout: string;
	stderr: string;
	exitCode: number;
}> {
	const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
		env: { ...process.env },
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exitCode = await proc.exited;

	return { stdout, stderr, exitCode };
}

describe.skipIf(!API_KEY)("E2E CLI Integration", () => {
	test("me show outputs valid JSON envelope", async () => {
		const { stdout, exitCode } = await runCli(["me", "show", "--api-key", API_KEY!]);

		expect(exitCode).toBe(0);

		const envelope = JSON.parse(stdout);
		expect(envelope.ok).toBe(true);
		expect(envelope.data).toBeDefined();
		expect(envelope.data.id).toBeDefined();
		expect(envelope.data.username).toBeDefined();
		expect(envelope.error).toBeNull();
		expect(envelope.metadata).toBeDefined();
		expect(typeof envelope.metadata.timestamp).toBe("string");
	}, 15000);

	test("me teams outputs valid JSON envelope with list", async () => {
		const { stdout, exitCode } = await runCli(["me", "teams", "--api-key", API_KEY!]);

		expect(exitCode).toBe(0);

		const envelope = JSON.parse(stdout);
		expect(envelope.ok).toBe(true);
		expect(Array.isArray(envelope.data)).toBe(true);
		expect(envelope.data.length).toBeGreaterThanOrEqual(1);
	}, 15000);

	test("team list outputs valid JSON envelope", async () => {
		const { stdout, exitCode } = await runCli(["team", "list", "--api-key", API_KEY!]);

		expect(exitCode).toBe(0);

		const envelope = JSON.parse(stdout);
		expect(envelope.ok).toBe(true);
		expect(envelope.data).toBeDefined();
		expect(typeof envelope.data.id).toBe("number");
		expect(Array.isArray(envelope.data.users)).toBe(true);
	}, 15000);

	test("standup list outputs valid JSON envelope", async () => {
		const { stdout, exitCode } = await runCli(["standup", "list", "--api-key", API_KEY!]);

		expect(exitCode).toBe(0);

		const envelope = JSON.parse(stdout);
		expect(envelope.ok).toBe(true);
		expect(Array.isArray(envelope.data)).toBe(true);
	}, 15000);

	test("invalid API key produces error envelope with exit code 4", async () => {
		const { stdout, exitCode } = await runCli(["me", "show", "--api-key", "invalid-key-12345"]);

		expect(exitCode).toBe(4); // ExitCode.AUTH

		const envelope = JSON.parse(stdout);
		expect(envelope.ok).toBe(false);
		expect(envelope.data).toBeNull();
		expect(envelope.error).toBeDefined();
		expect(envelope.error.code).toBe("unauthorized");
		expect(typeof envelope.error.message).toBe("string");
		expect(typeof envelope.error.retryable).toBe("boolean");
	}, 15000);

	test("non-existent standup produces error envelope with exit code 3", async () => {
		const { stdout, exitCode } = await runCli([
			"standup",
			"get",
			"999999999",
			"--api-key",
			API_KEY!,
		]);

		expect(exitCode).toBe(3); // ExitCode.NOT_FOUND

		const envelope = JSON.parse(stdout);
		expect(envelope.ok).toBe(false);
		expect(envelope.error.code).toBe("not_found");
	}, 15000);

	test("--debug flag writes debug output to stderr", async () => {
		const { stderr, exitCode } = await runCli([
			"standup",
			"get",
			"999999999",
			"--api-key",
			API_KEY!,
			"--debug",
		]);

		// Non-zero exit (not found), but debug info should be on stderr
		expect(exitCode).toBeGreaterThan(0);
		expect(stderr).toContain("[debug]");
	}, 15000);

	test("standup update --questions patches questions via PATCH", async () => {
		const name = `e2e-update-questions-${Date.now()}`;
		const createResult = await runCli([
			"standup",
			"create",
			"--name",
			name,
			"--channel",
			"geekbot-skill-tests",
			"--questions",
			'["Original question?"]',
			"--api-key",
			API_KEY!,
		]);

		if (createResult.exitCode !== 0) {
			throw new Error("SKIP: could not create standup for update-questions test");
		}

		const createEnvelope = JSON.parse(createResult.stdout);
		const standupId = createEnvelope.data.id;

		try {
			// Update questions via PATCH
			const updateResult = await runCli([
				"standup",
				"update",
				String(standupId),
				"--questions",
				'["Updated question?","Second question?"]',
				"--api-key",
				API_KEY!,
			]);

			expect(updateResult.exitCode).toBe(0);

			const updateEnvelope = JSON.parse(updateResult.stdout);
			expect(updateEnvelope.ok).toBe(true);

			// Verify questions were actually changed
			const getResult = await runCli([
				"standup",
				"get",
				String(standupId),
				"--api-key",
				API_KEY!,
			]);

			expect(getResult.exitCode).toBe(0);
			const getEnvelope = JSON.parse(getResult.stdout);
			const questions = getEnvelope.data.questions.map((q: { text: string }) => q.text);
			expect(questions).toEqual(["Updated question?", "Second question?"]);
		} finally {
			await runCli(["standup", "delete", String(standupId), "--yes", "--api-key", API_KEY!]);
		}
	}, 30000);

	test("standup delete --yes deletes a standup and returns confirmation", async () => {
		const name = `e2e-delete-confirm-${Date.now()}`;
		const createResult = await runCli([
			"standup",
			"create",
			"--name",
			name,
			"--channel",
			"geekbot-skill-tests",
			"--questions",
			'["Delete test?"]',
			"--api-key",
			API_KEY!,
		]);

		if (createResult.exitCode !== 0) {
			throw new Error("SKIP: could not create standup for delete test");
		}

		const createEnvelope = JSON.parse(createResult.stdout);
		const standupId = createEnvelope.data.id;

		// Delete with --yes
		const deleteResult = await runCli([
			"standup",
			"delete",
			String(standupId),
			"--yes",
			"--api-key",
			API_KEY!,
		]);

		expect(deleteResult.exitCode).toBe(0);

		const deleteEnvelope = JSON.parse(deleteResult.stdout);
		expect(deleteEnvelope.ok).toBe(true);

		// Verify it's gone
		const getResult = await runCli([
			"standup",
			"get",
			String(standupId),
			"--api-key",
			API_KEY!,
		]);

		expect(getResult.exitCode).toBe(3); // NOT_FOUND
	}, 30000);

	test("delete without --yes produces validation error with exit code 6", async () => {
		// Create a standup specifically for this test to avoid race conditions
		const createResult = await runCli([
			"standup",
			"create",
			"--name",
			`e2e-delete-test-${Date.now()}`,
			"--channel",
			"geekbot-skill-tests",
			"--questions",
			'["Delete confirm test?"]',
			"--api-key",
			API_KEY!,
		]);

		if (createResult.exitCode !== 0) {
			throw new Error("SKIP: could not create standup for delete test");
		}

		const createEnvelope = JSON.parse(createResult.stdout);
		const standupId = createEnvelope.data.id;

		try {
			const deleteResult = await runCli([
				"standup",
				"delete",
				String(standupId),
				"--api-key",
				API_KEY!,
			]);

			expect(deleteResult.exitCode).toBe(6); // ExitCode.VALIDATION

			const deleteEnvelope = JSON.parse(deleteResult.stdout);
			expect(deleteEnvelope.ok).toBe(false);
			expect(deleteEnvelope.error.code).toBe("confirmation_required");
			expect(deleteEnvelope.error.suggestion).toContain("--yes");
		} finally {
			// Clean up the standup
			await runCli(["standup", "delete", String(standupId), "--yes", "--api-key", API_KEY!]);
		}
	}, 30000);
});

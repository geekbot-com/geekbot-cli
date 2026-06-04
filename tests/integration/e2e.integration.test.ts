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
		const { stdout, exitCode } = await runCli(["me", "show", "--api-key", API_KEY as string]);

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
		const { stdout, exitCode } = await runCli(["me", "teams", "--api-key", API_KEY as string]);

		expect(exitCode).toBe(0);

		const envelope = JSON.parse(stdout);
		expect(envelope.ok).toBe(true);
		expect(Array.isArray(envelope.data)).toBe(true);
		expect(envelope.data.length).toBeGreaterThanOrEqual(1);
	}, 15000);

	test("team list outputs valid JSON envelope", async () => {
		const { stdout, exitCode } = await runCli(["team", "list", "--api-key", API_KEY as string]);

		expect(exitCode).toBe(0);

		const envelope = JSON.parse(stdout);
		expect(envelope.ok).toBe(true);
		expect(envelope.data).toBeDefined();
		expect(typeof envelope.data.id).toBe("number");
		expect(Array.isArray(envelope.data.users)).toBe(true);
	}, 15000);

	test("standup list outputs valid JSON envelope", async () => {
		const { stdout, exitCode } = await runCli(["standup", "list", "--api-key", API_KEY as string]);

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
			API_KEY as string,
		]);

		expect(exitCode).toBe(3); // ExitCode.NOT_FOUND

		const envelope = JSON.parse(stdout);
		expect(envelope.ok).toBe(false);
		expect(envelope.error.code).toBe("not_found");
	}, 15000);
});

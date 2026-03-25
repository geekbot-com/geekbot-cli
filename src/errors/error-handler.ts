import type { FailureEnvelope } from "../types.ts";
import { CliError } from "./cli-error.ts";
import { ExitCode } from "./exit-codes.ts";

export function handleError(error: unknown, debug: boolean = false): never {
	if (error instanceof CliError) {
		const envelope: FailureEnvelope = {
			ok: false,
			data: null,
			error: {
				code: error.code,
				message: error.message,
				retryable: error.retryable,
				suggestion: error.suggestion ?? null,
			},
			metadata: {
				timestamp: new Date().toISOString(),
			},
		};

		process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);

		if (debug && error.context) {
			process.stderr.write(`[debug] Error context: ${JSON.stringify(error.context)}\n`);
		}

		process.exit(error.exitCode);
	}

	// Unknown/unexpected error
	const envelope: FailureEnvelope = {
		ok: false,
		data: null,
		error: {
			code: "internal_error",
			message: error instanceof Error ? error.message : String(error),
			retryable: false,
			suggestion: "This is an unexpected error. Please report it.",
		},
		metadata: {
			timestamp: new Date().toISOString(),
		},
	};

	process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
	process.exit(ExitCode.GENERAL);
}

import { ZodError } from "zod";
import type { FailureEnvelope } from "../types.ts";
import { CliError } from "./cli-error.ts";
import { ExitCode } from "./exit-codes.ts";

function formatZodMessage(error: ZodError): string {
	return error.issues
		.map((issue) => {
			const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
			return `${path}: ${issue.message}`;
		})
		.join("; ");
}

export function handleError(error: unknown, debug: boolean = false): never {
	if (error instanceof ZodError) {
		const envelope: FailureEnvelope = {
			ok: false,
			data: null,
			error: {
				code: "schema_validation_error",
				message: `Unexpected API response: ${formatZodMessage(error)}`,
				retryable: false,
				suggestion:
					"The API returned data in an unexpected format. The API may have changed or there may be a version mismatch.",
			},
			metadata: {
				timestamp: new Date().toISOString(),
			},
		};

		process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);

		if (debug) {
			process.stderr.write(`[debug] ZodError issues: ${JSON.stringify(error.issues)}\n`);
		}

		process.exit(ExitCode.VALIDATION);
	}

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

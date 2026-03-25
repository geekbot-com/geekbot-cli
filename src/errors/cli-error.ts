import type { ExitCodeValue } from "./exit-codes.ts";

export class CliError extends Error {
	public override readonly name = "CliError";

	constructor(
		message: string,
		public readonly code: string,
		public readonly exitCode: ExitCodeValue,
		public readonly retryable: boolean = false,
		public readonly suggestion?: string,
		public readonly context?: Record<string, unknown>,
	) {
		super(message);
	}
}

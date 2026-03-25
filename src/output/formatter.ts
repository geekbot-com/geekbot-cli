import type { OutputEnvelope } from "../types.ts";

/**
 * Write the output envelope to stdout as JSON.
 * This is the ONLY function in the entire codebase that writes to stdout.
 *
 * Phase 1 always outputs JSON. Table output will be added in Phase 3 (CLI-07).
 * The format parameter is accepted now for forward compatibility.
 */
export function writeOutput<T>(envelope: OutputEnvelope<T>, _format: "json" = "json"): void {
	process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
}

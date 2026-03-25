/**
 * Check if stdout is connected to a terminal (TTY).
 * Returns false when output is piped, redirected, or in a non-interactive context.
 */
export function isTTY(): boolean {
	return process.stdout.isTTY === true;
}

export type MutationOperation = "created" | "updated" | "deleted" | "started";

/**
 * Build a mutation receipt with operation type and undo command.
 */
export function buildReceipt(
	operation: MutationOperation,
	undo: string | null,
): { operation: MutationOperation; undo: string | null } {
	return { operation, undo };
}

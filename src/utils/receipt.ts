import type { Standup } from "../schemas/standup.ts";

/**
 * Escape a string for safe inclusion in a shell command.
 * Wraps in single quotes and escapes any embedded single quotes.
 */
export function shellEscape(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
}

export type MutationOperation = "created" | "updated" | "deleted" | "duplicated" | "started";

/**
 * Build a mutation receipt with operation type and undo command.
 */
export function buildReceipt(
	operation: MutationOperation,
	undo: string | null,
): { operation: MutationOperation; undo: string | null } {
	return { operation, undo };
}

/**
 * Build an undo command that reconstructs a create command from a deleted standup.
 * Used by delete operations to provide a reversal hint in the receipt.
 */
export function buildDeleteUndoCommand(standup: Standup): string {
	const parts: string[] = [
		`geekbot standup create --name ${shellEscape(standup.name)} --channel ${shellEscape(standup.channel)}`,
	];

	if (standup.time) {
		parts.push(`--time ${shellEscape(standup.time.slice(0, 5))}`);
	}

	if (standup.timezone) {
		parts.push(`--timezone ${shellEscape(standup.timezone)}`);
	}

	if (standup.days.length > 0) {
		parts.push(`--days ${shellEscape(standup.days.join(","))}`);
	}

	if (standup.wait_time > 0) {
		parts.push(`--wait-time ${standup.wait_time}`);
	}

	if (standup.questions.length > 0) {
		parts.push(`--questions ${shellEscape(JSON.stringify(standup.questions.map((q) => q.text)))}`);
	}

	return parts.join(" ");
}

/** Map of standup field names to CLI flag names */
const FIELD_TO_FLAG: Record<string, string> = {
	name: "--name",
	channel: "--channel",
	time: "--time",
	timezone: "--timezone",
	days: "--days",
	wait_time: "--wait-time",
};

/**
 * Build an undo command that reverts only the changed fields of an update.
 * Uses the previous state to reconstruct the original values.
 */
export function buildUpdateUndoCommand(
	id: number,
	previousState: Standup,
	changedFields: Record<string, unknown>,
): string {
	const parts: string[] = [`geekbot standup update ${id}`];

	for (const key of Object.keys(changedFields)) {
		const flag = FIELD_TO_FLAG[key];
		if (!flag) continue;

		const prevValue = previousState[key as keyof Standup];

		if (key === "time" && typeof prevValue === "string") {
			parts.push(`${flag} ${shellEscape(prevValue.slice(0, 5))}`);
		} else if (key === "days" && Array.isArray(prevValue)) {
			parts.push(`${flag} ${shellEscape(prevValue.join(","))}`);
		} else if (typeof prevValue === "number") {
			parts.push(`${flag} ${prevValue}`);
		} else if (typeof prevValue === "string") {
			parts.push(`${flag} ${shellEscape(prevValue)}`);
		}
	}

	return parts.join(" ");
}

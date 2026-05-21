const IDEMPOTENCY_HEADER = "Idempotency-Key";

export function newIdempotencyKey(): string {
	return crypto.randomUUID();
}

export function idempotencyHeader(key: string = newIdempotencyKey()): Record<string, string> {
	return { [IDEMPOTENCY_HEADER]: key };
}

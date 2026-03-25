import type { ErrorObject, FailureEnvelope, SuccessEnvelope } from "../types.ts";

/**
 * Create a success envelope for a single item.
 * Shape: { ok: true, data: T, error: null, metadata: { timestamp, ...extra } }
 */
export function success<T>(data: T, meta?: Record<string, unknown>): SuccessEnvelope<T> {
	return {
		ok: true,
		data,
		error: null,
		metadata: {
			timestamp: new Date().toISOString(),
			...meta,
		},
	};
}

/**
 * Create a success envelope for a list of items.
 * Shape: { ok: true, data: T[], error: null, metadata: { timestamp, count: N, ...extra } }
 */
export function successList<T>(data: T[], meta?: Record<string, unknown>): SuccessEnvelope<T[]> {
	return {
		ok: true,
		data,
		error: null,
		metadata: {
			timestamp: new Date().toISOString(),
			count: data.length,
			...meta,
		},
	};
}

/**
 * Create a failure envelope from an ErrorObject.
 * Shape: { ok: false, data: null, error: ErrorObject, metadata: { timestamp, ...extra } }
 */
export function failure(error: ErrorObject, meta?: Record<string, unknown>): FailureEnvelope {
	return {
		ok: false,
		data: null,
		error,
		metadata: {
			timestamp: new Date().toISOString(),
			...meta,
		},
	};
}

export interface ErrorObject {
	code: string; // machine-readable: "standup_not_found"
	message: string; // human-readable
	retryable: boolean;
	suggestion: string | null;
}

export interface MetadataObject {
	timestamp: string; // ISO 8601
	[key: string]: unknown;
}

export interface OutputEnvelope<T> {
	ok: boolean;
	data: T | null;
	error: ErrorObject | null;
	metadata: MetadataObject;
}

export interface SuccessEnvelope<T> extends OutputEnvelope<T> {
	ok: true;
	data: T;
	error: null;
}

export interface FailureEnvelope extends OutputEnvelope<null> {
	ok: false;
	data: null;
	error: ErrorObject;
}

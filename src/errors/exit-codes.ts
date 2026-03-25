export const ExitCode = {
	SUCCESS: 0,
	GENERAL: 1,
	USAGE: 2,
	NOT_FOUND: 3,
	AUTH: 4,
	FORBIDDEN: 5,
	VALIDATION: 6,
	NETWORK: 7,
	CONFLICT: 8,
	API_ERROR: 9,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

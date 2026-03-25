import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const mockHandleError = mock();
const mockHandlers = {
	handleAuthSetup: mock(() => Promise.resolve()),
	handleAuthStatus: mock(() => Promise.resolve()),
	handleAuthRemove: mock(() => Promise.resolve()),
};
mock.module("../../../src/handlers/auth-handlers.ts", () => mockHandlers);
mock.module("../../../src/errors/error-handler.ts", () => ({
	handleError: mockHandleError,
}));

import { createAuthCommand } from "../../../src/cli/commands/auth.ts";
import { addGlobalOptions } from "../../../src/cli/globals.ts";

afterAll(() => {
	mock.restore();
});

describe("createAuthCommand", () => {
	beforeEach(() => {
		for (const fn of Object.values(mockHandlers)) fn.mockClear();
		mockHandleError.mockClear();
	});

	test("returns a Command named 'auth'", () => {
		const cmd = createAuthCommand();
		expect(cmd.name()).toBe("auth");
	});

	test("registers 3 subcommands", () => {
		const cmd = createAuthCommand();
		expect(cmd.commands.length).toBe(3);
	});

	test("registers 'setup' subcommand", () => {
		const cmd = createAuthCommand();
		expect(cmd.commands.find((c) => c.name() === "setup")).toBeDefined();
	});

	test("registers 'status' subcommand", () => {
		const cmd = createAuthCommand();
		expect(cmd.commands.find((c) => c.name() === "status")).toBeDefined();
	});

	test("registers 'remove' subcommand", () => {
		const cmd = createAuthCommand();
		expect(cmd.commands.find((c) => c.name() === "remove")).toBeDefined();
	});

	test("status subcommand calls handleAuthStatus", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createAuthCommand());
		await program.parseAsync(["auth", "status", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleAuthStatus).toHaveBeenCalled();
	});

	test("setup subcommand calls handleAuthSetup", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createAuthCommand());
		await program.parseAsync(["auth", "setup", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleAuthSetup).toHaveBeenCalled();
	});

	test("remove subcommand calls handleAuthRemove", async () => {
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createAuthCommand());
		await program.parseAsync(["auth", "remove", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandlers.handleAuthRemove).toHaveBeenCalled();
	});

	test("action error is caught and passed to handleError", async () => {
		mockHandlers.handleAuthStatus.mockRejectedValueOnce(new Error("test error"));
		const program = new Command();
		addGlobalOptions(program);
		program.addCommand(createAuthCommand());
		await program.parseAsync(["auth", "status", "--api-key", "test"], {
			from: "user",
		});
		expect(mockHandleError).toHaveBeenCalled();
	});
});

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { API_KEY, isTestChannelAvailable, testClient, uniqueName } from "./helpers.ts";

describe.skipIf(!API_KEY)("Standup Integration", () => {
	const client = testClient();
	const cleanupIds: number[] = [];
	let channelAvailable = false;

	beforeAll(async () => {
		channelAvailable = await isTestChannelAvailable(client);
	});

	afterAll(async () => {
		for (const id of cleanupIds) {
			try {
				await client.delete(`/v1/standups/${id}`);
			} catch {
				// Best-effort cleanup
			}
		}
	});

	test("create -> get -> update -> delete lifecycle", async () => {
		if (!channelAvailable) {
			throw new Error("SKIP: #geekbot-skill-tests channel not found");
		}

		// Create
		const name = uniqueName("test-standup");
		const created = await client.post<{ id: number; name: string }>("/v1/standups", {
			name,
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
			questions: [{ question: "What did you work on?" }],
			sync_channel_members: true,
		});
		cleanupIds.push(created.id);
		expect(created.id).toBeGreaterThan(0);
		expect(created.name).toBe(name);

		// Get
		const fetched = await client.get<{ id: number; name: string }>(`/v1/standups/${created.id}`);
		expect(fetched.id).toBe(created.id);
		expect(fetched.name).toBe(created.name);

		// Update (PATCH)
		const updatedName = uniqueName("updated-standup");
		const updated = await client.patch<{ id: number; name: string }>(`/v1/standups/${created.id}`, {
			name: updatedName,
		});
		expect(updated.name).toBe(updatedName);

		// Delete
		await client.delete(`/v1/standups/${created.id}`);
		cleanupIds.pop(); // Already deleted
	}, 30000);

	test("list returns array containing created standup", async () => {
		if (!channelAvailable) {
			throw new Error("SKIP: #geekbot-skill-tests channel not found");
		}

		const name = uniqueName("test-list-standup");
		const created = await client.post<{ id: number; name: string }>("/v1/standups", {
			name,
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon"],
			questions: [{ question: "Test?" }],
			sync_channel_members: true,
		});
		cleanupIds.push(created.id);

		const standups = await client.get<Array<{ id: number; name: string }>>("/v1/standups");
		expect(Array.isArray(standups)).toBe(true);

		const found = standups.find((s) => s.id === created.id);
		expect(found).toBeDefined();
		expect(found!.name).toBe(name);
	}, 30000);

	test("replace (PUT) overwrites standup completely", async () => {
		if (!channelAvailable) {
			throw new Error("SKIP: #geekbot-skill-tests channel not found");
		}

		const created = await client.post<{ id: number; name: string }>("/v1/standups", {
			name: uniqueName("test-replace"),
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon", "Tue"],
			questions: [{ question: "Original question?" }],
			sync_channel_members: true,
		});
		cleanupIds.push(created.id);

		const replacedName = uniqueName("replaced-standup");
		const replaced = await client.put<{ id: number; name: string; days: string[] }>(
			`/v1/standups/${created.id}`,
			{
				name: replacedName,
				channel: "geekbot-skill-tests",
				time: "14:00:00",
				timezone: "UTC",
				days: ["Wed", "Fri"],
				questions: [{ question: "Replaced question?" }],
				sync_channel_members: true,
			},
		);
		expect(replaced.name).toBe(replacedName);
		expect(replaced.days).toEqual(["Wed", "Fri"]);
	}, 30000);

	test("duplicate creates copy with new name", async () => {
		if (!channelAvailable) {
			throw new Error("SKIP: #geekbot-skill-tests channel not found");
		}

		const original = await client.post<{ id: number; name: string }>("/v1/standups", {
			name: uniqueName("test-dup-original"),
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon"],
			questions: [{ question: "Dup test?" }],
			sync_channel_members: true,
		});
		cleanupIds.push(original.id);

		const dupName = uniqueName("test-dup-copy");
		const duplicated = await client.post<{ id: number; name: string }>(
			`/v1/standups/${original.id}/duplicate`,
			{ name: dupName },
		);
		cleanupIds.push(duplicated.id);

		expect(duplicated.id).not.toBe(original.id);
		expect(duplicated.name).toBe(dupName);
	}, 30000);

	test("start triggers standup (returns ok)", async () => {
		if (!channelAvailable) {
			throw new Error("SKIP: #geekbot-skill-tests channel not found");
		}

		const standup = await client.post<{ id: number }>("/v1/standups", {
			name: uniqueName("test-start"),
			channel: "geekbot-skill-tests",
			time: "10:00:00",
			timezone: "UTC",
			days: ["Mon"],
			questions: [{ question: "Start test?" }],
			sync_channel_members: true,
		});
		cleanupIds.push(standup.id);

		// POST /v1/standups/{id}/start returns "ok" string
		const result = await client.post<string>(`/v1/standups/${standup.id}/start`, {});
		expect(result).toBe("ok");
	}, 30000);
});

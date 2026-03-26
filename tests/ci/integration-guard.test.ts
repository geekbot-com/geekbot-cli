import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("CI workflow integration job", () => {
	const ciYml = readFileSync(join(import.meta.dir, "../../.github/workflows/ci.yml"), "utf-8");

	test("integration test step skips when API key is empty", () => {
		const lines = ciYml.split("\n");

		// Find the step that runs "bun test tests/integration/"
		const integrationRunIdx = lines.findIndex((l) =>
			l.match(/^\s+- run:.*bun test tests\/integration\//),
		);
		expect(integrationRunIdx).toBeGreaterThan(-1);

		// Collect all lines in this step (from - run: until the next step or end)
		const stepLines: string[] = [];
		for (let i = integrationRunIdx; i < lines.length; i++) {
			if (i > integrationRunIdx && lines[i].trimStart().startsWith("- ")) break;
			stepLines.push(lines[i]);
		}

		const stepBlock = stepLines.join("\n");

		// The step must have an `if:` that checks GEEKBOT_INTEGRATION_TEST_API_KEY is not empty
		expect(stepBlock).toMatch(/if:.*GEEKBOT_INTEGRATION_TEST_API_KEY/);
	});
});

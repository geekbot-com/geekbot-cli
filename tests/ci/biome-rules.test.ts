import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Biome lint rules", () => {
	test("does not disable any recommended rules when recommended=true", () => {
		const configPath = join(import.meta.dir, "../../biome.json");
		const config = JSON.parse(readFileSync(configPath, "utf-8"));

		// When recommended is enabled, explicitly disabling rules defeats the purpose
		const disabledRules: string[] = [];

		if (config.linter?.rules?.recommended) {
			const ruleGroups = config.linter.rules;
			for (const [group, rules] of Object.entries(ruleGroups)) {
				if (group === "recommended" || group === "all") continue;
				if (typeof rules !== "object" || rules === null) continue;
				for (const [rule, value] of Object.entries(rules as Record<string, unknown>)) {
					const level =
						typeof value === "string"
							? value
							: typeof value === "object" && value !== null && "level" in value
								? (value as { level: string }).level
								: null;
					if (level === "off") {
						disabledRules.push(`${group}/${rule}`);
					}
				}
			}
		}

		expect(disabledRules).toEqual([]);
	});
});

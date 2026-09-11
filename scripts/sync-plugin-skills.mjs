#!/usr/bin/env node
// Mirror ./skills into ./plugins/geekbot/skills.
//
// The Codex and Cursor plugin lives under plugins/geekbot/ and needs the
// skills inside its own directory. That used to be a symlink, but server-side
// marketplace importers that read the repo through the GitHub API (Cursor's
// Dashboard "Import from Repo") see a symlink as a 12-byte blob, not a
// directory, and import a plugin with no skills. A real copy works everywhere.
//
// Run after editing anything under skills/:  bun run sync:skills
// CI enforces the two trees are identical (tests/ci/plugin-skills-sync.test.ts).

import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "skills");
const target = join(root, "plugins", "geekbot", "skills");

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`synced ${source} -> ${target}`);

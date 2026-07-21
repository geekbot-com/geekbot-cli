# Releasing

This repo ships **two independent artifacts** with **separate version lines**. Know which one you're releasing.

| Artifact | What it is | Version file(s) | Released by |
|----------|-----------|-----------------|-------------|
| **npm CLI** (`geekbot-cli`) | the `geekbot` binary users install with `npm i -g` | `package.json` | GitHub Release → `.github/workflows/publish.yml` → `npm publish` |
| **Agent plugin** (`geekbot`) | the Claude Code / Codex plugin (slash commands + skills) | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `plugins/geekbot/.codex-plugin/plugin.json` | **merge to `main`** (no separate publish step) |

The two versions move at their own cadence — a CLI code change bumps the npm version; a skill/README change bumps the plugin version.

---

## Releasing the npm CLI

1. Bump `version` in `package.json` (semver: additive = MINOR, fix = PATCH, breaking = MAJOR).
2. Merge to `main`.
3. Cut a **GitHub Release** with a tag matching the version (`v1.2.0`), targeting the merge commit.
4. `publish.yml` fires on `release: published` → runs CI → `npm publish --provenance`.

> npm versions are immutable. The tag must point at a commit whose `package.json` carries a version npm hasn't seen, or the publish fails.

## Releasing the agent plugin

**There is no publish step and no tag to cut** — clients track this repo's default branch (`main`) and read the version straight from the manifests. Releasing is just merging:

1. Bump the version in **all three** manifests (keep them identical):
   - `.claude-plugin/plugin.json` → `version`
   - `.claude-plugin/marketplace.json` → `metadata.version`
   - `plugins/geekbot/.codex-plugin/plugin.json` → `version`
2. Open a PR, merge to `main`.

That's it. The next time a client refreshes its marketplace, it pulls `main` and sees the new version.

---

## How clients get an update

Updates are **pull-based** — nobody can push a plugin update to users. Both supported tools resolve the version the **same way**: they track a git **ref** (this repo's default branch, `main`) and read the plugin manifest from its HEAD. So a merge to `main` *is* the release for both.

| Tool | Tracks | Picks up a release when… | User refreshes with |
|------|--------|--------------------------|---------------------|
| **Claude Code** | the marketplace's default branch (`main`) | the change is **merged to `main`** | `/plugin marketplace update geekbot-cli` + `/reload-plugins` |
| **Codex** | the marketplace ref (default `main`) | the change is **merged to `main`** | `codex plugin marketplace upgrade geekbot-cli` + `codex plugin add geekbot@geekbot-cli` |

Auto-update is **off by default** for third-party marketplaces, so most users won't see a new version until they run the refresh command (or opt into auto-update). End-user refresh commands also live in the README's *Keeping Geekbot up to date* section.

> **Pin the marketplace to `main`, not a feature branch.** If a client added the marketplace with `--ref <branch>` (Codex) or an `extraKnownMarketplaces … "ref"` entry in `~/.claude/settings.json` (Claude Code), it will stay frozen on that branch and never see releases. Add it with **no ref** so it follows `main`.

### A note on `geekbot--v*` git tags

Claude Code only consults `{plugin}--v{version}` tags for **version-constrained / dependency installs** (a plugin pinned to a semver range, or pulled in as another plugin's dependency) — see the Claude Code plugin-dependencies docs. This repo doesn't distribute the plugin that way, so **no tag is required** for normal installs. If you ever adopt version-pinned distribution, cut the tag with `claude plugin tag --push` (it validates the manifests agree, then pushes `geekbot--v<version>` — a plain git tag in this repo; nothing goes to Anthropic).

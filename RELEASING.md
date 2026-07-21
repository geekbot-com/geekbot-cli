# Releasing

This repo ships **two independent artifacts** with **separate version lines**. Know which one you're releasing.

| Artifact | What it is | Version file | Git tag | Published by |
|----------|-----------|--------------|---------|--------------|
| **npm CLI** (`geekbot-cli`) | the `geekbot` binary users install with `npm i -g` | `package.json` | `v<x.y.z>` | `.github/workflows/publish.yml` |
| **Agent plugin** (`geekbot`) | the Claude Code / Codex plugin (slash commands + skills) | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `plugins/geekbot/.codex-plugin/plugin.json` | `geekbot--v<x.y.z>` | `.github/workflows/plugin-tag.yml` |

The two versions move at their own cadence — a CLI code change bumps the npm version; a skill/README change bumps the plugin version. When a single change touches both, one commit ends up carrying both a `v*` and a `geekbot--v*` tag. That's expected; the tag prefixes keep the two release lines unambiguous.

---

## Releasing the npm CLI

1. Bump `version` in `package.json` (semver: additive = MINOR, fix = PATCH, breaking = MAJOR).
2. Merge to `main`.
3. Cut a **GitHub Release** with a tag matching the version (`v1.2.0`), targeting the merge commit.
4. `publish.yml` fires on `release: published` → runs CI → `npm publish --provenance`.

> npm versions are immutable. The tag must point at a commit whose `package.json` carries a version npm hasn't seen, or the publish fails.

## Releasing the agent plugin

1. Bump the version in **all three** manifests (keep them identical):
   - `.claude-plugin/plugin.json` → `version`
   - `.claude-plugin/marketplace.json` → `metadata.version`
   - `plugins/geekbot/.codex-plugin/plugin.json` → `version`
2. Merge to `main`.
3. `plugin-tag.yml` detects the `.claude-plugin/plugin.json` change, verifies the manifests agree, and pushes a `geekbot--v<version>` tag automatically. **No local tagging.**

That's it — no separate publish step. Clients pull from the repo (see below).

> The workflow is idempotent: if `geekbot--v<version>` already exists it's a no-op, so re-merges or non-version edits to `plugin.json` do nothing.

### Cutting the tag manually (fallback)

If you ever need to tag by hand — e.g. the workflow is disabled — it's just a git tag. The `claude` CLI wraps it with manifest validation:

```shell
claude plugin tag --push          # creates + pushes geekbot--v<version> from the manifests
# equivalent to:
git tag -a geekbot--v0.2.0 -m "geekbot 0.2.0" && git push origin refs/tags/geekbot--v0.2.0
```

Nothing is sent to Anthropic — the tag lives in this GitHub repo; clients read it when they sync the marketplace.

---

## How clients get an update

Updates are **pull-based** — nobody can push a plugin update to users. How they resolve the new version differs by tool:

| Tool | Resolves version by | Picks up a release when… | User refreshes with |
|------|---------------------|--------------------------|---------------------|
| **Claude Code** | listing `geekbot--v*` **tags**, highest wins | the **tag** is pushed | `/plugin marketplace update geekbot-cli` + `/reload-plugins` |
| **Codex** | fetching the marketplace **ref** (default `main`) | the change is **merged to `main`** | `codex plugin marketplace upgrade geekbot-cli` + `codex plugin add geekbot@geekbot-cli` |

So Claude Code needs the tag; Codex only needs the merge. `plugin-tag.yml` covers the Claude Code side automatically, and merging to `main` covers Codex. End-user refresh commands also live in the README's *Keeping Geekbot up to date* section.

Auto-update is **off by default** for third-party marketplaces, so most users won't see a new version until they run the refresh command (or opt into auto-update).

---
"@mailshot/skills": minor
"@mailshot/mcp": minor
"create-mailshot": minor
"@mailshot/cdk": minor
"@mailshot/handlers": minor
"@mailshot/shared": minor
---

Publish Claude Code skills as a dedicated `@mailshot/skills` package. Scaffolded projects now refresh `.claude/skills/` automatically on `pnpm install` (postinstall hook), so framework upgrades keep skills in sync without manual steps. New `sync_skills` MCP tool exposes the same code path. The framework repo's root `.claude/skills/` is now a symlink to the canonical source so contributors can no longer drift from the user-facing copies.

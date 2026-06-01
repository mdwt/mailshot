# @mailshot/skills

## 1.9.0

### Minor Changes

- [#8](https://github.com/mdwt/mailshot/pull/8) Thanks [@mdwt](https://github.com/mdwt)! - Aligned to the v1.9.0 linked release (transactional sequence flag). No behavior change in this package.

## 1.8.0

### Minor Changes

- [`fd689ab`](https://github.com/mdwt/mailshot/commit/fd689ab6efff34fd9b5bea145d20a36c3f2e8a10) Thanks [@mdwt](https://github.com/mdwt)! - Publish Claude Code skills as a dedicated `@mailshot/skills` package. Scaffolded projects now refresh `.claude/skills/` automatically on `pnpm install` (postinstall hook), so framework upgrades keep skills in sync without manual steps. New `sync_skills` MCP tool exposes the same code path. The framework repo's root `.claude/skills/` is now a symlink to the canonical source so contributors can no longer drift from the user-facing copies.

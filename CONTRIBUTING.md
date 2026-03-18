# Contributing

Thanks for your interest in contributing to mailshot.

## Setup

```bash
git clone git@github.com:mdwt/mailshot.git
cd mailshot
pnpm install
pnpm -r build
```

Requires Node.js 22+ and pnpm.

## Development workflow

```bash
pnpm -r build          # Build all packages (shared must build first)
pnpm -r test           # Run tests (vitest)
pnpm -r typecheck      # Typecheck all packages
pnpm lint              # ESLint
pnpm format            # Prettier
```

To work on a single package:

```bash
pnpm --filter @mailshot/handlers test
pnpm --filter @mailshot/mcp build
```

## Making changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add tests if applicable
4. Run `pnpm -r build && pnpm -r test && pnpm lint` to verify
5. Add a [changeset](#changesets) if your change affects package behavior
6. Open a pull request against `main`

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). This is enforced by commitlint on the `commit-msg` hook.

```
feat: add rate limit headers to SES sender
fix: correct DynamoDB key format for events table
docs: update deployment guide
refactor: simplify template renderer caching
test: add bounce handler edge cases
chore: update dependencies
```

Lint-staged runs ESLint and Prettier automatically on pre-commit, so your code will be formatted before it's committed.

## Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for versioning. If your change affects package behavior (features, fixes, refactors), add a changeset:

Create a file in `.changeset/` with a descriptive kebab-case name:

```markdown
---
"@mailshot/handlers": minor
---

Add rate limit headers to SES sender responses
```

List every package you changed. Use `patch` for bug fixes, `minor` for new features, `major` for breaking changes. Skip changesets for docs-only or CI changes.

## Project structure

| Package                | What it is                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| `packages/shared`      | Types and constants — must build first, everything depends on it |
| `packages/handlers`    | Lambda functions and shared lib modules                          |
| `packages/cdk`         | AWS CDK infrastructure                                           |
| `packages/mcp`         | MCP server for Claude Code integration                           |
| `packages/create`      | `npx create-mailshot` CLI scaffolder                             |
| `examples/hello-world` | Example sequence and templates                                   |

## Reporting issues

Open an issue on [GitHub](https://github.com/mdwt/mailshot/issues). Include steps to reproduce, expected vs actual behavior, and your Node/pnpm versions.

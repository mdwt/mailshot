# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm -r build              # Build all packages (shared must build first)
pnpm -r test               # Run all tests (vitest)
pnpm -r typecheck           # Typecheck all packages (includes test files)
pnpm lint                  # ESLint all packages (flat config from root)
pnpm lint:fix              # ESLint with auto-fix
pnpm format                # Prettier format all files
pnpm format:check          # Prettier check (CI)

# Versioning
pnpm changeset             # Create a new changeset (interactive)
pnpm version-packages      # Apply changesets → bump versions + update CHANGELOGs
pnpm release               # Version + build + publish to npm

# Single package
pnpm --filter @step-func-emailer/handlers build
pnpm --filter @step-func-emailer/handlers test
cd packages/cdk && AWS_PROFILE=<profile> npx cdk synth    # Synthesize CloudFormation
cd packages/cdk && AWS_PROFILE=<profile> npx cdk deploy --require-approval never  # Deploy to AWS

# Templates
pnpm --filter @step-func-emailer/templates dev     # React Email dev server on :3001
pnpm --filter @step-func-emailer/templates render  # Render .tsx → .html in build/<sequenceId>/templates/
```

## Architecture

Serverless email sequencing framework on AWS. Product-agnostic: the framework defines contracts for event ingestion, subscriber management, template rendering, and sequence execution. Users provide their own sequences (Step Functions state machines), templates (React Email → HTML), and events.

### Monorepo packages (pnpm workspaces)

- **`shared`** — Types and constants consumed by handlers and CDK. Must build first. Exports key helpers like `subscriberPK()`, `executionSK()`, `sentSK()` for DynamoDB key construction.
- **`handlers`** — Five Lambda functions + shared lib modules. All handlers read config from SSM Parameter Store at runtime (cached 5min via `lib/ssm-config.ts`).
- **`cdk`** — AWS CDK infrastructure. Config is loaded from a root `.env` file (see `.env.example`). All environment variables are stored as SSM parameters (not Lambda env vars directly). Entry point: `bin/app.ts`.
- **`mcp`** — MCP server (`@step-func-emailer/mcp`) for interacting with the email system from Claude Code. Provides tools for subscriber management, engagement analytics, template preview, and system health. Spawned over stdio, uses local AWS credentials. Setup: `claude mcp add step-func-emailer -e AWS_PROFILE=<profile> -- npx @step-func-emailer/mcp` (reads config from `.env`).
- **`create`** — `create-step-func-emailer` CLI that scaffolds new user projects. Run with `npx create-step-func-emailer my-project`. Template files are embedded in the package.

### Data flow

1. App backend publishes events to EventBridge custom bus
2. EventBridge rules route to either Step Functions (sequences) or SendEmailFn directly (fire-and-forget)
3. Step Functions state machines call SendEmailFn for register/send/complete actions
4. SendEmailFn: reads subscriber from DynamoDB → pre-send checks → fetches template from S3 → renders with LiquidJS → sends via SES → writes send log
5. SES bounce/complaint notifications → SNS → BounceHandlerFn → suppresses subscriber, stops executions
6. SES engagement events (delivery, open, click, bounce, complaint) → SNS → EngagementHandlerFn → writes to EmailEvents table
7. Unsubscribe link → UnsubscribeFn (Lambda Function URL, no auth) → marks unsubscribed, stops executions

### DynamoDB tables

**Main table** (single-table design): All items keyed by `PK = SUB#<email>`. Sort keys: `PROFILE`, `EXEC#<sequenceId>`, `SENT#<timestamp>`, `SUPPRESSION`. No GSIs. Subscriber attributes (platform, country, gateway, etc.) are stored as **top-level columns** on the PROFILE item — not nested under an `attributes` map. System columns (`PK`, `SK`, `email`, `firstName`, `unsubscribed`, `suppressed`, `createdAt`, `updatedAt`) are fixed; everything else is a dynamic attribute. Use `extractAttributes(profile)` from `dynamo-client.ts` to separate custom attributes from system columns.

**Events table** (engagement tracking): `PK = SUB#<email>`, `SK = EVT#<timestamp>#<eventType>`. GSI `TemplateIndex` on `templateKey` + `SK` for cross-subscriber template queries. TTL-enabled (365 days).

### CDK constructs (in `lib/constructs/`)

- **storage** — DynamoDB main table + events table + S3 template bucket + BucketDeployment
- **ssm-params** — Writes all config as SSM parameters under configurable prefix
- **lambdas** — Five NodejsFunction Lambdas with esbuild bundling (AWS SDK externalized)
- **ses-config** — SES configuration set + SNS topics for bounce/complaint and engagement events
- **state-machines** — Step Functions definitions (auto-discovered from sequences)
- **event-bus** — Custom EventBridge bus + routing rules

### Handler lib modules

- **ssm-config** — Resolves all config from SSM with caching
- **dynamo-client** — All DynamoDB operations (profile CRUD, execution tracking, send log, suppression). Exports `extractAttributes(profile)` to separate custom attributes from system columns
- **template-renderer** — S3 fetch + LiquidJS render with 10min cache
- **ses-sender** — SES v2 SendEmail with List-Unsubscribe headers. `templateKey` and `sequenceId` are sent as custom headers (`X-Template-Key`, `X-Sequence-Id`) for engagement tracking, and as SES EmailTags (with `/` replaced by `--` in tag values since SES doesn't allow `/` in tags)
- **unsubscribe-token** — HMAC-SHA256 token generation/validation (90-day expiry)
- **display-names** — Optional value→display name mappings loaded from S3
- **execution-stopper** — Stops all Step Functions executions for a subscriber

## Key Conventions

- All packages use CommonJS (`"type": "commonjs"`) with `Node16` module resolution
- TypeScript strict mode, target ES2022, Node 22 runtime
- Imports between workspace packages use `@step-func-emailer/<pkg>` with `.js` extensions
- CDK uses `NodejsFunction` — handlers are bundled with esbuild at deploy time, AWS SDK is externalized
- Pre-send check failures (unsubscribed, suppressed, rate-limited) return `{ sent: false }` — they don't throw. Sequences continue, emails are skipped.
- The `unsubscribed` and `suppressed` flags on subscriber profiles are never overwritten by upsert — only their respective handlers can set them to `true`
- Subscriber attributes are top-level DynamoDB columns, not nested under an `attributes` map. The `Subscriber` type (event input) still has `attributes?: Record<string, unknown>` — these are flattened to top-level columns on write, with system keys filtered out
- `AWS_PROFILE` is set in `.env` and must be passed to CDK commands and the MCP server. The MCP server reads `.env` automatically for table/bucket names
- SES EmailTags don't allow `/` in values — `templateKey` is stored with `/` replaced by `--` in tags only. Headers and DynamoDB use the original key with `/`
- Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) format (enforced by commitlint). Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

## Versioning & Change Management

This project uses [Changesets](https://github.com/changesets/changesets) for version management and automated changelog generation. Core packages (shared, handlers, cdk, mcp, create-step-func-emailer) are **linked** — they always version together. All packages are published to npm as public packages.

### When to create a changeset

Create a changeset for any code change that affects package behavior — features, fixes, refactors, breaking changes. Skip changesets for docs-only, CI, or tooling changes that don't affect package code.

### How to create a changeset (non-interactive, for AI use)

The `pnpm changeset` command is interactive and cannot be used by AI. Instead, write a changeset file directly to `.changeset/`:

```bash
# File: .changeset/<descriptive-kebab-name>.md
# Example: .changeset/add-rate-limit-headers.md
```

**File format:**

```markdown
---
"@step-func-emailer/handlers": minor
"@step-func-emailer/shared": minor
---

Add rate limit headers to SES sender responses
```

**Rules for the YAML frontmatter:**

- List every package that was changed (by its `name` from `package.json`)
- Bump type per package: `patch` (bug fixes), `minor` (new features, non-breaking), `major` (breaking changes)
- Linked packages (shared, handlers, cdk, mcp, create-step-func-emailer) will all get the highest bump among them
- Example packages (`@step-func-emailer/hello-world`) are versioned independently
- The `@step-func-emailer/tools` package is ignored by changesets

**Rules for the summary (below the `---`):**

- One concise line describing the change from a user/consumer perspective
- Use imperative mood ("Add...", "Fix...", "Remove...")
- This text appears verbatim in the CHANGELOG.md

### Bump type guide

| Change type                                                 | Bump    | Examples                                             |
| ----------------------------------------------------------- | ------- | ---------------------------------------------------- |
| Bug fix, typo, minor correction                             | `patch` | Fix SES tag encoding, fix DynamoDB key format        |
| New feature, new handler, new config option                 | `minor` | Add engagement tracking, add display name mappings   |
| Breaking API/type change, removed feature, schema migration | `major` | Change Subscriber type shape, rename SSM param paths |

### Applying changesets (releasing)

```bash
pnpm version-packages    # Consumes all .changeset/*.md files, bumps versions in package.json, updates CHANGELOG.md
pnpm release             # version-packages + build + publish to npm
```

After `version-packages` runs, the `.changeset/*.md` files are deleted and the version bumps + changelog entries are staged. Commit this as a release commit (e.g., `chore: release v0.2.0`).

### Example workflow

1. Make code changes
2. Write `.changeset/my-change.md` with affected packages and bump types
3. Commit everything together: `feat: add rate limit headers`
4. When ready to release: `pnpm version-packages` → commit → deploy

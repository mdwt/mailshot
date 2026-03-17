# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm -r build              # Build all packages (shared must build first)
pnpm -r test               # Run all tests (vitest)
pnpm -r typecheck           # Typecheck all packages
pnpm -r lint               # Lint all packages

# Single package
pnpm --filter @step-func-emailer/handlers build
pnpm --filter @step-func-emailer/handlers test
pnpm --filter @step-func-emailer/cdk synth    # Synthesize CloudFormation
pnpm --filter @step-func-emailer/cdk deploy   # Deploy to AWS

# Templates
pnpm --filter @step-func-emailer/templates dev     # React Email dev server on :3001
pnpm --filter @step-func-emailer/templates render  # Render .tsx → .html in templates/
```

## Architecture

Serverless email sequencing framework on AWS. Product-agnostic: the framework defines contracts for event ingestion, subscriber management, template rendering, and sequence execution. Users provide their own sequences (Step Functions state machines), templates (React Email → HTML), and events.

### Monorepo packages (pnpm workspaces)

- **`shared`** — Types and constants consumed by handlers and CDK. Must build first. Exports key helpers like `subscriberPK()`, `executionSK()`, `sentSK()` for DynamoDB key construction.
- **`handlers`** — Five Lambda functions + shared lib modules. All handlers read config from SSM Parameter Store at runtime (cached 5min via `lib/ssm-config.ts`).
- **`cdk`** — AWS CDK infrastructure. Config is loaded from a root `.env` file (see `.env.example`). All environment variables are stored as SSM parameters (not Lambda env vars directly). Entry point: `bin/app.ts`.
- **`mcp`** — MCP server (`@step-func-emailer/mcp`) for interacting with the email system from Claude Code. Provides tools for subscriber management, engagement analytics, template preview, and system health. Spawned over stdio, uses local AWS credentials.
- **`templates`** — React Email components in `src/emails/`. Build step renders them to static HTML with Liquid placeholders (`{{ firstName }}`, `{{ unsubscribeUrl }}`), output to `templates/`, deployed to S3 via CDK BucketDeployment.

### Data flow

1. App backend publishes events to EventBridge custom bus
2. EventBridge rules route to either Step Functions (sequences) or SendEmailFn directly (fire-and-forget)
3. Step Functions state machines call SendEmailFn for register/send/complete actions
4. SendEmailFn: reads subscriber from DynamoDB → pre-send checks → fetches template from S3 → renders with LiquidJS → sends via SES → writes send log
5. SES bounce/complaint notifications → SNS → BounceHandlerFn → suppresses subscriber, stops executions
6. SES engagement events (delivery, open, click, bounce, complaint) → SNS → EngagementHandlerFn → writes to EmailEvents table
7. Unsubscribe link → UnsubscribeFn (Lambda Function URL, no auth) → marks unsubscribed, stops executions

### DynamoDB tables

**Main table** (single-table design): All items keyed by `PK = SUB#<email>`. Sort keys: `PROFILE`, `EXEC#<sequenceId>`, `SENT#<timestamp>`, `SUPPRESSION`. No GSIs.

**Events table** (engagement tracking): `PK = SUB#<email>`, `SK = EVT#<timestamp>#<eventType>`. GSI `TemplateIndex` on `templateKey` + `SK` for cross-subscriber template queries. TTL-enabled (365 days).

### CDK constructs (in `lib/constructs/`)

- **storage** — DynamoDB main table + events table + S3 template bucket + BucketDeployment
- **ssm-params** — Writes all config as SSM parameters under configurable prefix
- **lambdas** — Five NodejsFunction Lambdas with esbuild bundling (AWS SDK externalized)
- **ses-config** — SES configuration set + SNS topics for bounce/complaint and engagement events
- **state-machines** — Step Functions definitions (onboarding sequence as starter)
- **event-bus** — Custom EventBridge bus + routing rules

### Handler lib modules

- **ssm-config** — Resolves all config from SSM with caching
- **dynamo-client** — All DynamoDB operations (profile CRUD, execution tracking, send log, suppression)
- **template-renderer** — S3 fetch + LiquidJS render with 10min cache
- **ses-sender** — SES v2 SendEmail with List-Unsubscribe headers
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

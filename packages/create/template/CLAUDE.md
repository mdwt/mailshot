# {{PROJECT_NAME}}

A [mailshot](https://github.com/mdwt/mailshot) project - serverless email sequences on AWS, managed through Claude Code.

## Framework documentation

For questions about how mailshot works (sequences, templates, deployment, DynamoDB schema, engagement tracking, A/B testing, etc.), **fetch the documentation from the website** instead of reading framework source code in `node_modules`:

- **Full docs**: https://mailshot.dev/docs (human-readable, covers all topics)
- **LLM-optimized index**: https://mailshot.dev/llms.txt (concise reference with links to each page)

Use WebFetch on `https://mailshot.dev/llms.txt` to get an overview, then fetch specific doc pages as needed. This is faster and more reliable than digging through `@mailshot/*` package source.

## Workflow

This project is managed through Claude Code skills. When the user asks to deploy, create sequences, validate, etc., always use the corresponding skill - never run raw commands like `pnpm deploy` or `npx cdk deploy` directly.

- `/setup-env` - configure AWS credentials and `.env` file
- `/create-sequence` - scaffold a new email sequence from a description
- `/validate-sequence` - check sequence configs, templates, types, and CDK synth
- `/deploy` - full deployment workflow (validate → build → confirm → deploy to AWS)
- `/inspect-sequence` - read-only inspection of a deployed sequence (active subscribers, recent engagement, recent failures). Use when the user asks "who is in X?", "what's running?", or "how is X doing?"
- `/send-broadcast` - send a one-off broadcast email to filtered subscribers
- `/import-sequence` - reconstruct a deployed sequence from AWS into local code

Skills are shipped via the `@mailshot/skills` package and refresh automatically on `pnpm install` (postinstall hook). To bump them manually after upgrading the framework, run `pnpm sync-skills`.

### Build commands (used internally by skills)

```bash
pnpm build                    # Build all sequences (compiles TS + renders templates to build/)
pnpm typecheck                # Typecheck all packages
pnpm synth                    # Synthesize CloudFormation (loads .env automatically)
pnpm run cdk:deploy           # CDK deploy to AWS (loads .env automatically)
```

Single sequence:

```bash
pnpm --filter <sequenceId> build      # Build one sequence
pnpm --filter <sequenceId> dev        # React Email dev server (if using React Email)
pnpm --filter <sequenceId> typecheck  # Typecheck one sequence
```

## Project structure

- `sequences/` - email sequences, each in its own directory with `sequence.config.ts`
- `bin/app.ts` - CDK entry point, loads `.env` and auto-discovers sequences
- `.env` - AWS configuration (account, region, SES, resource names). Run `/setup-env` to generate
- `build/` - generated artifacts (template HTML, CDK output). Gitignored
- `tsconfig.base.json` - shared TypeScript config, extended by each sequence

## How sequences work

Each sequence is a directory under `sequences/<sequenceId>/` containing:

- `sequence.config.ts` - typed definition (sender identity, trigger event, steps, delays, branches)
- `src/emails/*.tsx` (or any HTML source) - email templates
- `src/render.ts` - renders templates to `build/<sequenceId>/templates/*.html`
- `package.json` - declares the sequence as a workspace package

CDK auto-discovers all sequences from `sequences/*/sequence.config.ts`. No manual registration needed.

## Templates

mailshot sends HTML files with [LiquidJS](https://liquidjs.com/) variables rendered at send time. How you produce the HTML is up to you - React Email, MJML, hand-written HTML, whatever. The render script just needs to output `.html` files to `build/<sequenceId>/templates/`.

Available Liquid variables in every template:

- `{{ firstName }}` - subscriber's first name
- `{{ unsubscribeUrl }}` - one-click unsubscribe link (HMAC-signed, 90-day expiry)
- Any custom attributes passed via the triggering event's `subscriberMapping.attributes`

## Sequence config types

Each sequence defines its own **sender identity** via the `sender` field: `fromEmail`, `fromName`, `replyToEmail` (optional), `captureReplies` (optional, creates SES receipt rule for inbound reply capture), `forwardRepliesTo` (optional, forwards captured replies to this inbox), `listUnsubscribe` (optional, default `true` — set `false` to omit List-Unsubscribe headers for cold outreach). There are no project-level sender defaults — every sequence must define its own.

Steps: `send`, `wait`, `choice` (branch on event data), `condition` (branch on DynamoDB lookup). Send steps support `variants` for A/B testing — provide an array of `{ templateKey, subject }` instead of a single templateKey/subject. Variant assignment is deterministic per subscriber per sequence.

Events: fire-and-forget emails triggered by EventBridge events during a running sequence

See `@mailshot/shared` for the full `SequenceDefinition` type.

## Renaming a sequence

The sequence `id` in `sequence.config.ts` is the single source of truth. The render script and templateKeys derive from it automatically (via the `id` variable). The folder name is independent - it's just where you keep your code.

To rename a sequence (e.g., if the ID conflicts with an existing AWS resource):

1. **Update `sequence.config.ts`**: change the `id` variable to the new name
2. **Update `package.json`**: change `name` to `<newId>`
3. **Optionally rename the directory** to match (not required, but keeps things tidy)
4. **Clean and rebuild**: `rm -rf build/<oldId> && pnpm build`
5. **Verify**: `pnpm synth`

Do NOT rename individual template `.tsx` files - only the sequence ID changes.

## Key conventions

- All packages use CommonJS with Node16 module resolution
- TypeScript strict mode, target ES2022, Node 22 runtime
- Sequence packages use `<sequenceId>` as the package name (no namespace) and `workspace:*` for shared deps
- The CDK stack reads all config from `.env` - no hardcoded values in `bin/app.ts`
- `pnpm synth` and `pnpm run cdk:deploy` load `.env` automatically via `dotenv-cli` - never run `npx cdk` directly
- IMPORTANT: `pnpm deploy` is a built-in pnpm command (not a script) and will fail. Use `pnpm run cdk:deploy` for raw CDK deploy, or better yet, use the `/deploy` skill which validates, builds, and confirms first
- When the user says "deploy", always use the `/deploy` skill - never run `pnpm deploy` or `pnpm run cdk:deploy` directly

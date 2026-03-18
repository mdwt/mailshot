# Email Sequences Project

Built with [mailshot](https://github.com/mdwt/mailshot).

## Commands

- `pnpm build` — build all sequences
- `pnpm deploy` — deploy to AWS
- `/create-sequence` — create a new email sequence
- `/setup-env` — configure AWS environment
- `/deploy` — build and deploy

## Structure

- `sequences/` — email sequences (auto-discovered by CDK)
- `bin/app.ts` — CDK entry point
- `.env` — AWS configuration

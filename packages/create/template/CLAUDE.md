# Email Sequences Project

Built with [step-func-emailer](https://github.com/mdwt/step-func-emailer).

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

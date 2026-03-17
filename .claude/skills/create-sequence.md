# Create Sequence

Create a complete email sequence from a natural language description — generates a sequence config, React Email templates, and render script. No framework code changes needed.

## Usage

```
/create-sequence <description of your email sequence>
```

Example: `/create-sequence A trial expiring sequence triggered by trial.expiring — send a "trial ending soon" email immediately, then a "last chance" email after 2 days, then a "trial expired" email after 3 more days`

## Instructions

You are generating all the code needed to deploy a new email sequence. Follow this workflow exactly.

### Step 1: Parse the input

Extract from the user's description:
- **sequenceId** — unique kebab-case ID (e.g., `trial-expiring`, `onboarding`)
- **triggerEvent** — EventBridge detail-type (e.g., `trial.expiring`, `customer.created`)
- **subscriberMapping** — how to extract subscriber fields from the event (defaults to `$.detail.email`, `$.detail.firstName`, `$.detail` for attributes)
- **emails** — ordered list, each with:
  - `templateName` — kebab-case slug (e.g., `trial-ending-soon`)
  - `subject` — email subject line
  - `previewText` — preview/preheader text
  - `body` — paragraphs and content for the email body
  - `delayBefore` — delay before this email (`0` for immediate, or e.g. `2 days`, `1 week`)
- **conditions** (optional) — any branching logic (e.g., "only send if subscriber hasn't received X")

If any of these are missing or ambiguous, ask the user to clarify before generating code. Present your parsed interpretation to the user and confirm before proceeding.

### Step 2: Create the sequence folder

Create `sequences/<sequenceId>/` with:

**`package.json`:**
```json
{
  "name": "@step-func-emailer/<sequenceId>",
  "version": "0.0.0",
  "private": true,
  "type": "commonjs",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc && pnpm render",
    "render": "tsx src/render.ts",
    "typecheck": "tsc --noEmit",
    "dev": "email dev --dir src/emails --port 3002",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@react-email/components": "^1.0.9",
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "@react-email/render": "^2.0.4",
    "@step-func-emailer/shared": "workspace:*",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "react-email": "^5.2.9",
    "tsx": "^4.21.0"
  }
}
```

**`tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

### Step 3: Create `sequence.config.ts`

```typescript
import type { SequenceDefinition } from "@step-func-emailer/shared";

export default {
  id: "<sequenceId>",
  trigger: {
    detailType: "<triggerEvent>",
    subscriberMapping: {
      email: "$.detail.email",
      firstName: "$.detail.firstName",
      attributes: "$.detail",
    },
  },
  timeoutDays: 30,
  steps: [
    { type: "send", templateKey: "<sequenceId>/<templateName>", subject: "<subject>" },
    { type: "wait", days: 2 },
    // ... more steps
  ],
} satisfies SequenceDefinition;
```

For fire-and-forget (single email, no Step Function):
```typescript
export default {
  id: "<sequenceId>",
  trigger: {
    detailType: "<triggerEvent>",
    subscriberMapping: {
      email: "$.detail.email",
      firstName: "$.detail.firstName",
      attributes: "$.detail",
    },
  },
  fireAndForget: {
    templateKey: "<sequenceId>/<templateName>",
    subject: "<subject>",
  },
} satisfies SequenceDefinition;
```

Available step types:
- `{ type: "send", templateKey: "...", subject: "..." }` — send an email
- `{ type: "wait", days?: N, hours?: N, minutes?: N }` — wait before continuing
- `{ type: "condition", check: "has_been_sent"|"subscriber_field_exists"|"subscriber_field_equals", templateKey?: "...", field?: "...", value?: "...", then: [...steps], else?: [...steps] }` — conditional branching

### Step 4: Generate React Email templates

For each email, create a file at `sequences/<sequenceId>/src/emails/<templateName>.tsx`.

Follow the pattern from existing templates in `sequences/onboarding/src/emails/`:
- Import from `@react-email/components`
- Use Liquid placeholders: `firstName` and `unsubscribeUrl` as props with defaults
- Include `<Preview>` with preheader text
- Include unsubscribe link in footer

### Step 5: Create render script

Create `sequences/<sequenceId>/src/render.ts` — copy from `sequences/onboarding/src/render.ts` and update the `OUT_DIR` to use the new sequence ID:

```typescript
const OUT_DIR = path.join(__dirname, "../../../templates/<sequenceId>");
```

### Step 6: Install and verify

```bash
pnpm install
pnpm --filter @step-func-emailer/<sequenceId> build
pnpm --filter @step-func-emailer/cdk typecheck
pnpm --filter @step-func-emailer/cdk synth
```

All commands must succeed before the skill is complete.

### What you do NOT need to edit

- `packages/cdk/lib/constructs/state-machines.ts` — auto-discovers sequences
- `packages/cdk/lib/constructs/event-bus.ts` — auto-discovers sequences
- `packages/cdk/lib/step-func-emailer-stack.ts` — auto-discovers sequences
- `packages/cdk/bin/app.ts` — auto-discovers sequences

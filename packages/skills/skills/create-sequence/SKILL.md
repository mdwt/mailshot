---
description: Create a new email sequence with templates and config. Use when the user wants to create, add, build, or set up a new email sequence, drip campaign, onboarding flow, A/B test, or any series of automated emails. Trigger phrases: "create a sequence", "add a sequence", "new sequence", "build an email flow", "set up emails", "I want to create a sequence", "make a drip campaign", "A/B test", "split test", "test variants".
---

# Create Sequence

Create a complete email sequence from a natural language description - generates a sequence config, React Email templates, and render script. Zero framework code changes needed. The CDK auto-discovers sequences from `sequences/*/sequence.config.ts`.

## Usage

```
/create-sequence <description of your email sequence>
```

Example: `/create-sequence A trial expiring sequence triggered by trial.expiring - send a "trial ending soon" email immediately, then a "last chance" email after 2 days, then a "trial expired" email after 3 more days`

## Instructions

You are generating all the code needed to deploy a new email sequence. Follow this workflow exactly.

### Step 1: Parse the input

Extract from the user's description:

- **sequenceId** - unique kebab-case ID (e.g., `trial-expiring`, `onboarding`)
- **triggerEvent** - EventBridge detail-type (e.g., `trial.expiring`, `customer.created`)
- **subscriberMapping** - how to extract subscriber fields from the event (defaults to `$.detail.email`, `$.detail.firstName`, `$.detail` for attributes)
- **timeoutMinutes** - how long the Step Function execution can run before timing out
- **emails** - ordered list, each with:
  - `templateName` - kebab-case slug (e.g., `trial-ending-soon`)
  - `subject` - email subject line
  - `previewText` - preview/preheader text
  - `body` - paragraphs and content for the email body
  - `delayBefore` - delay before this email (`0` for immediate, or e.g. `2 days`, `1 week`)
- **variants** (optional) - A/B testing. If the user mentions "A/B test", "split test", "variants", "test different subjects/content", extract:
  - Which emails have variants (some or all)
  - How many variants per email (typically 2, but can be more)
  - What differs between variants (subject, body content, or both)
  - Variant naming convention: use `-a`, `-b`, `-c` suffixes on templateKey (e.g., `welcome-a`, `welcome-b`)
- **branching** (optional) - any choice/condition logic (e.g., "different welcome email per platform", "skip if already sent")
- **events** (optional) - one-off fire-and-forget emails triggered by events during the sequence (e.g., "send congrats on first sale")
- **sender** - the sending configuration for this sequence:
  - `fromEmail` - the email address to send from (must be verified in SES)
  - `fromName` - the display name shown in the "From" field
  - `replyToEmail` (optional) - the Reply-To address. Can be a normal email or an SES-managed inbox
  - `captureReplies` (optional) - set to `true` if `replyToEmail` is an SES-managed inbox where inbound replies should be captured via SES receipt rules → SNS → Lambda (e.g., for cold outreach). Leave unset for normal email reply-to addresses
  - `forwardRepliesTo` (optional) - when set alongside `captureReplies`, forwards captured replies to this email address so the user can read and respond to them
  - `listUnsubscribe` (optional, default: `true`) - set to `false` to omit `List-Unsubscribe` and `List-Unsubscribe-Post` headers. Use for cold outreach where these headers signal bulk mail to Gmail

Ask the user what type of sequence this is (e.g., transactional, marketing, cold outreach). If cold outreach or the user wants a managed inbox for reply tracking, set `captureReplies: true` and confirm the SES inbound email address. For cold outreach, also set `listUnsubscribe: false` to avoid bulk mail filtering.

If any of these are missing or ambiguous, ask the user to clarify before generating code. Present your parsed interpretation to the user and confirm before proceeding.

### Step 2: Create the sequence folder

Create `sequences/<sequenceId>/` with the following files. Pay attention to exact file paths.

**`sequences/<sequenceId>/package.json`:**

```json
{
  "name": "<sequenceId>",
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
    "@mailshot/shared": "^1.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "react-email": "^5.2.9",
    "tsx": "^4.21.0"
  }
}
```

**`sequences/<sequenceId>/tsconfig.json`:**

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

**CRITICAL:** This file MUST be at `sequences/<sequenceId>/sequence.config.ts` - NOT inside `src/`. CDK auto-discovers sequences by looking for `sequences/*/sequence.config.ts` at the sequence root. If it's inside `src/`, CDK won't find it and no state machine will be created.

The config must satisfy the `SequenceDefinition` type from `@mailshot/shared`. Here is the full shape:

```typescript
import type { SequenceDefinition } from "@mailshot/shared";

const id = "<sequenceId>";

export default {
  id,
  sender: {
    fromEmail: "<fromEmail>",
    fromName: "<fromName>",
    replyToEmail: "<replyToEmail>", // optional
    // captureReplies: true,              // optional, for SES managed inbox
    // forwardRepliesTo: "team@example.com", // optional, forward replies to inbox
    // listUnsubscribe: false,               // optional, omit List-Unsubscribe headers
  },
  trigger: {
    detailType: "<triggerEvent>",
    subscriberMapping: {
      email: "$.detail.email",
      firstName: "$.detail.firstName",
      attributes: "$.detail",
    },
  },
  timeoutMinutes: 43200,
  steps: [
    // Standard send step:
    // { type: "send", templateKey: `${id}/<templateName>`, subject: "..." },
    //
    // A/B variant send step:
    // {
    //   type: "send",
    //   variants: [
    //     { templateKey: `${id}/<templateName>-a`, subject: "Subject A" },
    //     { templateKey: `${id}/<templateName>-b`, subject: "Subject B" },
    //   ],
    // },
  ],
  // Optional: fire-and-forget emails triggered by events during the sequence
  events: [
    {
      detailType: "customer.first_sale",
      templateKey: `${id}/first-sale`,
      subject: "Congrats!",
    },
  ],
} satisfies SequenceDefinition;
```

#### Step types

**Send** - sends an email via the SendEmailFn Lambda:

```typescript
{ type: "send", templateKey: `${id}/<templateName>`, subject: "..." }
```

**Send with A/B variants** - provide an array of variants instead of a single templateKey/subject. Variant assignment is deterministic per subscriber per sequence (same subscriber always gets the same variant across all steps):

```typescript
{
  type: "send",
  variants: [
    { templateKey: `${id}/<templateName>-a`, subject: "Subject A" },
    { templateKey: `${id}/<templateName>-b`, subject: "Subject B" },
  ],
}
```

**Wait** - pauses the Step Function execution:

```typescript
{ type: "wait", days: 2 }
{ type: "wait", hours: 12 }
{ type: "wait", minutes: 30 }
```

**Choice** - native Step Functions branching on a field in the execution input. No Lambda invocation - evaluated directly in the state machine. Use this for branching on subscriber attributes passed in via the event:

```typescript
{
  type: "choice",
  field: "$.subscriber.attributes.plan",
  branches: [
    { value: "pro", steps: [{ type: "send", templateKey: "...", subject: "..." }] },
    { value: "free", steps: [{ type: "send", templateKey: "...", subject: "..." }] },
  ],
  default: [{ type: "send", templateKey: "...", subject: "..." }],
}
```

Choices can be nested (e.g., branch on platform, then on country within each platform). All branches converge automatically - steps after a choice run for all branches.

**Condition** - Lambda-based check that queries DynamoDB. Use this only when the data isn't in the execution input (e.g., checking send history or subscriber profile fields that changed after the sequence started):

```typescript
{
  type: "condition",
  check: "has_been_sent",
  templateKey: `${id}/<templateName>`,
  then: [],  // skip
  else: [{ type: "send", templateKey: "...", subject: "..." }],
}
```

Available checks:

- `has_been_sent` - requires `templateKey`. True if the subscriber has already been sent this template.
- `subscriber_field_exists` - requires `field`. True if the field exists on the subscriber's DynamoDB profile attributes.
- `subscriber_field_equals` - requires `field` and `value`. True if the profile attribute matches the value.

**When to use `choice` vs `condition`:** Use `choice` for branching on data that's available in the execution input (subscriber attributes from the triggering event). Use `condition` only when you need to query DynamoDB at runtime (send history, profile changes after sequence start).

### Step 4: Generate React Email templates

For each email, create a file at `sequences/<sequenceId>/src/emails/<templateName>.tsx`.

**For A/B variant emails:** Create a separate template file for each variant. For example, if a send step has variants `welcome-a` and `welcome-b`, create:

- `sequences/<sequenceId>/src/emails/welcome-a.tsx`
- `sequences/<sequenceId>/src/emails/welcome-b.tsx`

Each variant template is a standalone file with its own subject, heading, body content, etc. Make the differences between variants meaningful and testable (e.g., different headline copy, different CTA text, different tone).

If using React Email:

- Import from `@react-email/components`
- Use Liquid placeholders: `firstName` and `unsubscribeUrl` as props with defaults
- Include `<Preview>` with preheader text
- Include unsubscribe link in footer

### Step 5: Create render script

Create `sequences/<sequenceId>/src/render.ts`. The `OUT_DIR` MUST be derived from the sequence config's `id` field - never hardcode the sequence ID in the path. Use `__dirname` to resolve relative to the file, not `process.cwd()`:

```typescript
import config from "../sequence.config.js";

const OUT_DIR = path.join(__dirname, `../../../build/${config.id}/templates`);
```

This ensures renaming a sequence only requires changing the `id` in `sequence.config.ts` - the render script picks it up automatically.

### Step 6: Install and verify

```bash
pnpm install
pnpm --filter <sequenceId> build
npx cdk synth
```

All commands must succeed before the skill is complete.

### What you do NOT need to edit

- CDK infrastructure files - sequences are auto-discovered from `sequences/*/sequence.config.ts`

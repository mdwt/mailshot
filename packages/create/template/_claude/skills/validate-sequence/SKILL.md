---
description: Validate email sequence configs for correctness. Use when the user wants to check, validate, verify, or lint a sequence config. Trigger phrases: "validate sequence", "check my sequence", "is my sequence config correct", "verify the config".
---

# Validate Sequence

Validate that a sequence config is correct — checks types, required fields, template references, and CDK synthesis.

## Usage

```
/validate-sequence              # validates all sequences in sequences/
/validate-sequence onboarding   # validates just one
```

## Instructions

Run through each validation step below in order. Stop at the first failure and report the error clearly with the file path and what needs to be fixed. If all steps pass, report success.

### Step 1: Config file exists

Check that `sequences/<sequenceId>/sequence.config.ts` exists. If validating all sequences, scan `sequences/*/sequence.config.ts`.

### Step 2: Required fields

Read the config file and verify:

- `id` — must be a non-empty string
- `trigger.detailType` — must be a non-empty string
- `trigger.subscriberMapping.email` — must be a JSONPath string starting with `$.`
- `trigger.subscriberMapping.firstName` — must be a JSONPath string starting with `$.`
- `timeoutMinutes` — must be a positive number
- `steps` — must be a non-empty array

### Step 3: Validate steps recursively

Walk the `steps` array (and nested steps inside `choice` branches, `condition` then/else) and check:

**Send steps:**

- `templateKey` is a non-empty string
- `subject` is a non-empty string

**Wait steps:**

- At least one of `days`, `hours`, or `minutes` is set and positive
- No wait step has all duration fields missing/zero

**Choice steps:**

- `field` is a non-empty JSONPath string
- `branches` is a non-empty array
- Each branch has a `value` (string) and `steps` (non-empty array)
- `default` if present is a non-empty array

**Condition steps:**

- `check` is one of: `has_been_sent`, `subscriber_field_exists`, `subscriber_field_equals`
- `has_been_sent` requires `templateKey`
- `subscriber_field_exists` and `subscriber_field_equals` require `field`
- `subscriber_field_equals` requires `value`
- `then` is an array

**Events (if present):**

- Each event has `detailType`, `templateKey`, and `subject`

### Step 4: Collect all templateKeys

Walk the entire config and collect every `templateKey` from:

- Send steps (recursively, including inside choice branches and condition then/else)
- Events array

Report the full list of templateKeys found.

### Step 5: Check template HTML files exist

For each templateKey, check that `build/<sequenceId>/templates/<templateKey>.html` exists. Report any missing templates. If templates are missing, suggest building the sequence first:

```
pnpm --filter @mailshot/<sequenceId> build
```

### Step 6: Typecheck

Run:

```bash
pnpm build
```

Report any type errors.

### Step 7: CDK synth

Run:

```bash
npx cdk synth
```

Report any synthesis errors. If synth succeeds, the config is fully valid and deployable.

### Output

On success:

```
✓ Config file exists
✓ Required fields present
✓ All steps valid
✓ N templateKeys found, all HTML files present
✓ Typecheck passed
✓ CDK synth passed
Sequence "<sequenceId>" is valid and ready to deploy.
```

On failure, stop at the first failing step and report what's wrong with enough detail to fix it.

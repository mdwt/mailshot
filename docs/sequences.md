# Sequences

A sequence is an ordered series of email sends, delays, and branching logic, orchestrated by AWS Step Functions. Each sequence is defined in a `sequence.config.ts` file and auto-discovered by CDK at deploy time.

## File structure

```
sequences/<sequenceId>/
  sequence.config.ts      Sequence definition (steps, trigger, timeout)
  src/
    emails/               React Email templates (.tsx)
    render.ts             Renders .tsx → .html with Liquid placeholders
  package.json
  tsconfig.json
```

## Sequence config

A sequence config satisfies the `SequenceDefinition` type from `@step-func-emailer/shared`:

```typescript
import type { SequenceDefinition } from "@step-func-emailer/shared";

export default {
  id: "trial-expiring",
  trigger: {
    detailType: "trial.expiring",
    subscriberMapping: {
      email: "$.detail.email",
      firstName: "$.detail.firstName",
      attributes: "$.detail",
    },
  },
  timeoutMinutes: 43200, // 30 days
  steps: [
    { type: "send", templateKey: "trial-expiring/warning", subject: "Your trial ends soon" },
    { type: "wait", days: 2 },
    { type: "send", templateKey: "trial-expiring/last-chance", subject: "Last chance" },
  ],
} satisfies SequenceDefinition;
```

### Required fields

| Field                       | Description                                                              |
| --------------------------- | ------------------------------------------------------------------------ |
| `id`                        | Unique kebab-case identifier                                             |
| `trigger.detailType`        | EventBridge detail-type that starts this sequence                        |
| `trigger.subscriberMapping` | JSONPath expressions to extract subscriber fields from the event payload |
| `timeoutMinutes`            | Maximum execution duration before Step Functions times out               |
| `steps`                     | Array of step objects                                                    |

## Step types

### Send

Invokes SendEmailFn to deliver an email:

```typescript
{ type: "send", templateKey: "onboarding/welcome", subject: "Welcome!" }
```

- `templateKey` maps to an S3 path: `s3://bucket/onboarding/welcome.html`
- Pre-send checks run automatically (unsubscribed, suppressed). If a check fails, the step returns `{ sent: false }` and the sequence continues — it does not throw.

### Wait

Pauses the Step Functions execution. No compute runs during the wait — this is free.

```typescript
{ type: "wait", days: 2 }
{ type: "wait", hours: 12 }
{ type: "wait", minutes: 30 }
```

### Choice

Native Step Functions branching on a field in the execution input. No Lambda invocation — the state machine evaluates this directly. Use for data that's available when the sequence starts (subscriber attributes from the triggering event).

```typescript
{
  type: "choice",
  field: "$.subscriber.attributes.plan",
  branches: [
    { value: "pro", steps: [/* ... */] },
    { value: "free", steps: [/* ... */] },
  ],
  default: [/* fallback steps */],
}
```

Choices can be nested. The onboarding sequence nests 3 levels deep: platform → country → payment gateway.

All branches converge automatically — steps after a choice run for every branch.

### Condition

Lambda-based check that queries DynamoDB at runtime. Use when the data isn't in the execution input (e.g., checking if an email was already sent, or if a profile field changed after the sequence started).

```typescript
{
  type: "condition",
  check: "has_been_sent",
  templateKey: "onboarding/welcome",
  then: [],  // skip if already sent
  else: [{ type: "send", templateKey: "onboarding/welcome", subject: "Welcome!" }],
}
```

Available checks:

- `has_been_sent` — requires `templateKey`. True if subscriber has received this template.
- `subscriber_field_exists` — requires `field`. True if the attribute exists and is non-empty.
- `subscriber_field_equals` — requires `field` and `value`. True if the attribute matches.

### Choice vs Condition

|                  | Choice                                                       | Condition                                                     |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| **Evaluated by** | Step Functions (native)                                      | Lambda (CheckConditionFn)                                     |
| **Data source**  | Execution input (event payload)                              | DynamoDB (live query)                                         |
| **Cost**         | Free (state transition only)                                 | Lambda invocation + DynamoDB read                             |
| **Use when**     | Branching on subscriber attributes from the triggering event | Checking send history or profile changes after sequence start |

## Fire-and-forget events

Optional one-off emails triggered by events during a sequence's lifetime:

```typescript
events: [
  {
    detailType: "customer.first_sale",
    templateKey: "onboarding/first-sale-congrats",
    subject: "Congrats on your first sale!",
  },
],
```

These create separate EventBridge rules that invoke SendEmailFn directly (no Step Functions). The email is sent immediately when the event fires.

## Auto-discovery

CDK scans `sequences/*/sequence.config.ts` at deploy time. You never need to manually register a sequence — just create the folder and deploy. The CDK constructs automatically:

1. Create a Step Functions state machine from the config
2. Create EventBridge rules for the trigger and any fire-and-forget events
3. Upload rendered HTML templates to S3

## Execution lifecycle

1. **Event arrives** → EventBridge matches `detailType` → starts Step Functions execution
2. **Register** → SendEmailFn upserts subscriber profile, records active execution
3. **Steps execute** → Send/wait/choice/condition steps run in order
4. **Complete** → SendEmailFn deletes the execution record
5. **Timeout** → If the execution exceeds `timeoutMinutes`, Step Functions stops it

If a subscriber is already in an active execution of the same sequence, the old execution is stopped and replaced with the new one.

## Visualizing sequences

Generate a Mermaid flowchart diagram of any sequence:

```bash
pnpm diagram onboarding
```

Outputs `build/onboarding/diagrams/diagram.mmd` and `diagram.png`.

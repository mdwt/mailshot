<div align="center">
  <img src="https://github.com/user-attachments/assets/20ea65a4-c2e7-44ee-9c1d-eb9cbd1e0dd8" alt="mailshot banner" width="800" />
  <p align="center">
    <img src="https://img.shields.io/badge/AWS-Step%20Functions-FF9900?logo=amazonaws&logoColor=white&style=for-the-badge" />
    <img src="https://img.shields.io/badge/AWS-SES-FF9900?logo=amazonaws&logoColor=white&style=for-the-badge" />
    <img src="https://img.shields.io/badge/Database-DynamoDB-4053D6?logo=amazon-dynamodb&logoColor=white&style=for-the-badge" />
    <img src="https://img.shields.io/badge/Claude-MCP-D97757?logo=anthropic&logoColor=white&style=for-the-badge" />
  </p>

<strong>Open-source email sequences on AWS, managed entirely through Claude Code.</strong>

</div>

---

## What is mailshot?

mailshot is a serverless email sequencing framework built on AWS. It handles onboarding drips, event-triggered sequences, and transactional emails. The same stuff you'd use Kit, Mailchimp, or ActiveCampaign for.

The entire management layer is Claude Code via a custom MCP server. Designing sequences, managing subscribers, checking engagement, deploying infrastructure. All of it through conversation.

You describe what you want. Claude Code generates the sequence config, the templates, validates everything, and deploys it to your AWS account.

```
You:  "Create a 3-part re-engagement sequence for users inactive for 30 days."
      Claude generates sequence config, React Email templates, and build files.

You:  "Preview the day-3 email for user@example.com"
      Claude renders the template with live subscriber data from DynamoDB.

You:  "What are the open rates for the welcome sequence this week?"
      Claude queries the engagement table and reports back.

You:  "Deploy"
      Claude validates, builds, and deploys to AWS.
```

## Why?

Email SaaS pricing is based on subscriber count. That's $39 to $199/month for Kit, $30 to $270/month for Mailchimp, scaling with your list. For sending automated emails on infrastructure that costs AWS a fraction of a cent.

mailshot runs on your AWS account. Pay-per-use pricing. Under $5/month at 1,000 subscribers.

| Subscribers | mailshot | Kit (ConvertKit) | Mailchimp Standard |
| ----------- | -------- | ---------------- | ------------------ |
| 1,000       | ~$5/mo   | $39/mo           | ~$30/mo            |
| 5,000       | ~$8/mo   | $89/mo           | ~$100/mo           |
| 10,000      | ~$12/mo  | $139/mo          | ~$135/mo           |
| 25,000      | ~$20/mo  | $199/mo          | ~$270/mo           |

## Architecture

```
Your App → EventBridge → Step Functions → Lambda → SES → Recipient
                                            ↓
                                    S3 (templates)
                                    DynamoDB (state)
```

| Service            | What it does                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| **EventBridge**    | Receives events from your app, routes them to sequences or single sends                                         |
| **Step Functions** | Orchestrates multi-step sequences: sends, delays, branches, conditions                                          |
| **Lambda**         | Five functions: send email, check conditions, handle unsubscribes, process bounces, track engagement            |
| **DynamoDB**       | Two tables: subscriber state (profiles, executions, send log) and engagement events (opens, clicks, deliveries) |
| **S3**             | Stores rendered HTML templates                                                                                  |
| **SES**            | Sends the emails, tracks opens and clicks                                                                       |

## Sequences as code

Sequences are TypeScript config files. A typed definition you can read, diff, and review.

```typescript
import type { SequenceDefinition } from "@mailshot/shared";

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
  timeoutMinutes: 43200,
  steps: [
    { type: "send", templateKey: "trial-expiring/warning", subject: "Your trial ends soon" },
    { type: "wait", days: 2 },
    { type: "send", templateKey: "trial-expiring/last-chance", subject: "Last chance" },
    { type: "wait", days: 3 },
    {
      type: "choice",
      field: "$.subscriber.attributes.plan",
      branches: [
        {
          value: "pro",
          steps: [
            {
              type: "send",
              templateKey: "trial-expiring/upgrade-thanks",
              subject: "Welcome to Pro",
            },
          ],
        },
        {
          value: "free",
          steps: [
            {
              type: "send",
              templateKey: "trial-expiring/expired",
              subject: "Your trial has ended",
            },
          ],
        },
      ],
    },
  ],
} satisfies SequenceDefinition;
```

Templates are React Email components with LiquidJS placeholders. Full Liquid syntax at runtime: variables, conditionals, loops, filters.

```tsx
export default function WelcomeEmail() {
  return (
    <Html>
      <Body>
        <Text>Hey {"{{ firstName }}"},</Text>
        <Text>Welcome aboard. Here's what to do next...</Text>
        <Button href={"{{ dashboardUrl }}"}>Go to dashboard</Button>
        <Link href={"{{ unsubscribeUrl }}"}>Unsubscribe</Link>
      </Body>
    </Html>
  );
}
```

## Getting started

### 1. Create a new project

```bash
npx create-mailshot my-project
cd my-project
```

### 2. Open Claude Code

```bash
claude
```

```
You:  "Set up my environment"
      Claude discovers your AWS resources, writes .env, registers the MCP server.

You:  "Create a 3-part welcome sequence triggered by customer.created"
      Claude generates the sequence config, React Email templates, and build files.

You:  "Deploy"
      Claude validates, builds, and deploys to AWS.
```

## MCP tools

Once connected, Claude Code has access to:

**Subscribers** get, list, update, delete, unsubscribe, resubscribe

**Engagement** query opens, clicks, deliveries, bounces, complaints per subscriber, per template, or per sequence

**Templates** list, preview with live data, validate Liquid syntax

**Suppression** list suppressed addresses, remove suppressions

**System** failed executions, delivery stats

## Project structure

```
packages/
  shared/       Types, constants, DynamoDB key helpers
  handlers/     Five Lambda functions + shared lib modules
  cdk/          AWS CDK infrastructure
  mcp/          MCP server for Claude Code
  create/       CLI scaffolder
examples/
  hello-world/  Starter templates and example sequence
```

## Requirements

- AWS account with SES in production mode
- Node.js 22+
- Claude Code
- pnpm

## Contributing

```bash
git clone git@github.com:mdwt/mailshot.git
cd mailshot
pnpm install
pnpm -r build
```

## Cost

Under $5/month at 1,000 subscribers. SES charges $0.10 per 1,000 emails. DynamoDB, Lambda, and Step Functions costs are negligible at that scale. Pay-per-use only.

## License

MIT

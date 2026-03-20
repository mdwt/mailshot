<div align="center"><img width="800"  alt="mailshot banner" src="https://github.com/user-attachments/assets/cc20b75f-68b0-49d7-a3e5-43f187e9244b" />

  <p align="center">
    <img src="https://img.shields.io/badge/AWS-Step%20Functions-FF9900?logo=amazonaws&logoColor=white&style=for-the-badge" />
    <img src="https://img.shields.io/badge/AWS-SES-FF9900?logo=amazonaws&logoColor=white&style=for-the-badge" />
    <img src="https://img.shields.io/badge/Database-DynamoDB-4053D6?logo=amazon-dynamodb&logoColor=white&style=for-the-badge" />
    <img src="https://img.shields.io/badge/Claude-MCP-D97757?logo=anthropic&logoColor=white&style=for-the-badge" />
  </p>

<strong>Open-source serverless email sequences on AWS, managed entirely through Claude Code. [mailshot.dev](https://mailshot.dev/)</strong>

</div>

---

## What is mailshot?

mailshot is a serverless email sequencing framework built on AWS. It handles event-triggered sequences like onboarding drips
and evergreen mailers, all serverless and managed by AI.

Designing sequences, deploying infrastructure, managing subscribers, checking engagement. All of it through conversation.

You describe what you want, Claude Code generates the sequence config, the templates, validates everything, and deploys it to your AWS account.

```
You:  "Create a 3-part re-engagement sequence for users inactive for 30 days."
      Claude generates sequence config, email templates, and build files.

You:  "Preview the day-3 email for user@example.com"
      Claude renders the template with live subscriber data from DynamoDB.

You:  "What are the open rates for the welcome sequence this week?"
      Claude queries the engagement table and reports back.

You:  "Deploy"
      Claude validates, builds, and deploys to AWS.
```

## Why?

Cost, convenience and effeciency.

- Email platforms charge $30 to $300/month based on subscriber count for infrastructure that costs a few dollars to run.
- Configuring sequences on platforms means clicking through dated UIs, dragging blocks around, navigating dashboards built ten years ago.
- You're already using AI to write email copy, design templates, and plan sequences, it makes sense to have the entire workflow in one place.

Costs are low, you only pay for a few lambda executions and SES sends - i.e. $5/month at 1,000 subscribers. SES charges $0.10 per 1,000 emails. DynamoDB, Lambda, and Step Functions costs are negligible at that scale. Pay-per-use only.

| Subscribers | mailshot | Typical email platform |
| ----------- | -------- | ---------------------- |
| 1,000       | ~$5/mo   | $30 to $40/mo          |
| 5,000       | ~$8/mo   | $75 to $100/mo         |
| 10,000      | ~$12/mo  | $110 to $140/mo        |
| 25,000      | ~$20/mo  | $200 to $270/mo        |

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

Describe the sequence you want and Claude Code generates the full config - triggers, steps, delays, branches, and email templates. The output is a structured definition you can read, diff, and review.

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

Templates are HTML files with [LiquidJS](https://liquidjs.com/) for runtime variables. Use whatever you want to produce the HTML - React Email, MJML, Handlebars, raw HTML, a drag-and-drop builder. mailshot doesn't care.
It stores your `.html` in S3 and renders Liquid placeholders (`{{ firstName }}`, `{{ unsubscribeUrl }}`, conditionals, loops, filters) at send time.

```html
<h1>Hey {{ firstName }},</h1>
<p>Welcome aboard. Here's what to do next...</p>
<a href="{{ dashboardUrl }}">Go to dashboard</a>
<a href="{{ unsubscribeUrl }}">Unsubscribe</a>
```

The scaffolded project uses React Email by default, but you can swap it out or just drop in `.html` files directly.

## Getting started

This repo is the framework source. To start building email sequences with mailshot:

```bash
npx create-mailshot my-project
cd my-project
claude
```

That scaffolds a new project with everything wired up - CDK infrastructure, sequence auto-discovery, and Claude Code skills for the full workflow.

## Skills

Scaffolded projects ship with four Claude Code skills that handle the core workflow. You don't invoke these explicitly - just describe what you want and Claude uses the right one.

| Skill                 | What it does                                                                     | Example prompt                                                   |
| --------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **setup-env**         | Discovers AWS resources, writes `.env`, registers the MCP server                 | "Set up my environment"                                          |
| **create-sequence**   | Generates sequence config, email templates, and render script from a description | "Create a 3-part welcome sequence triggered by customer.created" |
| **deploy**            | Validates all sequences, builds everything, deploys to AWS                       | "Deploy"                                                         |
| **validate-sequence** | Checks config, template references, types, and CDK synthesis                     | "Validate the onboarding sequence"                               |

## MCP tools

Once connected, Claude Code has access to:

**Subscribers** get, list, update, delete, unsubscribe, resubscribe

**Engagement** query opens, clicks, deliveries, bounces, complaints per subscriber, per template, or per sequence

**Templates** list, preview with live data, validate Liquid syntax

**Suppression** list suppressed addresses, remove suppressions

**System** failed executions, delivery stats

## Framework structure

This repo contains the framework packages published to npm. User projects created with `npx create-mailshot` depend on these.

```
packages/
  shared/       Types, constants, DynamoDB key helpers
  handlers/     Five Lambda functions + shared lib modules
  cdk/          AWS CDK infrastructure
  mcp/          MCP server for Claude Code
  create/       CLI scaffolder (npx create-mailshot)
```

## Requirements

- AWS account with SES in production mode
- Node.js 22+
- Claude Code
- pnpm

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT

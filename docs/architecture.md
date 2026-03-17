# Architecture

## Design principles

- **Product-agnostic** — The framework defines contracts (event shapes, subscriber schema, template format). You provide your own sequences, templates, and events.
- **Zero idle cost** — Step Functions wait states are free. No servers running between emails.
- **AI-native operations** — No admin UI. All management happens through Claude Code via MCP tools and skills.
- **Single-table DynamoDB** — All subscriber state in one table, engagement events in a second. No relational database.

## AWS services

| Service                 | Role                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EventBridge**         | Event ingestion and routing. Custom bus receives events from your app. Rules route to Step Functions (sequences) or Lambda (fire-and-forget).                  |
| **Step Functions**      | Sequence orchestration. One state machine per sequence. Handles branching, delays, and step ordering. Wait states cost nothing.                                |
| **Lambda**              | Five functions: SendEmail, CheckCondition, Unsubscribe, BounceHandler, EngagementHandler.                                                                      |
| **DynamoDB**            | Two tables. Main table: subscriber profiles, active executions, send logs, suppression records. Events table: engagement tracking (opens, clicks, deliveries). |
| **S3**                  | HTML email templates. Deployed via CDK BucketDeployment. Cached in Lambda memory for 10 minutes.                                                               |
| **SES**                 | Email delivery with open/click tracking via configuration set.                                                                                                 |
| **SNS**                 | Routes SES notifications (bounces, complaints, engagement events) to Lambda handlers.                                                                          |
| **SSM Parameter Store** | Runtime configuration. All `.env` values are written as SSM parameters at deploy time, read by Lambdas with 5-minute caching.                                  |

## Data flow

```
┌──────────────────────────────────┐
│ Your App Backend                 │
│ publishes events to EventBridge  │
└───────────────┬──────────────────┘
                │
                ▼
┌──────────────────────────────────┐
│ EventBridge (Custom Bus)         │
│                                  │
│ Sequence rules ──→ Step Functions│
│ Event rules ────→ SendEmailFn    │
└───────┬──────────────────┬───────┘
        │                  │
        ▼                  ▼
 Step Functions        SendEmailFn (fire-and-forget)
   │                       │
   ├─ register ────────────┤
   ├─ send (per step) ─────┤
   ├─ wait (free)          │
   ├─ choice (native)      │
   ├─ condition ───→ CheckConditionFn
   ├─ complete ────────────┤
   │                       │
   └───────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
   DynamoDB           S3 Templates
   (state)            (HTML + Liquid)
        │
        ▼
       SES ──→ Recipient
        │
        ├─ Bounce/Complaint ──→ SNS ──→ BounceHandlerFn
        │                                  └─ suppress subscriber
        │                                  └─ stop executions
        │
        ├─ Engagement ────────→ SNS ──→ EngagementHandlerFn
        │  (open/click/delivery)           └─ write to Events table
        │
        └─ Unsubscribe link ──→ UnsubscribeFn (Function URL)
                                   └─ mark unsubscribed
                                   └─ stop executions
```

## Lambda functions

### SendEmailFn (256MB, 30s timeout)

The main workhorse. Handles four actions:

- **register** — Upsert subscriber profile, track execution in DynamoDB
- **send** — Pre-send checks → fetch template → render with Liquid → send via SES → log
- **fire_and_forget** — Upsert + send in one call (for event-triggered single emails)
- **complete** — Remove execution record when sequence finishes

### CheckConditionFn (128MB, 10s timeout)

Runtime condition evaluation for Step Functions. Queries DynamoDB to check:

- `has_been_sent` — Has this subscriber received a specific template?
- `subscriber_field_exists` — Does a profile attribute exist?
- `subscriber_field_equals` — Does a profile attribute match a value?

### UnsubscribeFn (128MB, 10s, Function URL)

Public endpoint (no auth). Validates HMAC-SHA256 token, marks subscriber as unsubscribed, stops all active executions, returns HTML confirmation page.

### BounceHandlerFn (128MB, 10s)

SNS trigger. Processes permanent bounces and complaints. Marks subscriber as suppressed, stops all executions. Ignores transient bounces.

### EngagementHandlerFn (128MB, 10s)

SNS trigger. Writes delivery, open, click, bounce, and complaint events to the Events table with 365-day TTL.

## Caching layers

| Cache                 | TTL        | Scope                      |
| --------------------- | ---------- | -------------------------- |
| SSM config            | 5 minutes  | Module-level Map in Lambda |
| S3 templates          | 10 minutes | Module-level Map in Lambda |
| Display name mappings | 10 minutes | Module-level Map in Lambda |

## Cost model

At 1,000 subscribers, total cost is under $5/month:

- **Step Functions**: $0.000025 per state transition. A 10-step sequence with 5 sends costs ~$0.00025 per execution.
- **Wait states**: Free. A 30-day sequence costs the same as a 1-day sequence.
- **Lambda**: Negligible at low volume. 128–256MB functions running for <1s per invocation.
- **DynamoDB**: On-demand pricing. A few cents per month at 1,000 subscribers.
- **SES**: $0.10 per 1,000 emails.
- **S3**: Negligible for storing HTML templates.
- **SSM**: Free for standard parameters.

Compare this to $29–299/month for email SaaS tools that do the same thing.

## Monorepo structure

```
packages/
  shared/       Types, constants, DynamoDB key helpers (build first)
  handlers/     5 Lambda functions + shared lib modules
  cdk/          AWS CDK infrastructure
  mcp/          MCP server for Claude Code integration
sequences/
  onboarding/   Example sequence with config + templates
tools/
  visualize-sequence.ts   Mermaid diagram generator
```

All packages use pnpm workspaces. `shared` must build first since all others depend on it.

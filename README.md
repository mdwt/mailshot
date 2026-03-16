# step-func-emailer

Serverless email sequences on AWS. Step Functions for orchestration, SES for delivery, DynamoDB for state. No servers, no polling, no cron jobs.

Build onboarding drips, event-triggered sequences, and transactional emails with durable wait states that cost nothing while they wait. Manage everything through Claude Code via the MCP server — no dashboard needed.

## How it works

Your app publishes events to EventBridge. Each event either starts a Step Functions sequence or fires a single email through the shared Send Lambda. The Lambda fetches an HTML template from S3, renders it with LiquidJS, and sends it through SES. Subscriber state, execution tracking, and send logs live in DynamoDB. Engagement events (opens, clicks, deliveries) are tracked in a separate table and queryable through the MCP server.

```
App backend → EventBridge → Step Functions → Send Lambda → SES
                                                  ↓
                                          S3 (templates)
                                          DynamoDB (state)
```

## Getting started

```bash
git clone <repo-url> my-project
cd my-project
pnpm install
cp .env.example .env
```

Edit `.env` with your AWS account, region, SES domain, and sender details. Then build and deploy:

```bash
pnpm -r build
pnpm --filter @step-func-emailer/cdk deploy
```

### Project structure

```
packages/
  shared/       — Types, constants, DynamoDB key helpers
  handlers/     — Five Lambda functions + shared lib modules
  cdk/          — AWS CDK infrastructure
  mcp/          — MCP server for Claude Code integration
apps/
  hello-world/  — Starter app with React Email templates
```

## Templates

Templates are React Email components in `apps/hello-world/src/emails/`. The build step renders them to static HTML with [LiquidJS](https://liquidjs.com/) placeholders, outputs to `out/`, and CDK deploys them to S3.

Full Liquid syntax at runtime — variables, conditionals, loops, filters:

```html
<p>Hey {{ firstName }},</p>

{% if platform == "kajabi" %}
  <p>Here's how to connect your Kajabi checkout...</p>
{% endif %}

<p><a href="{{ unsubscribeUrl }}">Unsubscribe</a></p>
```

Template keys map directly to S3 paths. `onboarding/welcome` → `s3://bucket/onboarding/welcome.html`

Preview templates with live subscriber data through the MCP server's `preview_template` tool, or use the React Email dev server:

```bash
pnpm --filter @step-func-emailer/hello-world dev
```

## Sequences

Each sequence is a Step Functions state machine defined in CDK. The state machine calls the shared Send Lambda with a template key, subject, and subscriber context. Wait states handle delays between emails — no compute running while it waits.

The starter project includes an onboarding sequence: welcome email → wait 2 days → day-3 email → wait 3 days → day-6 email.

Every state machine starts with a `register` call and ends with a `complete` call. Send steps pass `{ action: "send", templateKey, subject, subscriber }`. Pre-send checks (unsubscribed, suppressed, rate-limited) return `{ sent: false }` without throwing — sequences continue, emails are skipped.

## Events

Your app publishes events to a custom EventBridge bus. Two types of rules:

**Sequence rules** start a Step Functions execution:
- `customer.created` → onboarding sequence

**Fire-and-forget rules** invoke the Send Lambda directly for single emails:
- `sale.first` → congratulations email (example in code, uncomment to enable)

Add new events by defining EventBridge rules in CDK and creating the corresponding templates.

## MCP server

Manage subscribers, preview templates, check engagement, and monitor system health through Claude Code. No UI needed.

```bash
claude mcp add step-func-emailer -- npx @step-func-emailer/mcp
```

Uses your local AWS credentials. Tools include:

- **Subscribers** — look up, update, unsubscribe, resubscribe, delete
- **Engagement** — query opens, clicks, deliveries by subscriber or template
- **Templates** — list, preview with subscriber data, validate Liquid syntax
- **Suppression** — view and manage bounced/complained addresses
- **Health** — failed executions, delivery stats

## Architecture

- **EventBridge** — event ingestion and routing
- **Step Functions** — sequence execution with durable wait states
- **Lambda** — email sending, condition checks, unsubscribe handling, bounce processing, engagement tracking (5 functions)
- **DynamoDB** — two tables: main table (subscriber state, executions, send log) and events table (engagement tracking with TemplateIndex GSI)
- **S3** — HTML templates
- **SES** — email delivery with open/click tracking
- **SNS** — bounce/complaint and engagement event notifications

## Configuration

All config lives in `.env` at the repo root (see `.env.example`). At deploy time, CDK writes these values as SSM parameters. Lambda handlers read config from SSM at runtime with 5-minute caching.

Key settings:

| Variable | Description |
|----------|-------------|
| `TABLE_NAME` | Main DynamoDB table name |
| `EVENTS_TABLE_NAME` | Engagement events table name |
| `TEMPLATE_BUCKET_NAME` | S3 bucket for HTML templates |
| `DEFAULT_FROM_EMAIL` | SES verified sender address |
| `UNSUBSCRIBE_SECRET` | HMAC secret for unsubscribe tokens |
| `SSM_PREFIX` | SSM parameter namespace |

## Cost

Under $5/month at 1,000 subscribers. Step Functions charges per state transition ($0.000025 each). Wait states are free. Lambda, DynamoDB, SES, and S3 costs are negligible at this scale.

## License

MIT

# step-func-emailer

Serverless email sequences on AWS. Step Functions for orchestration, SES for delivery, DynamoDB for state.

Build onboarding drips, event-triggered sequences, and transactional emails. Manage everything through Claude Code via the MCP server — no dashboard needed.

## Quick start

```bash
npx create-step-func-emailer my-project
cd my-project
claude                    # Open Claude Code
/setup-env                # Configure AWS environment
/create-sequence          # Create your first email sequence
/deploy                   # Deploy to AWS
```

## How it works

Your app publishes events to EventBridge. Each event starts a Step Functions sequence. The Lambda fetches an HTML template from S3, renders it with LiquidJS, and sends it through SES. Subscriber state, execution tracking, and send logs live in DynamoDB. Engagement events (opens, clicks, deliveries) are tracked in a separate table and queryable through the MCP server.

```
App backend → EventBridge → Step Functions → Send Lambda → SES
                                                  ↓
                                          S3 (templates)
                                          DynamoDB (state)
```

## Framework development

If you're contributing to the framework itself (not building a project on top of it):

```bash
git clone <repo-url>
cd step-func-emailer
pnpm install
cp .env.example .env
pnpm -r build
```

### Project structure

```
packages/
  shared/       — Types, constants, DynamoDB key helpers
  handlers/     — Five Lambda functions + shared lib modules
  cdk/          — AWS CDK infrastructure constructs
  mcp/          — MCP server for Claude Code integration
  create/       — create-step-func-emailer CLI scaffolder
examples/
  hello-world/  — Reference sequence with React Email templates
```

### Publishing

This project uses [Changesets](https://github.com/changesets/changesets) for versioning. Core packages (shared, handlers, cdk, mcp, create) are linked — they version together.

```bash
# 1. Make code changes
# 2. Create a changeset
pnpm changeset

# 3. When ready to release
pnpm release              # version + build + publish to npm
```

## Templates

Templates are React Email components. The build step renders them to static HTML with [LiquidJS](https://liquidjs.com/) placeholders, and CDK deploys them to S3.

Full Liquid syntax at runtime — variables, conditionals, loops, filters:

```html
<p>Hey {{ firstName }},</p>

{% if platform == "kajabi" %}
<p>Here's how to connect your Kajabi checkout...</p>
{% endif %}

<p><a href="{{ unsubscribeUrl }}">Unsubscribe</a></p>
```

Template keys map directly to S3 paths. `onboarding/welcome` → `s3://bucket/onboarding/welcome.html`

Preview templates with live subscriber data through the MCP server's `preview_template` tool.

## Sequences

Each sequence is a Step Functions state machine defined in CDK. The state machine calls the shared Send Lambda with a template key, subject, and subscriber context. Wait states handle delays between emails — no compute running while it waits.

Every state machine starts with a `register` call and ends with a `complete` call. Send steps pass `{ action: "send", templateKey, subject, subscriber }`. Pre-send checks (unsubscribed, suppressed, rate-limited) return `{ sent: false }` without throwing — sequences continue, emails are skipped.

See `examples/hello-world` for a reference implementation.

## Events

Your app publishes events to a custom EventBridge bus. Two types of rules:

**Sequence rules** start a Step Functions execution:

- `customer.created` → onboarding sequence

**Fire-and-forget rules** invoke the Send Lambda directly for single emails:

- `sale.first` → congratulations email (example in code, uncomment to enable)

Add new events by defining EventBridge rules in CDK and creating the corresponding templates.

## MCP server

Manage subscribers, preview templates, check engagement, and monitor system health through Claude Code. No UI needed.

For projects created with `create-step-func-emailer`:

```bash
claude mcp add step-func-emailer -e AWS_PROFILE=<your-profile> -- npx @step-func-emailer/mcp
```

For the framework repo:

```bash
claude mcp add step-func-emailer -e AWS_PROFILE=<your-profile> -- npx --prefix packages/mcp tsx packages/mcp/src/index.ts
```

The MCP server reads `TABLE_NAME`, `EVENTS_TABLE_NAME`, `TEMPLATE_BUCKET_NAME`, and `REGION` from the `.env` file automatically. `AWS_PROFILE` is passed as an environment variable so it uses the correct AWS credentials.

After adding, restart Claude Code. The tools will be available immediately:

- **Subscribers** — `get_subscriber`, `list_subscribers`, `update_subscriber`, `delete_subscriber`, `unsubscribe_subscriber`, `resubscribe_subscriber`
- **Engagement** — `get_subscriber_events`, `get_template_events`, `get_sequence_events` (query opens, clicks, deliveries, bounces, complaints)
- **Templates** — `list_templates`, `preview_template` (render with live subscriber data), `validate_template` (check Liquid syntax)
- **Suppression** — `list_suppressed`, `remove_suppression`
- **Health** — `get_failed_executions`, `get_delivery_stats`

## Architecture

- **EventBridge** — event ingestion and routing
- **Step Functions** — sequence execution with durable wait states
- **Lambda** — email sending, condition checks, unsubscribe handling, bounce processing, engagement tracking (5 functions)
- **DynamoDB** — two tables: main table (subscriber state, executions, send log) and events table (engagement tracking with TemplateIndex GSI)
- **S3** — HTML templates
- **SES** — email delivery with open/click tracking
- **SNS** — bounce/complaint and engagement event notifications

## Configuration

All config lives in `.env` at the project root (see `.env.example`). At deploy time, CDK writes these values as SSM parameters. Lambda handlers read config from SSM at runtime with 5-minute caching.

Key settings:

| Variable               | Description                             |
| ---------------------- | --------------------------------------- |
| `AWS_PROFILE`          | AWS CLI profile for deployments and MCP |
| `TABLE_NAME`           | Main DynamoDB table name                |
| `EVENTS_TABLE_NAME`    | Engagement events table name            |
| `TEMPLATE_BUCKET_NAME` | S3 bucket for HTML templates            |
| `DEFAULT_FROM_EMAIL`   | SES verified sender address             |
| `UNSUBSCRIBE_SECRET`   | HMAC secret for unsubscribe tokens      |
| `SSM_PREFIX`           | SSM parameter namespace                 |

## Permissions

The local AWS profile (`AWS_PROFILE` in `.env`) needs permissions for CDK deployment, the MCP server, and manual test events. Lambda execution roles are created automatically by CDK with least-privilege grants — no manual setup needed.

Minimum IAM policy for the local profile:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:<region>:<account>:table/<table-name>",
        "arn:aws:dynamodb:<region>:<account>:table/<table-name>/index/*",
        "arn:aws:dynamodb:<region>:<account>:table/<events-table-name>",
        "arn:aws:dynamodb:<region>:<account>:table/<events-table-name>/index/*"
      ]
    },
    {
      "Sid": "S3Templates",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::<template-bucket-name>", "arn:aws:s3:::<template-bucket-name>/*"]
    },
    {
      "Sid": "StepFunctions",
      "Effect": "Allow",
      "Action": ["states:StopExecution", "states:ListExecutions"],
      "Resource": "*"
    },
    {
      "Sid": "EventBridge",
      "Effect": "Allow",
      "Action": "events:PutEvents",
      "Resource": "arn:aws:events:<region>:<account>:event-bus/<event-bus-name>"
    },
    {
      "Sid": "CDKBootstrap",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::<account>:role/cdk-hnb659fds-*-<account>-<region>"
    }
  ]
}
```

Replace `<account>`, `<region>`, `<table-name>`, `<events-table-name>`, `<template-bucket-name>`, and `<event-bus-name>` with your values from `.env`.

## Cost

Under $5/month at 1,000 subscribers. Step Functions charges per state transition ($0.000025 each). Wait states are free. Lambda, DynamoDB, SES, and S3 costs are negligible at this scale.

## License

MIT

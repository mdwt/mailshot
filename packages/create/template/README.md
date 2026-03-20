# {{PROJECT_NAME}}

Serverless email sequences on AWS, powered by [mailshot](https://github.com/mdwt/mailshot).

## Setup

Open Claude Code and describe what you need:

```
"Set up my environment"           → configures .env with your AWS resources
"Create a welcome sequence"       → generates sequence config + templates
"Deploy"                          → validates, builds, deploys to AWS
```

Or run the setup manually:

```bash
cp .env.example .env              # Fill in your AWS details
pnpm build                        # Build all sequences
npx cdk deploy                    # Deploy to AWS
```

## Creating sequences

Each sequence lives in `sequences/<name>/` and is auto-discovered by CDK. A sequence has:

- **`sequence.config.ts`** - defines the trigger event, email steps, delays, and branching logic
- **`src/emails/`** - email templates (HTML with Liquid variables for personalization)
- **`src/render.ts`** - renders templates to static HTML for deployment

Ask Claude Code to create one - just describe your sequence and it generates everything.

## Templates

Templates are HTML files. Use any tool to produce them - React Email, MJML, raw HTML, a drag-and-drop builder. At send time, mailshot renders [LiquidJS](https://liquidjs.com/) variables:

```html
<h1>Hey {{ firstName }},</h1>
<p>Welcome aboard.</p>
<a href="{{ unsubscribeUrl }}">Unsubscribe</a>
```

Any subscriber attribute from your triggering event is available as a Liquid variable. Full Liquid syntax is supported: conditionals, loops, filters.

## Project structure

```
sequences/          Email sequences (auto-discovered)
  <name>/
    sequence.config.ts
    src/emails/     Templates
    src/render.ts   Template renderer
bin/app.ts          CDK entry point
.env                AWS configuration
build/              Generated artifacts (gitignored)
```

## Commands

| Command                              | What it does                                     |
| ------------------------------------ | ------------------------------------------------ |
| `pnpm build`                         | Build all sequences (compile + render templates) |
| `npx cdk synth`                      | Synthesize CloudFormation template               |
| `npx cdk deploy`                     | Deploy everything to AWS                         |
| `pnpm --filter @mailshot/<name> dev` | React Email dev server for a sequence            |

## MCP tools

If you ran `/setup-env` (or manually added the MCP server), Claude Code has access to subscriber management, engagement analytics, template preview, and system health tools. Ask things like:

- "List subscribers who signed up this week"
- "What are the open rates for the welcome sequence?"
- "Preview the day-3 email for user@example.com"
- "Are there any failed executions?"

## AWS resources

Everything runs on your AWS account. The CDK stack creates:

- **DynamoDB** - subscriber profiles, execution tracking, engagement events
- **Lambda** - send email, check conditions, handle bounces/unsubscribes, track engagement
- **Step Functions** - orchestrates multi-step sequences
- **EventBridge** - receives events from your app, routes to sequences
- **S3** - stores rendered HTML templates
- **SES** - sends emails, tracks opens/clicks

## Links

- [mailshot documentation](https://github.com/mdwt/mailshot)
- [LiquidJS reference](https://liquidjs.com/)
- [React Email components](https://react.email/docs/components/html) (optional)

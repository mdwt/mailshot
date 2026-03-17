# Documentation

step-func-emailer is a serverless email sequencing framework on AWS, designed so that a single person can create, deploy, manage, and query email sequences entirely through AI (Claude Code) at near-zero cost.

The core idea: describe what you want in natural language, and Claude Code handles the rest — generating sequence configs, rendering templates, deploying infrastructure, managing subscribers, and monitoring delivery. No dashboard, no SaaS fees, no vendor lock-in.

## Docs index

| Document                              | What it covers                                                              |
| ------------------------------------- | --------------------------------------------------------------------------- |
| [Architecture](./architecture.md)     | System overview, AWS services, data flow, cost model                        |
| [Sequences](./sequences.md)           | Defining email sequences with send, wait, choice, and condition steps       |
| [Templates](./templates.md)           | React Email components, Liquid rendering, template lifecycle                |
| [Subscribers](./subscribers.md)       | Subscriber profiles, lifecycle states, suppression, unsubscribe             |
| [Events & Engagement](./events.md)    | EventBridge ingestion, SES engagement tracking, analytics                   |
| [DynamoDB Schema](./dynamo-schema.md) | Single-table design, key patterns, TTLs, GSIs                               |
| [Deployment](./deployment.md)         | Environment setup, build pipeline, CDK deploy workflow                      |
| [MCP Server](./mcp-server.md)         | AI-driven management — subscriber ops, engagement queries, template preview |
| [Skills & Workflows](./skills.md)     | Claude Code skills for creating, validating, and deploying sequences        |

## Quick orientation

```
Your app backend
    │
    │  publishes events
    ▼
EventBridge ──→ Step Functions ──→ SendEmailFn ──→ SES
                                       │
                                  S3 (templates)
                                  DynamoDB (state)
```

1. Your app publishes an event (e.g., `customer.created`) to EventBridge
2. An EventBridge rule starts a Step Functions state machine
3. The state machine walks through send/wait/choice/condition steps
4. Each send step invokes a Lambda that fetches a template from S3, renders it with LiquidJS, and sends via SES
5. Bounces, complaints, opens, clicks, and deliveries are tracked automatically

Everything is defined in code, deployed with CDK, and managed through Claude Code.

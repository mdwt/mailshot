# Events & Engagement

The system uses events at two levels: **EventBridge events** to trigger sequences and emails, and **SES engagement events** to track delivery, opens, clicks, bounces, and complaints.

## EventBridge events

Your app publishes events to a custom EventBridge bus. Two types of routing rules handle them:

### Sequence triggers

An EventBridge rule matches a `detailType` and starts a Step Functions execution:

```json
{
  "source": ["your-app"],
  "detail-type": ["customer.created"]
}
```

The `subscriberMapping` in the sequence config extracts subscriber fields from the event using JSONPath:

```typescript
subscriberMapping: {
  email: "$.detail.email",
  firstName: "$.detail.firstName",
  attributes: "$.detail",
}
```

This means your event payload at `detail` becomes the subscriber's attributes. Any fields you include (platform, country, plan, etc.) are available for choice branching and Liquid template rendering.

### Fire-and-forget events

One-off emails triggered by events, with no sequence or state machine:

```typescript
events: [
  {
    detailType: "customer.first_sale",
    templateKey: "onboarding/first-sale-congrats",
    subject: "Congrats on your first sale!",
  },
];
```

These create EventBridge rules that invoke SendEmailFn directly. The Lambda upserts the subscriber profile and sends the email in one call.

### Publishing events

From your app, publish to EventBridge:

```typescript
await eventBridgeClient.send(
  new PutEventsCommand({
    Entries: [
      {
        Source: "your-app",
        DetailType: "customer.created",
        EventBusName: "step-func-emailer-bus",
        Detail: JSON.stringify({
          email: "user@example.com",
          firstName: "Jane",
          platform: "kajabi",
          country: "ZA",
        }),
      },
    ],
  }),
);
```

## SES engagement tracking

SES publishes engagement events to SNS, which triggers EngagementHandlerFn. Five event types are tracked:

| Event type  | What it means                                                       |
| ----------- | ------------------------------------------------------------------- |
| `delivery`  | SES successfully delivered the email to the recipient's mail server |
| `open`      | Recipient opened the email (tracking pixel)                         |
| `click`     | Recipient clicked a tracked link                                    |
| `bounce`    | Email bounced (permanent or transient)                              |
| `complaint` | Recipient marked the email as spam                                  |

### Events table

Engagement events are stored in a dedicated DynamoDB table:

```
PK: SUB#user@example.com
SK: EVT#2026-03-17T10:30:00.000Z#delivery
```

Each event record includes:

- `eventType` — delivery, open, click, bounce, complaint
- `templateKey` — Which template was sent
- `sequenceId` — Which sequence the email belonged to
- `subject` — Email subject line
- `timestamp` — When the event occurred
- `ttl` — 365 days from creation (auto-deleted)

### TemplateIndex GSI

A global secondary index enables querying events by template:

```
GSI PK: templateKey (e.g., "onboarding/welcome")
GSI SK: EVT#<timestamp>#<eventType>
```

This powers cross-subscriber analytics: "How many people opened the welcome email this week?"

### Bounce and complaint handling

Bounces and complaints flow through two paths:

1. **EngagementHandlerFn** — Records the event in the Events table for analytics
2. **BounceHandlerFn** — Suppresses the subscriber and stops all executions

BounceHandlerFn only acts on permanent bounces and complaints. Transient bounces are recorded but don't trigger suppression.

## Querying engagement via MCP

The MCP server provides three engagement query tools:

### get_subscriber_events

Query events for a specific subscriber:

```
get_subscriber_events(email: "user@example.com", eventType: "open", startDate: "2026-03-01")
```

### get_template_events

Query events across all subscribers for a template (uses TemplateIndex GSI):

```
get_template_events(templateKey: "onboarding/welcome", eventType: "click")
```

### get_sequence_events

Query events for an entire sequence:

```
get_sequence_events(sequenceId: "onboarding", startDate: "2026-03-01", endDate: "2026-03-17")
```

### get_delivery_stats

Aggregate delivery statistics over a date range:

```
get_delivery_stats(startDate: "2026-03-01", endDate: "2026-03-17")
```

Returns counts by event type: deliveries, opens, clicks, bounces, complaints.

---
description: Send a one-off broadcast email to filtered subscribers. Use when the user wants to send a broadcast, product update, announcement, newsletter, or one-off email to a group of subscribers. Trigger phrases: "send a broadcast", "send product update", "email all subscribers", "send announcement", "broadcast email", "send newsletter", "one-off email", "mass email".
---

# Send Broadcast

Send a one-off broadcast email to a filtered subset of subscribers. Broadcasts are triggered via EventBridge and fan out through SQS for reliable delivery at scale.

## Usage

```
/send-broadcast <description of what you want to send>
```

Example: `/send-broadcast Send our April product update to all subscribers tagged "product-updates" who are on the pro plan`

## Instructions

You are constructing and sending a broadcast email. Follow this workflow exactly.

### Step 1: Parse the input

Extract from the user's description:

- **broadcastId** - unique kebab-case identifier for this broadcast (e.g., `product-update-2026-04`, `feature-launch-notifications`). If not specified, generate one from the description + current date.
- **templateKey** - the S3 template key to use (e.g., `broadcasts/product-update-april`). If the template doesn't exist yet, you'll create it.
- **subject** - email subject line. Supports Liquid variables (e.g., `{{ firstName }}, here's what's new`)
- **sender** - the sending configuration:
  - `fromEmail` - SES-verified email address to send from
  - `fromName` - display name in the "From" field
  - `replyToEmail` (optional) - Reply-To address
  - `listUnsubscribe` (optional, default: `true`) - set to `false` to omit List-Unsubscribe headers
- **filters** - who should receive the broadcast:
  - `tags` - string array, AND logic (subscriber must have ALL listed tags)
  - `attributes` - key-value equality match on subscriber profile fields (e.g., `{ plan: "pro" }`)

If any critical fields are missing (especially sender and template), ask the user to clarify before proceeding.

### Step 2: Check the template

Check if the template already exists in the S3 bucket or locally:

1. Use `list_templates` MCP tool with prefix `broadcasts/` to see existing templates
2. If the template doesn't exist, ask the user if they want to create one

If creating a new template:

- Create it at `sequences/<any-sequence>/src/emails/` or as a standalone HTML file
- Templates use LiquidJS syntax with these available variables:
  - `{{ firstName }}` - subscriber's first name
  - `{{ email }}` - subscriber's email
  - `{{ unsubscribeUrl }}` - one-click unsubscribe link
  - `{{ currentYear }}` - current year
  - Any custom subscriber attributes (e.g., `{{ plan }}`, `{{ country }}`)
- The template must be deployed to S3 before sending (via `cdk deploy` or manual upload)

### Step 3: Estimate the audience

Before sending, help the user understand who will receive the broadcast:

1. Use `list_subscribers` MCP tool with `status: "active"` to get a count of active subscribers
2. If filtering by tags, note that the exact count requires querying the tag index (not available via MCP yet — inform the user this is an estimate)
3. Present a summary:

```
Broadcast summary:
- ID: product-update-2026-04
- Template: broadcasts/product-update-april
- Subject: What's new in April
- From: "Your Product" <updates@yourdomain.com>
- Filters: tag=product-updates, plan=pro
- Estimated audience: ~X active subscribers
```

### Step 4: Confirm with the user

**Always ask for confirmation before sending.** This is a destructive operation — emails cannot be unsent. Present the full broadcast config and wait for explicit approval.

### Step 5: Send the broadcast

Use the `send_broadcast` MCP tool to publish the broadcast event to EventBridge:

```
send_broadcast(
  broadcastId: "product-update-2026-04",
  templateKey: "broadcasts/product-update-april",
  subject: "What's new in April",
  senderFromEmail: "updates@yourdomain.com",
  senderFromName: "Your Product",
  filterTags: ["product-updates"],
  filterAttributes: { plan: "pro" }
)
```

The tool publishes a `broadcast.requested` event to EventBridge. BroadcastFn then:

1. Queries subscribers matching the filters
2. Fans out to SQS (one message per subscriber)
3. SendEmailFn processes each message (pre-send checks, template render, SES send)

### Step 6: Monitor

After sending, suggest the user can check engagement:

```
# Check delivery stats for this broadcast
get_template_events(templateKey: "broadcasts/product-update-april", eventType: "delivery")

# Check opens
get_template_events(templateKey: "broadcasts/product-update-april", eventType: "open")
```

The `broadcastId` is used as the `sequenceId` in engagement tracking, so `get_sequence_events` also works:

```
get_sequence_events(sequenceId: "product-update-2026-04")
```

## Important notes

- Broadcasts reuse the existing SendEmailFn — all pre-send checks apply (unsubscribed/suppressed subscribers are automatically skipped)
- Every email includes an unsubscribe link and List-Unsubscribe headers (unless `listUnsubscribe: false`)
- Engagement tracking (opens, clicks, bounces) works automatically via the existing SES configuration set
- The `broadcastId` must be unique per broadcast. Reusing an ID won't cause errors but will mix engagement data
- Templates must be deployed to S3 before sending. If the template is missing, SendEmailFn will fail for each subscriber (messages go to DLQ after 3 retries)

# Subscribers

A subscriber is anyone who receives emails through the system. Subscriber state is stored in a single DynamoDB table using a single-table design.

## Profile

Every subscriber has a profile record:

```
PK: SUB#user@example.com
SK: PROFILE
```

Fields:

- `email` — Primary identifier
- `firstName` — Used in template rendering
- `attributes` — Arbitrary key-value pairs (platform, country, plan, etc.)
- `unsubscribed` — Boolean, set by UnsubscribeFn
- `suppressed` — Boolean, set by BounceHandlerFn
- `createdAt` — ISO timestamp
- `updatedAt` — ISO timestamp

### Upsert behavior

When a new event triggers a sequence, SendEmailFn upserts the subscriber profile. The upsert:

- Creates the profile if it doesn't exist
- Updates `firstName` and `attributes` if it does exist
- **Never overwrites** `unsubscribed` or `suppressed` flags — only their respective handlers can set these to `true`

This means a subscriber who unsubscribes can't be accidentally re-subscribed by a new event.

## Lifecycle states

```
                    ┌─────────────┐
  event arrives ──→ │   Active    │ ←── resubscribe (MCP)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌──────────┐  ┌───────────┐  ┌──────────┐
      │Unsubscribed│  │ Suppressed │  │ Completed │
      └──────────┘  └───────────┘  └──────────┘
```

### Active

Subscriber has a profile and is eligible to receive emails. May have one or more active sequence executions.

### Unsubscribed

Subscriber clicked the unsubscribe link. The `unsubscribed` flag is set to `true`. All active executions are stopped. Pre-send checks will skip all future emails with `{ sent: false, reason: "unsubscribed" }`.

### Suppressed

A permanent bounce or complaint was received. The `suppressed` flag is set to `true` and a `SUPPRESSION` record is created. All active executions are stopped. Pre-send checks will skip all future emails with `{ sent: false, reason: "suppressed" }`.

### Completed

A sequence execution finished normally. The execution record is deleted. The subscriber profile remains — they can still receive future sequences or fire-and-forget emails.

## Pre-send checks

Before every email, SendEmailFn runs these checks in order:

1. **Unsubscribed** — If `subscriber.unsubscribed === true`, return `{ sent: false }`
2. **Suppressed** — If `subscriber.suppressed === true`, return `{ sent: false }`

Pre-send failures never throw. The sequence continues, the email is simply skipped. This means a 10-email sequence will still complete even if the subscriber unsubscribes after email 3 — emails 4–10 are skipped gracefully.

## Active executions

When a sequence starts, a `register` action creates an execution record:

```
PK: SUB#user@example.com
SK: EXEC#onboarding
```

This tracks which sequences a subscriber is currently in. If the same sequence is triggered again for the same subscriber, the old execution is stopped and replaced.

The `complete` action at the end of a sequence deletes this record.

## Send log

Every successful send creates a log record:

```
PK: SUB#user@example.com
SK: SENT#2026-03-17T10:30:00.000Z
```

Send logs have a 90-day TTL. They're used by the `has_been_sent` condition check and for auditing.

## Suppression records

When BounceHandlerFn processes a permanent bounce or complaint:

```
PK: SUB#user@example.com
SK: SUPPRESSION
```

Contains the bounce/complaint type, reason, and timestamp.

## Managing subscribers via MCP

The MCP server provides these subscriber tools:

| Tool                     | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `get_subscriber`         | Full subscriber view: profile, executions, recent sends, suppression |
| `list_subscribers`       | List by status: active, unsubscribed, suppressed                     |
| `update_subscriber`      | Update profile attributes                                            |
| `delete_subscriber`      | Remove all records from both tables                                  |
| `unsubscribe_subscriber` | Mark as unsubscribed, stop executions                                |
| `resubscribe_subscriber` | Clear unsubscribed flag and suppression record                       |

## Unsubscribe tokens

Every email includes an unsubscribe link with an HMAC-SHA256 signed token:

```
https://<function-url>?token=<base64url-encoded>
```

Token format: `email|sendTimestamp|expiryTimestamp|signature`

- Signed with `UNSUBSCRIBE_SECRET` from SSM
- Expires 90 days after the email was sent
- Validated by UnsubscribeFn before processing

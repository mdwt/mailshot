---
description: Inspect a deployed sequence - show currently active subscribers, recent engagement, and recent failures. Use when the user wants to know what's running, who's in a sequence, sequence stats, or how a sequence is performing. Trigger phrases "who is in sequence", "what's running", "sequence status", "inspect sequence", "sequence stats", "how is onboarding doing", "active subscribers".
---

# Inspect Sequence

Read-only inspection of a deployed sequence. Bundles four MCP tools into a single view: active subscribers, engagement summary, recent failures, and a one-paragraph summary. Use this when the user asks "who is in X?", "how is X doing?", "is X healthy?", or similar.

## Usage

```
/inspect-sequence              # picks from deployed sequences interactively
/inspect-sequence <sequenceId> # jumps straight to that sequence
```

## Prerequisites

This skill calls MCP tools from the `mailshot` server. If the server isn't registered yet, run `/setup-env` first.

## Instructions

### Phase 1: Pick a sequence

If the user named a sequence in the prompt, use it directly. Otherwise call `list_sequences` (which now includes `activeExecutionCount` on each entry) and present the choices via `AskUserQuestion`:

- Show each deployed sequence as one option, labelled with `<sequenceId> — N active`.
- If no sequences are deployed, stop and tell the user to `/deploy` first.

Keep the `stateMachineArn` from the chosen sequence — Phase 4 needs it.

### Phase 2: Active subscribers

Call `list_sequence_subscribers` with the chosen `sequenceId` (default limit 50).

Render a compact table, newest first:

```
Active subscribers in <sequenceId>:

  email                          startedAt                  execution
  ─────────────────────────────  ─────────────────────────  ────────────
  alice@example.com              2026-04-08T10:23:45.123Z   …:abc123def
  bob@example.com                2026-04-08T09:15:02.445Z   …:xyz789ghi
```

Truncate `executionArn` to the last 12 characters so the table stays readable. If `activeCount === 0`, say plainly: "No subscribers currently active in `<sequenceId>`."

**Note for the user** (show once, at the end of this phase): "Only executions started after upgrading to mailshot v1.7+ appear here. Anything started on an older version will finish or time out within the sequence's configured `timeoutMinutes`."

### Phase 3: Recent engagement

Call `get_sequence_events(sequenceId, limit=20)`.

Aggregate the returned events by `eventType` and render one line:

```
Last 20 events: 12 deliveries, 8 opens, 1 click, 0 bounces, 0 complaints, 0 replies
```

If there are zero events, say "No recent engagement events."

### Phase 4: Recent failures

Call `get_failed_executions(stateMachineArn, limit=5)` using the ARN kept from Phase 1. If `stateMachineArn` was missing (sequence has S3 templates but no state machine), skip this phase.

If there are zero failures, skip silently. If there are any, render them:

```
Recent failures:
  - 2026-04-08T08:12:33Z  …:exec:failed123  FAILED
  - 2026-04-07T22:04:11Z  …:exec:failed456  FAILED
```

### Phase 5: Summary

Finish with a one-paragraph summary that ties the phases together. Examples:

- "**onboarding** has 3 active subscribers (most recent started 2h ago). Engagement looks healthy — 8 opens from 12 deliveries in the last 20 events. No failures in the last 5 executions."
- "**winback** has 0 active subscribers right now. No events in the last 20. No failures. Probably idle — the trigger event hasn't fired recently."
- "**onboarding** has 42 active subscribers (the list above shows the 50 newest). 18 opens from 38 deliveries recently looks normal. 1 failure in the last 5 — worth a look: `<executionArn>`."

Keep it one paragraph. Do not re-render tables in the summary. The goal is a scannable health readout.

## What this skill does NOT do

- **No mutations.** It never unsubscribes, stops executions, or edits data. If the user wants to act on what they see, they should ask explicitly.
- **No per-subscriber drill-down.** If they want to see one subscriber's full state, they can ask separately and you'll call `get_subscriber`.
- **No historical trends.** Only the last 20 events are summarized — this is a spot check, not a dashboard.

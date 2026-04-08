# @mailshot/shared

## 1.7.0

### Minor Changes

- [`469a296`](https://github.com/mdwt/mailshot/commit/469a2969581ab3a4c2455e9c8d32a104d34817b4) Thanks [@mdwt](https://github.com/mdwt)! - Add `list_sequence_subscribers` MCP tool to show subscribers currently active in a sequence. `putExecution` now writes an inverted sequence-side row (`PK = EXEC#<sequenceId>, SK = SUB#<email>`) atomically via `TransactWriteItems` (following the existing TagItem pattern); `deleteExecution` cleans up both rows. `list_sequences` now includes `activeExecutionCount` per sequence. New `/inspect-sequence` bootstrap skill bundles active subscribers, recent engagement, and recent failures into one read-only inspection workflow.

  **Upgrading existing bootstrapped projects:**
  1. **MCP tools** — `list_sequence_subscribers` and the enriched `list_sequences` are available the next time `npx @mailshot/mcp` spawns. Just restart Claude Code.
  2. **Dual-row writes** — The new MCP tool returns empty until you redeploy, because the inverted EXEC rows are produced by the handler code that ships in this version. Bump deps and redeploy:
     ```bash
     pnpm up @mailshot/handlers @mailshot/cdk @mailshot/shared
     pnpm install
     /deploy
     ```
  3. **`/inspect-sequence` skill** — Skills are scaffolded once at `npx create-mailshot` time and don't auto-update. To add it to an existing project, copy the file from the [v1.7.0 template](https://github.com/mdwt/mailshot/tree/main/packages/create/template/_claude/skills/inspect-sequence) into `.claude/skills/inspect-sequence/SKILL.md`.
  4. **In-flight executions** — EXEC items written before the redeploy only have the subscriber-side row and won't appear in the inspector until they complete and a new execution starts. The gap is bounded by each sequence's `timeoutMinutes`.

## 1.6.0

### Minor Changes

- [#6](https://github.com/mdwt/mailshot/pull/6) [`ab62305`](https://github.com/mdwt/mailshot/commit/ab62305303faa30847d9210749ab78953060f5c8) Thanks [@mdwt](https://github.com/mdwt)! - Add broadcast email support with tag-based subscriber filtering and SQS fan-out

- [`53115a3`](https://github.com/mdwt/mailshot/commit/53115a3bd4a905c097923873261006e390978f14) Thanks [@mdwt](https://github.com/mdwt)! - Rename `BroadcastRecord.subscriberCount` to `audienceSize` and add live engagement counters (`deliveryCount`, `openCount`, `clickCount`, `bounceCount`, `complaintCount`) maintained on a separate `STATS#<sequenceId>/COUNTERS` item by `EngagementHandlerFn`. Counters are merged into `get_broadcast` and `list_broadcasts` responses automatically. The same item also accumulates lifetime stats for sequences as a side benefit.

## 1.5.0

### Minor Changes

- Add A/B testing via variants on send steps and remove text/plain MIME part

## 1.4.0

### Minor Changes

- Add reply forwarding via `forwardRepliesTo` sender config option

## 1.3.0

### Minor Changes

- [`7514d53`](https://github.com/mdwt/mailshot/commit/7514d53ffe2e710bc0a124ac337102e076ac3a41) Thanks [@mdwt](https://github.com/mdwt)! - Add inbound reply tracking as an engagement event type

## 1.2.0

### Minor Changes

- [#4](https://github.com/mdwt/mailshot/pull/4) [`b85c746`](https://github.com/mdwt/mailshot/commit/b85c746ad65474200d351e06ada3368b6df5f220) Thanks [@mdwt](https://github.com/mdwt)! - Add sequence exit events to remove subscribers from sequences on specific EventBridge events

## 1.0.3

### Patch Changes

- [`65a90d2`](https://github.com/mdwt/mailshot/commit/65a90d2a38dab4e76cebe466c54d7e453b20a37a) Thanks [@mdwt](https://github.com/mdwt)! - Remove SSM parameter dependency and fix post-setup guidance to show correct workflow

## 1.0.0

### Major Changes

- Remove SSM Parameter Store in favour of Lambda environment variables for all runtime config

## 0.2.3

### Patch Changes

- Rename project to mailshot and bundle Claude Code skills in scaffolded projects

## 0.2.0

### Minor Changes

- [`72d23af`](https://github.com/mdwt/mailshot/commit/72d23af8e07ab379c794d2918990f7a517a5fc85) Thanks [@mdwt](https://github.com/mdwt)! - Publish framework packages to npm and add create-mailshot CLI

# Transactional Email Flag (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a sequence be marked `transactional` so its emails (sequence sends _and_ its event-triggered fire-and-forget emails) reach subscribers who have unsubscribed from marketing, while never bypassing hard suppression (bounces/complaints).

**Architecture:** Keep the two subscriber flags and their storage unchanged, but redefine their meaning and fix the unsubscribe path so the meaning holds end-to-end:

- `unsubscribed` = "no marketing." Set by the unsubscribe link. A pure app-level flag — it no longer adds the address to the SES account suppression list, and it no longer stops _transactional_ sequence executions.
- `suppressed` = "no mail ever." Set only by the bounce/complaint handler. Adds to the SES suppression list and stops _all_ executions. Never bypassable.
- `transactional` is a property of the sequence. It is baked into the Step Functions `register`/`send`/`fire_and_forget` payloads at deploy time, persisted on the execution row, and read by `SendEmailFn` to (a) skip the `unsubscribed` guard and (b) omit `List-Unsubscribe` headers.

**Tech Stack:** TypeScript (CommonJS, Node16 resolution), AWS CDK (`NodejsFunction`, Step Functions, EventBridge), Vitest, Changesets.

---

## Why this is bigger than a single handler flag (grilling outcomes)

The naive version — "make `SendEmailFn` ignore `unsubscribed` when transactional" — does **not** work, because two things downstream of the send decision defeat it:

1. **SES account suppression list.** `unsubscribe.ts:58` calls `addToSuppressionList(email, "COMPLAINT")` (`ses-suppression.ts:16` → SES `PutSuppressedDestinationCommand`). Once an address is on the SES account suppression list, **SES drops every message to it** regardless of our handler logic. Fix: unsubscribe must stop adding to the SES list. The SES list becomes bounce/complaint-only (driven solely by `bounce-handler.ts`).
2. **`stopAllExecutions`.** `unsubscribe.ts:57` force-stops every running Step Functions execution (`execution-stopper.ts:44`), including an in-flight transactional onboarding sequence. Fix: persist `transactional` on the execution row and have the unsubscribe path skip transactional executions; the bounce/complaint path still stops everything.

Decisions locked during grilling:

- **Per-step `transactional` override: dropped.** Sequence-level only. `SendStep` is untouched.
- **`events` (fire-and-forget within a sequence) inherit the sequence's `transactional` flag.** Broadcasts share the `fire_and_forget` action but never set the flag, so they stay marketing.
- **No historical SES-list cleanup.** Subscribers who unsubscribed _before_ this ships remain on the SES list and out of scope. New unsubscribes work immediately.
- **`suppressed` is never bypassable.** Only the `unsubscribed` guard is conditional on `transactional`.
- **Broadcasts stay marketing.** `BroadcastInput` gets no `transactional` field.
- **Backward compatible.** `transactional` is optional, defaulting to `false`/absent everywhere. Existing sequences and existing execution rows (which lack the field) behave exactly as today. No stored-data migration.

## File structure

| File                                               | Responsibility                                                                  | Change                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts`                     | Type contracts                                                                  | Add `transactional?: boolean` to `SequenceDefinition`, `RegisterInput`, `SendInput`, `FireAndForgetInput`, `ActiveExecution`                                                                                |
| `packages/handlers/src/lib/dynamo-client.ts`       | Execution-row persistence                                                       | `putExecution` accepts + stores `transactional` on both rows                                                                                                                                                |
| `packages/handlers/src/handlers/send-email.ts`     | Register guard, pre-send check, header suppression, fire-and-forget passthrough | `unsubscribed` checks conditional on `transactional`; pass `transactional` to `putExecution`; `listUnsubscribe: false` when transactional; forward `transactional` from `fire_and_forget` → internal `send` |
| `packages/handlers/src/lib/execution-stopper.ts`   | Stop executions                                                                 | `stopAllExecutions` gains `skipTransactional` arg; skips (does not stop or delete) transactional executions when set                                                                                        |
| `packages/handlers/src/handlers/unsubscribe.ts`    | Marketing opt-out                                                               | Remove `addToSuppressionList` call; call `stopAllExecutions(..., true)`                                                                                                                                     |
| `packages/handlers/src/handlers/bounce-handler.ts` | Hard suppression                                                                | Call `stopAllExecutions(..., false)` (keep `addToSuppressionList`)                                                                                                                                          |
| `packages/cdk/lib/constructs/state-machines.ts`    | Bake flag into SFN payloads                                                     | `transactional` in register payload; thread sequence value through `buildChain` → step builders → `buildSendStep`                                                                                           |
| `packages/cdk/lib/constructs/event-bus.ts`         | Bake flag into event emails                                                     | `events` rule payload carries `def.transactional`                                                                                                                                                           |
| Tests                                              | Unit coverage                                                                   | `dynamo-client.test.ts`, `send-email.test.ts`, `execution-stopper.test.ts`, `unsubscribe.test.ts`, `bounce-handler.test.ts`                                                                                 |
| Docs                                               | Internal + public                                                               | `CLAUDE.md`, `packages/create/template/CLAUDE.md`, `README.md`, `packages/create/template/README.md`, `create-sequence/SKILL.md`, `send-broadcast/SKILL.md`                                                 |
| `.changeset/transactional-email-flag.md`           | Release metadata                                                                | `minor` for shared, handlers, cdk                                                                                                                                                                           |

---

## Task 1: Add `transactional` to shared types

**Files:**

- Modify: `packages/shared/src/types.ts` — `RegisterInput` (`:68-73`), `SendInput` (`:75-83`), `FireAndForgetInput` (`:85-92`), `ActiveExecution` (`:24-30`), `SequenceDefinition` (`:243-251`)

- [ ] **Step 1: Add the flag to the three SendEmailFn action inputs**

`RegisterInput`:

```typescript
export interface RegisterInput {
  action: "register";
  sequenceId: string;
  subscriber: Subscriber;
  executionArn: string;
  transactional?: boolean; // when true, register even if unsubscribed (still blocked if suppressed)
}
```

`SendInput`:

```typescript
export interface SendInput {
  action: "send";
  templateKey?: string;
  subject?: string;
  variants?: SendVariant[];
  sequenceId?: string;
  subscriber: Subscriber;
  sender?: SenderConfig;
  transactional?: boolean; // when true, send even if unsubscribed and omit List-Unsubscribe headers
}
```

`FireAndForgetInput`:

```typescript
export interface FireAndForgetInput {
  action: "fire_and_forget";
  templateKey: string;
  subject: string;
  subscriber: Subscriber;
  sender?: SenderConfig;
  sequenceId?: string; // override "fire_and_forget" default, e.g. broadcastId
  transactional?: boolean; // when true, send even if unsubscribed (sequence `events` inherit this; broadcasts never set it)
}
```

- [ ] **Step 2: Add the flag to `ActiveExecution`** (so the stopper can tell which executions to protect)

```typescript
export interface ActiveExecution {
  PK: string;
  SK: string; // EXEC#<sequenceId>
  executionArn: string;
  sequenceId: string;
  startedAt: string;
  transactional?: boolean; // persisted at putExecution; absent on pre-existing rows = treated as marketing
}
```

- [ ] **Step 3: Add the flag to `SequenceDefinition`** (after `sender`)

```typescript
export interface SequenceDefinition {
  id: string;
  sender: SenderConfig;
  transactional?: boolean; // default false. When true, all sends + event emails bypass the unsubscribed guard (not suppression) and omit List-Unsubscribe
  trigger: SequenceTrigger;
  timeoutMinutes: number;
  steps: SequenceStep[];
  events?: EventEmail[]; // fire-and-forget emails triggered by events — inherit `transactional`
  exitOn?: ExitEvent[]; // exit subscriber from this sequence on these events
}
```

Do **not** add `transactional` to `SendStep` — sequence-level only.

- [ ] **Step 4: Build shared and typecheck the workspace**

Run: `pnpm --filter @mailshot/shared build && pnpm -r typecheck`
Expected: PASS. All fields are optional, so no consumer breaks.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add transactional flag to sequence, send, and execution types"
```

---

## Task 2: Persist `transactional` on the execution row

`stopAllExecutions` reads `ActiveExecution` rows via `getAllExecutions`, so the flag must be written by `putExecution`.

**Files:**

- Modify: `packages/handlers/src/lib/dynamo-client.ts:165-205` (`putExecution`)
- Test: `packages/handlers/src/lib/__tests__/dynamo-client.test.ts:199-228` (`putExecution` describe block)

- [ ] **Step 1: Update the existing test and add a transactional assertion**

In `dynamo-client.test.ts`, the existing test calls `putExecution` with 4 args. Update that call to pass `false` and assert the field is stored, then add a second test for `true`. Replace the `describe("putExecution", ...)` block (lines 199-228) with:

```typescript
describe("putExecution", () => {
  it("transactionally writes subscriber-side and sequence-side rows", async () => {
    mockSend.mockResolvedValueOnce({});

    await putExecution(
      "TestTable",
      "user@example.com",
      "onboarding",
      "arn:aws:states:us-east-1:123:execution:abc",
      false,
    );

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._type).toBe("TransactWriteItems");
    expect(cmd.input.TransactItems).toHaveLength(2);

    const subItem = unmarshall(cmd.input.TransactItems[0].Put.Item);
    expect(subItem.PK).toBe("SUB#user@example.com");
    expect(subItem.SK).toBe("EXEC#onboarding");
    expect(subItem.executionArn).toBe("arn:aws:states:us-east-1:123:execution:abc");
    expect(subItem.sequenceId).toBe("onboarding");
    expect(subItem.startedAt).toBeTruthy();
    expect(subItem.transactional).toBe(false);

    const seqItem = unmarshall(cmd.input.TransactItems[1].Put.Item);
    expect(seqItem.PK).toBe("EXEC#onboarding");
    expect(seqItem.SK).toBe("SUB#user@example.com");
    expect(seqItem.email).toBe("user@example.com");
    expect(seqItem.executionArn).toBe("arn:aws:states:us-east-1:123:execution:abc");
    expect(seqItem.startedAt).toBe(subItem.startedAt);
  });

  it("stores transactional=true on both rows when set", async () => {
    mockSend.mockResolvedValueOnce({});

    await putExecution(
      "TestTable",
      "user@example.com",
      "onboarding",
      "arn:aws:states:us-east-1:123:execution:abc",
      true,
    );

    const cmd = mockSend.mock.calls[0][0];
    const subItem = unmarshall(cmd.input.TransactItems[0].Put.Item);
    const seqItem = unmarshall(cmd.input.TransactItems[1].Put.Item);
    expect(subItem.transactional).toBe(true);
    expect(seqItem.transactional).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @mailshot/handlers test -- dynamo-client --run -t "putExecution"`
Expected: FAIL — `transactional` is `undefined`, and the 5-arg call is a type error / ignored.

- [ ] **Step 3: Add the `transactional` parameter and store it on both rows**

In `packages/handlers/src/lib/dynamo-client.ts`, change `putExecution` (lines 165-205) to accept `transactional` and include it in both marshalled items:

```typescript
export async function putExecution(
  tableName: string,
  email: string,
  sequenceId: string,
  executionArn: string,
  transactional: boolean,
): Promise<void> {
  logger.info("Storing execution", { email, sequenceId, executionArn, transactional });
  const startedAt = new Date().toISOString();
  await dynamo.send(
    new TransactWriteItemsCommand({
      TransactItems: [
        // Subscriber-side row: "what sequences is alice in?"
        {
          Put: {
            TableName: tableName,
            Item: marshall({
              PK: subscriberPK(email),
              SK: executionSK(sequenceId),
              executionArn,
              sequenceId,
              startedAt,
              transactional,
            }),
          },
        },
        // Inverted sequence-side row: "who is in sequence onboarding?"
        {
          Put: {
            TableName: tableName,
            Item: marshall({
              PK: executionSK(sequenceId),
              SK: subscriberPK(email),
              email,
              executionArn,
              startedAt,
              transactional,
            }),
          },
        },
      ],
    }),
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @mailshot/handlers test -- dynamo-client --run -t "putExecution"`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add packages/handlers/src/lib/dynamo-client.ts packages/handlers/src/lib/__tests__/dynamo-client.test.ts
git commit -m "feat: persist transactional flag on execution rows"
```

---

## Task 3: Register guard respects `transactional` and forwards it to `putExecution`

**Files:**

- Modify: `packages/handlers/src/handlers/send-email.ts:91-99` (unsubscribed guard) and `:132-137` (`putExecution` call)
- Test: `packages/handlers/src/handlers/__tests__/send-email.test.ts` — `register action` describe block (after `:154`); also update the existing `putExecution` assertion at `:130-135`

- [ ] **Step 1: Update the existing `putExecution` assertion and add transactional register tests**

In `send-email.test.ts`, the existing `"upserts profile and stores execution"` test (lines 119-136) asserts `putExecution` was called with 4 args. The handler will now pass a 5th (`transactional`). Update that assertion (lines 130-135) to:

```typescript
expect(mockPutExecution).toHaveBeenCalledWith(
  "TestTable",
  "user@example.com",
  "onboarding",
  registerEvent.executionArn,
  false,
);
```

Then add these tests after the existing `"throws when subscriber is suppressed"` test (after line 154):

```typescript
it("registers an unsubscribed subscriber when transactional", async () => {
  mockGetSubscriberProfile.mockResolvedValueOnce({ unsubscribed: true, suppressed: false });
  mockGetExecution.mockResolvedValueOnce(null);

  const result = await handler({ ...registerEvent, transactional: true });

  expect(result).toEqual({ registered: true });
  expect(mockPutExecution).toHaveBeenCalledWith(
    "TestTable",
    "user@example.com",
    "onboarding",
    registerEvent.executionArn,
    true,
  );
});

it("still throws for a suppressed subscriber even when transactional", async () => {
  mockGetSubscriberProfile.mockResolvedValueOnce({ unsubscribed: false, suppressed: true });

  await expect(handler({ ...registerEvent, transactional: true })).rejects.toThrow(
    "Cannot register sequence for suppressed subscriber",
  );
  expect(mockPutExecution).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the register tests to verify they fail**

Run: `pnpm --filter @mailshot/handlers test -- send-email --run -t "register action"`
Expected: FAIL — the existing assertion now expects 5 args (handler still passes 4), and the new transactional test throws.

- [ ] **Step 3: Make the unsubscribed register guard conditional and forward the flag**

In `send-email.ts`, change the `unsubscribed` guard in `handleRegister` (lines 91-99). Leave the `suppressed` guard (lines 100-108) unchanged.

```typescript
if (profile?.unsubscribed && !event.transactional) {
  logger.info("Skipping registration - subscriber unsubscribed", {
    email: event.subscriber.email,
    sequenceId: event.sequenceId,
  });
  throw new Error(
    `Cannot register sequence for unsubscribed subscriber: ${event.subscriber.email}`,
  );
}
```

Then change the `putExecution` call (lines 132-137) to pass the flag:

```typescript
await putExecution(
  config.tableName,
  event.subscriber.email,
  event.sequenceId,
  event.executionArn,
  event.transactional ?? false,
);
```

- [ ] **Step 4: Run the register tests to verify they pass**

Run: `pnpm --filter @mailshot/handlers test -- send-email --run -t "register action"`
Expected: PASS — including the existing `"throws when subscriber is unsubscribed"` (no `transactional`, so still throws) and both new tests.

- [ ] **Step 5: Commit**

```bash
git add packages/handlers/src/handlers/send-email.ts packages/handlers/src/handlers/__tests__/send-email.test.ts
git commit -m "feat: transactional sequences register unsubscribed subscribers and tag the execution row"
```

---

## Task 4: Pre-send check, List-Unsubscribe suppression, and fire-and-forget passthrough

**Files:**

- Modify: `packages/handlers/src/handlers/send-email.ts:176-179` (pre-send unsubscribed check), `:224` (`listUnsubscribe` arg), `:56-66` (`fire_and_forget` → internal `send` mapping)
- Test: `packages/handlers/src/handlers/__tests__/send-email.test.ts` — `send action` block (after `:281`) and `fire_and_forget action` block (after `:300`)

- [ ] **Step 1: Write the failing tests**

In `send-email.test.ts`, inside `describe("send action", ...)`, add after line 281:

```typescript
it("sends to an unsubscribed subscriber when transactional", async () => {
  mockGetSubscriberProfile.mockResolvedValueOnce({
    email: "user@example.com",
    firstName: "Jane",
    unsubscribed: true,
    suppressed: false,
  });

  const result = await handler({ ...sendEvent, transactional: true });

  expect(result).toEqual({ sent: true, messageId: "msg-123" });
  expect(mockSendEmail).toHaveBeenCalled();
});

it("still skips a suppressed subscriber even when transactional", async () => {
  mockGetSubscriberProfile.mockResolvedValueOnce({
    email: "user@example.com",
    firstName: "Jane",
    unsubscribed: false,
    suppressed: true,
  });

  const result = await handler({ ...sendEvent, transactional: true });

  expect(result).toEqual({ sent: false, reason: "suppressed" });
  expect(mockSendEmail).not.toHaveBeenCalled();
});

it("omits List-Unsubscribe headers on a transactional send", async () => {
  mockGetSubscriberProfile.mockResolvedValueOnce(null);

  await handler({ ...sendEvent, transactional: true });

  const sendCall = mockSendEmail.mock.calls[0][0];
  expect(sendCall.listUnsubscribe).toBe(false);
});
```

Inside `describe("fire_and_forget action", ...)`, add after line 299:

```typescript
it("forwards transactional to the send when set (sequence events)", async () => {
  mockGetSubscriberProfile.mockResolvedValueOnce({
    email: "user@example.com",
    firstName: "Jane",
    unsubscribed: true,
    suppressed: false,
  });

  const result = await handler({
    action: "fire_and_forget",
    templateKey: "onboarding/first-sale",
    subject: "Congrats!",
    subscriber: { email: "user@example.com", firstName: "Jane" },
    sender: TEST_SENDER,
    sequenceId: "onboarding",
    transactional: true,
  });

  expect(result).toEqual({ sent: true, messageId: "msg-123" });
  const sendCall = mockSendEmail.mock.calls[0][0];
  expect(sendCall.listUnsubscribe).toBe(false);
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `pnpm --filter @mailshot/handlers test -- send-email --run -t "transactional"`
Expected: FAIL — the unsubscribed send returns `{ sent: false, reason: "unsubscribed" }`, `listUnsubscribe` is `undefined`, and the fire-and-forget case is skipped because the internal mapping drops `transactional`.

- [ ] **Step 3: Make the pre-send unsubscribed check conditional**

In `send-email.ts`, change the `unsubscribed` pre-send check in `handleSend` (lines 176-179). Leave the `suppressed` check (lines 180-183) unchanged.

```typescript
if (profile?.unsubscribed && !event.transactional) {
  logger.info("Skipping send - subscriber unsubscribed", { email: event.subscriber.email });
  return { sent: false, reason: "unsubscribed" };
}
```

- [ ] **Step 4: Force `listUnsubscribe: false` on transactional sends**

Change the `listUnsubscribe` argument to `sendEmail` (line 224):

```typescript
    listUnsubscribe: event.transactional ? false : sender.listUnsubscribe,
```

(No change needed in `ses-sender.ts` — `ses-sender.ts:40` already omits both `List-Unsubscribe` headers when this is `false`.)

- [ ] **Step 5: Forward `transactional` through the fire-and-forget mapping**

Change the `fire_and_forget` branch (lines 56-66) so the internal `send` payload carries the flag:

```typescript
await upsertSubscriberProfile(config.tableName, event.subscriber);
return handleSend(
  {
    action: "send",
    templateKey: event.templateKey,
    subject: event.subject,
    subscriber: event.subscriber,
    sender: event.sender,
    transactional: event.transactional,
  },
  config,
  event.sequenceId ?? "fire_and_forget",
);
```

- [ ] **Step 6: Run the full send-email test file**

Run: `pnpm --filter @mailshot/handlers test -- send-email --run`
Expected: PASS — all existing tests plus the four new ones. The existing `"skips send when subscriber is unsubscribed"` (no `transactional`) still skips.

- [ ] **Step 7: Commit**

```bash
git add packages/handlers/src/handlers/send-email.ts packages/handlers/src/handlers/__tests__/send-email.test.ts
git commit -m "feat: transactional sends and event emails bypass unsubscribed and omit List-Unsubscribe"
```

---

## Task 5: `stopAllExecutions` can skip transactional executions

**Files:**

- Modify: `packages/handlers/src/lib/execution-stopper.ts:44-76` (`stopAllExecutions`)
- Test: `packages/handlers/src/lib/__tests__/execution-stopper.test.ts` (the `stopAllExecutions` describe block)

- [ ] **Step 1: Update existing calls in tests and add skip-transactional tests**

In `execution-stopper.test.ts`, the three existing tests call `stopAllExecutions("TestTable", "user@example.com")`. Update each of those calls to pass the new `skipTransactional` argument as `false` (lines 40, 51, 64):

```typescript
await stopAllExecutions("TestTable", "user@example.com", false);
```

Then add two tests at the end of the `describe("stopAllExecutions", ...)` block (before the closing `});` at line 68):

```typescript
it("skips transactional executions when skipTransactional is true", async () => {
  mockGetAllExecutions.mockResolvedValueOnce([
    { executionArn: "arn:1", sequenceId: "onboarding", transactional: true },
    { executionArn: "arn:2", sequenceId: "win-back", transactional: false },
  ]);
  mockSfnSend.mockResolvedValue({});
  mockDeleteExecution.mockResolvedValue(undefined);

  await stopAllExecutions("TestTable", "user@example.com", true);

  // Only the non-transactional execution is stopped and deleted
  expect(mockSfnSend).toHaveBeenCalledTimes(1);
  expect(mockDeleteExecution).toHaveBeenCalledTimes(1);
  expect(mockDeleteExecution).toHaveBeenCalledWith("TestTable", "user@example.com", "win-back");
});

it("stops transactional executions when skipTransactional is false", async () => {
  mockGetAllExecutions.mockResolvedValueOnce([
    { executionArn: "arn:1", sequenceId: "onboarding", transactional: true },
  ]);
  mockSfnSend.mockResolvedValue({});
  mockDeleteExecution.mockResolvedValue(undefined);

  await stopAllExecutions("TestTable", "user@example.com", false);

  expect(mockSfnSend).toHaveBeenCalledTimes(1);
  expect(mockDeleteExecution).toHaveBeenCalledWith("TestTable", "user@example.com", "onboarding");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @mailshot/handlers test -- execution-stopper --run`
Expected: FAIL — `stopAllExecutions` ignores the new arg and stops the transactional execution.

- [ ] **Step 3: Add the `skipTransactional` parameter and filter**

In `execution-stopper.ts`, change `stopAllExecutions` (lines 44-76):

```typescript
export async function stopAllExecutions(
  tableName: string,
  email: string,
  skipTransactional: boolean,
): Promise<void> {
  const all = await getAllExecutions(tableName, email);
  const executions = skipTransactional ? all.filter((e) => !e.transactional) : all;
  logger.info("Stopping executions for subscriber", {
    email,
    skipTransactional,
    candidateCount: all.length,
    stoppingCount: executions.length,
  });

  await Promise.all(
    executions.map(async (exec) => {
      try {
        await sfn.send(
          new StopExecutionCommand({
            executionArn: exec.executionArn,
            cause: "Subscriber unsubscribed or suppressed",
          }),
        );
        logger.info("Stopped execution", {
          email,
          sequenceId: exec.sequenceId,
          executionArn: exec.executionArn,
        });
      } catch (err) {
        logger.warn("Failed to stop execution (may already be stopped)", {
          email,
          sequenceId: exec.sequenceId,
          executionArn: exec.executionArn,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await deleteExecution(tableName, email, exec.sequenceId);
    }),
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @mailshot/handlers test -- execution-stopper --run`
Expected: PASS (all five tests).

- [ ] **Step 5: Commit**

```bash
git add packages/handlers/src/lib/execution-stopper.ts packages/handlers/src/lib/__tests__/execution-stopper.test.ts
git commit -m "feat: stopAllExecutions can skip transactional executions"
```

---

## Task 6: Unsubscribe stops touching the SES list and protects transactional sequences

**Files:**

- Modify: `packages/handlers/src/handlers/unsubscribe.ts:5-6` (imports), `:56-58` (the three operations)
- Test: `packages/handlers/src/handlers/__tests__/unsubscribe.test.ts:22-28` (mock), `:89-110` (the valid-token test)

- [ ] **Step 1: Update the test for the new behavior**

In `unsubscribe.test.ts`, remove the `addToSuppressionList` mock (it's no longer imported). Delete the `mockAddToSuppressionList` declaration (line 8), the `vi.mock("../../lib/ses-suppression.js", ...)` block (lines 26-28), and the `mockAddToSuppressionList.mockReset()...` line (line 42).

Then change the `"unsubscribes and stops executions for valid token"` test assertions (lines 108-109) to:

```typescript
expect(mockStopAllExecutions).toHaveBeenCalledWith("TestTable", "user@example.com", true);
```

(Delete the old `expect(mockStopAllExecutions).toHaveBeenCalledWith("TestTable", "user@example.com");` line and the `expect(mockAddToSuppressionList)...` line.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mailshot/handlers test -- unsubscribe --run`
Expected: FAIL — handler still calls `stopAllExecutions` with 2 args and still calls `addToSuppressionList`.

- [ ] **Step 3: Update the handler**

In `unsubscribe.ts`, remove the `addToSuppressionList` import (line 6) so the file no longer imports from `ses-suppression.js`. Then change the three operations (lines 56-58) to two:

```typescript
await setProfileFlag(config.tableName, result.email, "unsubscribed");
await stopAllExecutions(config.tableName, result.email, true);
```

The marketing opt-out now only sets the profile flag and stops the subscriber's **non-transactional** executions. It no longer adds the address to the SES account suppression list (that is reserved for genuine bounces/complaints) and no longer cancels in-flight transactional sequences.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mailshot/handlers test -- unsubscribe --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/handlers/src/handlers/unsubscribe.ts packages/handlers/src/handlers/__tests__/unsubscribe.test.ts
git commit -m "feat: unsubscribe no longer suppresses in SES or stops transactional sequences"
```

---

## Task 7: Bounce-handler stops all executions explicitly

The bounce/complaint path must keep stopping **everything** (transactional included) and keep adding to the SES list. It just needs the new explicit `skipTransactional: false` argument.

**Files:**

- Modify: `packages/handlers/src/handlers/bounce-handler.ts:62` and `:84`
- Test: `packages/handlers/src/handlers/__tests__/bounce-handler.test.ts` (existing `stopAllExecutions` assertions)

- [ ] **Step 1: Update the bounce-handler test assertions**

In `bounce-handler.test.ts`, find each assertion of the form `expect(mockStopAllExecutions).toHaveBeenCalledWith("...", "<email>")` and add the `false` argument, e.g.:

```typescript
expect(mockStopAllExecutions).toHaveBeenCalledWith("TestTable", "bounced@example.com", false);
```

Apply to both the bounce test and the complaint test. (If a test only asserts `toHaveBeenCalled()` without args, leave it.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mailshot/handlers test -- bounce-handler --run`
Expected: FAIL — handler still calls `stopAllExecutions` with 2 args.

- [ ] **Step 3: Update the handler**

In `bounce-handler.ts`, change both `stopAllExecutions` calls (lines 62 and 84):

```typescript
await stopAllExecutions(config.tableName, email, false);
```

(Keep the `addToSuppressionList(email, "BOUNCE")` / `addToSuppressionList(email, "COMPLAINT")` calls as-is — hard suppression still uses the SES list.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mailshot/handlers test -- bounce-handler --run`
Expected: PASS.

- [ ] **Step 5: Run the whole handlers suite to confirm no caller of `stopAllExecutions`/`putExecution` was missed**

Run: `pnpm --filter @mailshot/handlers test --run`
Expected: PASS across all handler tests.

- [ ] **Step 6: Commit**

```bash
git add packages/handlers/src/handlers/bounce-handler.ts packages/handlers/src/handlers/__tests__/bounce-handler.test.ts
git commit -m "feat: bounce-handler stops all executions including transactional"
```

---

## Task 8: Bake `transactional` into Step Functions payloads (CDK state machines)

**Files:**

- Modify: `packages/cdk/lib/constructs/state-machines.ts` — register payload (`:67-72`), `buildChain` call (`:80-89`) and signature (`:121-129`) and switch calls (`:138-167`), `buildSendStep` (`:176-200`), `buildConditionStep` signature (`:212-221`) + its two `buildChain` calls (`:237-254`), `buildChoiceStep` signature (`:274-283`) + its two `buildChain` calls (`:288-312`)

> Threading note: `transactional` is added as a `boolean` parameter immediately after the existing `sender` parameter on `buildChain`, `buildSendStep`, `buildConditionStep`, and `buildChoiceStep` — mirroring how `sender` is already threaded. There are no CDK unit tests in this repo; verification is by `tsc` build + a manual read-through.

- [ ] **Step 1: Add `transactional` to the register payload**

In `buildSequence`, change the register task payload (lines 67-72):

```typescript
      payload: sfn.TaskInput.fromObject({
        action: "register",
        sequenceId: def.id,
        transactional: def.transactional ?? false,
        "subscriber.$": "$.subscriber",
        "executionArn.$": "$$.Execution.Id",
      }),
```

- [ ] **Step 2: Pass the sequence flag into `buildChain`**

Change the `buildChain` call in `buildSequence` (lines 81-89) to pass `def.transactional ?? false` after `senderPayload`:

```typescript
const chain = this.buildChain(
  prefix,
  def.steps,
  sendEmailFn,
  checkConditionFn,
  { counter: 0 },
  def.id,
  senderPayload,
  def.transactional ?? false,
);
```

- [ ] **Step 3: Thread the parameter through `buildChain`**

Change the `buildChain` signature (lines 121-129) to add `transactional: boolean` as the last parameter:

```typescript
  private buildChain(
    prefix: string,
    steps: SequenceStep[],
    sendEmailFn: lambda.IFunction,
    checkConditionFn: lambda.IFunction,
    ctx: { counter: number },
    sequenceId: string,
    sender: Omit<SenderConfig, "captureReplies">,
    transactional: boolean,
  ): sfn.Chain | null {
```

Then update the three relevant switch-branch calls inside `buildChain` (lines 138-167) to forward `transactional` as the new last argument:

```typescript
        case "send":
          state = this.buildSendStep(prefix, n, step, sendEmailFn, sequenceId, sender, transactional);
          break;
        case "wait":
          state = this.buildWaitStep(prefix, n, step);
          break;
        case "condition":
          state = this.buildConditionStep(
            prefix,
            n,
            step,
            sendEmailFn,
            checkConditionFn,
            ctx,
            sequenceId,
            sender,
            transactional,
          );
          break;
        case "choice":
          state = this.buildChoiceStep(
            prefix,
            n,
            step,
            sendEmailFn,
            checkConditionFn,
            ctx,
            sequenceId,
            sender,
            transactional,
          );
          break;
```

(`buildWaitStep` is unchanged — wait steps don't send.)

- [ ] **Step 4: Apply the flag in `buildSendStep`**

Change `buildSendStep` signature (lines 176-183) and payload (lines 186-194):

```typescript
  private buildSendStep(
    prefix: string,
    n: number,
    step: SendStep,
    sendEmailFn: lambda.IFunction,
    sequenceId: string,
    sender: Omit<SenderConfig, "captureReplies">,
    transactional: boolean,
  ): tasks.LambdaInvoke {
    const task = new tasks.LambdaInvoke(this, `${prefix}-Send${n}`, {
      lambdaFunction: sendEmailFn,
      payload: sfn.TaskInput.fromObject({
        action: "send",
        ...(step.variants
          ? { variants: step.variants }
          : { templateKey: step.templateKey, subject: step.subject }),
        sequenceId,
        sender,
        transactional,
        "subscriber.$": "$.subscriber",
      }),
      resultPath: "$.sendResult",
      payloadResponseOnly: true,
    });
    task.addRetry(this.retryConfig);
    return task;
  }
```

- [ ] **Step 5: Thread through `buildConditionStep`**

Add `transactional: boolean` as the last parameter of `buildConditionStep` (lines 212-221), and pass `transactional` as the new last argument in both of its `buildChain` calls (the `thenChain` at lines 237-245 and `elseChain` at lines 246-254):

```typescript
const thenChain = this.buildChain(
  prefix,
  step.then,
  sendEmailFn,
  checkConditionFn,
  ctx,
  sequenceId,
  sender,
  transactional,
);
const elseChain = this.buildChain(
  prefix,
  step.else ?? [],
  sendEmailFn,
  checkConditionFn,
  ctx,
  sequenceId,
  sender,
  transactional,
);
```

- [ ] **Step 6: Thread through `buildChoiceStep`**

Add `transactional: boolean` as the last parameter of `buildChoiceStep` (lines 274-283), and pass `transactional` as the new last argument in both of its `buildChain` calls — the branch loop (lines 288-296) and the default branch (lines 304-312):

```typescript
const branchChain = this.buildChain(
  prefix,
  branch.steps,
  sendEmailFn,
  checkConditionFn,
  ctx,
  sequenceId,
  sender,
  transactional,
);
```

```typescript
const defaultChain = this.buildChain(
  prefix,
  step.default,
  sendEmailFn,
  checkConditionFn,
  ctx,
  sequenceId,
  sender,
  transactional,
);
```

- [ ] **Step 7: Build the CDK package**

Run: `pnpm --filter @mailshot/shared build && pnpm --filter @mailshot/cdk build`
Expected: succeeds. A compile error means a `buildChain`/step-builder call site was missed — fix it.

- [ ] **Step 8: Commit**

```bash
git add packages/cdk/lib/constructs/state-machines.ts
git commit -m "feat: bake transactional flag into Step Functions register and send payloads"
```

---

## Task 9: Propagate `transactional` to sequence event emails (CDK event bus)

**Files:**

- Modify: `packages/cdk/lib/constructs/event-bus.ts:92-103` (the `events` rule's `fire_and_forget` target payload)

- [ ] **Step 1: Add `transactional` to the event-email payload**

In the `def.events` loop, change the `RuleTargetInput.fromObject` payload (lines 92-103) to include the sequence flag:

```typescript
                event: events.RuleTargetInput.fromObject({
                  action: "fire_and_forget",
                  templateKey: evt.templateKey,
                  subject: evt.subject,
                  sender: {
                    fromEmail: def.sender.fromEmail,
                    fromName: def.sender.fromName,
                    ...(def.sender.replyToEmail && { replyToEmail: def.sender.replyToEmail }),
                    ...(def.sender.listUnsubscribe === false && { listUnsubscribe: false }),
                  },
                  transactional: def.transactional ?? false,
                  subscriber: evtSubscriber,
                }),
```

(Broadcasts build their own `fire_and_forget` SQS messages in `broadcast.ts` and never set `transactional`, so they remain marketing — no change there.)

- [ ] **Step 2: Build the CDK package**

Run: `pnpm --filter @mailshot/cdk build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/cdk/lib/constructs/event-bus.ts
git commit -m "feat: sequence event emails inherit the transactional flag"
```

---

## Task 10: Document the new behavior in all internal and public docs

This change alters documented behavior of unsubscribe and sender config, so every doc that describes them must be updated.

**Files:**

- Modify: `CLAUDE.md`, `packages/create/template/CLAUDE.md`, `README.md`, `packages/create/template/README.md`, `packages/skills/skills/create-sequence/SKILL.md`, `packages/skills/skills/send-broadcast/SKILL.md`

- [ ] **Step 1: Root `CLAUDE.md` — Per-sequence sender config**

In the "Per-sequence sender config" section, add a bullet after the `listUnsubscribe` bullet:

```markdown
- `transactional` (optional, default: `false`, on `SequenceDefinition` not `sender`) - when `true`, all sends in the sequence — including event-triggered (`events`) fire-and-forget emails — bypass the `unsubscribed` pre-send guard and omit `List-Unsubscribe` headers, so onboarding/receipts reach subscribers who opted out of marketing. The `suppressed` flag (bounces/complaints) is **never** bypassed. The flag is sequence-wide (no per-step override). Baked into the Step Functions `register`/`send`/`fire_and_forget` payloads at deploy time and persisted on the execution row.
```

- [ ] **Step 2: Root `CLAUDE.md` — data-flow unsubscribe/suppression items**

In the "Data flow" list, update the unsubscribe item (currently: "Unsubscribe link → UnsubscribeFn (Lambda Function URL, no auth) → marks unsubscribed, stops executions") to:

```markdown
7. Unsubscribe link → UnsubscribeFn (Lambda Function URL, no auth) → marks `unsubscribed` and stops the subscriber's **non-transactional** executions. It does **not** add the address to the SES suppression list and does **not** cancel in-flight transactional sequences (e.g. onboarding). Marketing opt-out is purely an app-level flag.
```

And update the bounce/complaint item (currently mentions "suppresses subscriber, stops executions") to make explicit it stops **all** executions and adds to the SES suppression list:

```markdown
5. SES bounce/complaint notifications → SNS → BounceHandlerFn → sets `suppressed`, stops **all** executions (transactional included), and adds the address to the SES account suppression list. `suppressed` is never bypassable.
```

- [ ] **Step 3: Scaffolded project `packages/create/template/CLAUDE.md`**

In the sender-config paragraph (line 76), append a sentence after the `listUnsubscribe` description:

```markdown
A sequence may also set `transactional: true` (on the sequence, not `sender`) so its emails reach subscribers who unsubscribed from marketing and omit List-Unsubscribe headers — use only for genuinely transactional sequences (onboarding tied to a purchase, receipts, account/security notices). Bounce/complaint suppression is still always honored.
```

- [ ] **Step 4: `create-sequence/SKILL.md`**

Add a bullet immediately after the `listUnsubscribe` bullet (line 48):

```markdown
- `transactional` (optional, default: `false`, set on the sequence not `sender`) - set to `true` for genuinely transactional sequences (onboarding tied to a purchase, receipts, account/security notices). Transactional sequences (and their `events` emails) send even to subscribers who have unsubscribed from marketing, and omit `List-Unsubscribe` headers. They are still blocked for subscribers suppressed by bounces/complaints. Do NOT mark marketing or nurture sequences transactional — abusing this gets your domain blocklisted.
```

Also extend the existing guidance line (line 50) so the assistant asks about it:

```markdown
Ask the user what type of sequence this is (e.g., transactional, marketing, cold outreach). For genuinely transactional sequences (onboarding tied to a purchase, receipts, account/security notices), set `transactional: true`. If cold outreach or the user wants a managed inbox for reply tracking, set `captureReplies: true` and confirm the SES inbound email address. For cold outreach, also set `listUnsubscribe: false` to avoid bulk mail filtering.
```

- [ ] **Step 5: `send-broadcast/SKILL.md`**

Clarify that broadcasts are always marketing. Change the pre-send-checks note (line 124) to:

```markdown
- Broadcasts reuse the existing SendEmailFn — all pre-send checks apply (unsubscribed/suppressed subscribers are automatically skipped). Broadcasts are always treated as marketing; there is no transactional override for broadcasts.
```

- [ ] **Step 6: `README.md` and `packages/create/template/README.md`**

In `README.md`, find the sequences/feature description and add a brief mention that sequences can be marked transactional. If there is a features or sequence-config bullet list, add:

```markdown
- **Transactional sequences** — mark a sequence `transactional: true` so onboarding/receipts reach subscribers who opted out of marketing (bounce/complaint suppression still applies).
```

Apply the same one-line addition to `packages/create/template/README.md` if it has an equivalent feature/sequence list. If neither README has a natural list to extend, skip — the authoritative docs are CLAUDE.md and the skills.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md packages/create/template/CLAUDE.md README.md packages/create/template/README.md packages/skills/skills/create-sequence/SKILL.md packages/skills/skills/send-broadcast/SKILL.md
git commit -m "docs: document transactional sequence flag and revised unsubscribe behavior"
```

---

## Task 11: Changeset

**Files:**

- Create: `.changeset/transactional-email-flag.md`

- [ ] **Step 1: Write the changeset**

```markdown
---
"@mailshot/shared": minor
"@mailshot/handlers": minor
"@mailshot/cdk": minor
---

Add a `transactional` flag to sequences. Transactional sequences (and their event emails) reach subscribers who have unsubscribed from marketing and omit List-Unsubscribe headers, while still respecting bounce/complaint suppression. Unsubscribe is now a pure marketing opt-out: it no longer adds addresses to the SES suppression list (reserved for bounces/complaints) and no longer cancels in-flight transactional sequences.
```

- [ ] **Step 2: Commit**

```bash
git add .changeset/transactional-email-flag.md
git commit -m "chore: add changeset for transactional email flag"
```

---

## Final verification (whole feature)

- [ ] **Run the complete suite from a clean state**

Run: `pnpm -r build && pnpm -r test && pnpm -r typecheck && pnpm lint`
Expected: all PASS.

- [ ] **Trace the data path by reading (no AWS deploy needed):**
  1. Sequence with `transactional: true` → `state-machines.ts` register payload carries `transactional: true`; every `buildSendStep` payload carries `transactional: true`; `event-bus.ts` `events` rule carries `transactional: true`.
  2. `dynamo-client.ts` `putExecution` writes `transactional: true` on both execution rows.
  3. `send-email.ts` `handleRegister`: unsubscribed + transactional → registers (and `putExecution` gets `true`); suppressed + transactional → still throws.
  4. `send-email.ts` `handleSend`: unsubscribed + transactional → sends; suppressed + transactional → `{ sent: false, reason: "suppressed" }`; `listUnsubscribe` arg is `false`.
  5. `unsubscribe.ts`: sets `unsubscribed`, calls `stopAllExecutions(..., true)` (skips transactional), no SES suppression.
  6. `bounce-handler.ts`: sets `suppressed`, calls `stopAllExecutions(..., false)` (stops all), adds to SES list.
  7. A sequence **without** the flag, and any execution row written before this change → `transactional` absent/false → behaviour identical to today; broadcasts unaffected.

## Out of scope (deferred to v2)

- Per-topic / per-category preferences and a preference center (`unsubscribedCategories[]`).
- Encoding a category/topic in the unsubscribe HMAC token (`unsubscribe-token.ts` unchanged).
- Transactional broadcasts (`BroadcastInput` unchanged).
- Cleanup of subscribers who unsubscribed _before_ this ships and remain on the SES suppression list.
- Per-send-step `transactional` override.
- A `validate-sequence` guardrail warning when a `transactional` sequence looks like marketing.

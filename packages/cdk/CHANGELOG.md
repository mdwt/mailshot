# @mailshot/cdk

## 1.7.0

### Patch Changes

- Updated dependencies [[`469a296`](https://github.com/mdwt/mailshot/commit/469a2969581ab3a4c2455e9c8d32a104d34817b4)]:
  - @mailshot/handlers@1.7.0
  - @mailshot/shared@1.7.0

## 1.6.0

### Minor Changes

- [#6](https://github.com/mdwt/mailshot/pull/6) [`ab62305`](https://github.com/mdwt/mailshot/commit/ab62305303faa30847d9210749ab78953060f5c8) Thanks [@mdwt](https://github.com/mdwt)! - Add broadcast email support with tag-based subscriber filtering and SQS fan-out

- [`53115a3`](https://github.com/mdwt/mailshot/commit/53115a3bd4a905c097923873261006e390978f14) Thanks [@mdwt](https://github.com/mdwt)! - Rename `BroadcastRecord.subscriberCount` to `audienceSize` and add live engagement counters (`deliveryCount`, `openCount`, `clickCount`, `bounceCount`, `complaintCount`) maintained on a separate `STATS#<sequenceId>/COUNTERS` item by `EngagementHandlerFn`. Counters are merged into `get_broadcast` and `list_broadcasts` responses automatically. The same item also accumulates lifetime stats for sequences as a side benefit.

### Patch Changes

- Updated dependencies [[`ab62305`](https://github.com/mdwt/mailshot/commit/ab62305303faa30847d9210749ab78953060f5c8), [`53115a3`](https://github.com/mdwt/mailshot/commit/53115a3bd4a905c097923873261006e390978f14)]:
  - @mailshot/shared@1.6.0
  - @mailshot/handlers@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies []:
  - @mailshot/handlers@1.5.1

## 1.5.0

### Minor Changes

- Add A/B testing via variants on send steps and remove text/plain MIME part

### Patch Changes

- Updated dependencies []:
  - @mailshot/shared@1.5.0
  - @mailshot/handlers@1.5.0

## 1.4.0

### Minor Changes

- Add reply forwarding via `forwardRepliesTo` sender config option

### Patch Changes

- Updated dependencies []:
  - @mailshot/shared@1.4.0
  - @mailshot/handlers@1.4.0

## 1.3.0

### Minor Changes

- [`7514d53`](https://github.com/mdwt/mailshot/commit/7514d53ffe2e710bc0a124ac337102e076ac3a41) Thanks [@mdwt](https://github.com/mdwt)! - Add inbound reply tracking as an engagement event type

### Patch Changes

- Updated dependencies [[`7514d53`](https://github.com/mdwt/mailshot/commit/7514d53ffe2e710bc0a124ac337102e076ac3a41)]:
  - @mailshot/shared@1.3.0
  - @mailshot/handlers@1.3.0

## 1.2.1

### Patch Changes

- [`97bb69f`](https://github.com/mdwt/mailshot/commit/97bb69ffb17ba9883ee375a5f6b0cfa864cac1e9) Thanks [@mdwt](https://github.com/mdwt)! - Fix state machine name collisions by prefixing with stackName

## 1.2.0

### Minor Changes

- [#4](https://github.com/mdwt/mailshot/pull/4) [`b85c746`](https://github.com/mdwt/mailshot/commit/b85c746ad65474200d351e06ada3368b6df5f220) Thanks [@mdwt](https://github.com/mdwt)! - Add sequence exit events to remove subscribers from sequences on specific EventBridge events

### Patch Changes

- Updated dependencies [[`b85c746`](https://github.com/mdwt/mailshot/commit/b85c746ad65474200d351e06ada3368b6df5f220)]:
  - @mailshot/shared@1.2.0
  - @mailshot/handlers@1.2.0

## 1.0.3

### Patch Changes

- [`65a90d2`](https://github.com/mdwt/mailshot/commit/65a90d2a38dab4e76cebe466c54d7e453b20a37a) Thanks [@mdwt](https://github.com/mdwt)! - Remove SSM parameter dependency and fix post-setup guidance to show correct workflow

- Updated dependencies [[`65a90d2`](https://github.com/mdwt/mailshot/commit/65a90d2a38dab4e76cebe466c54d7e453b20a37a)]:
  - @mailshot/shared@1.0.3
  - @mailshot/handlers@1.0.3

## 1.0.1

### Patch Changes

- Fix circular dependency in CDK deploy caused by UnsubscribeFn referencing its own Function URL

- Updated dependencies []:
  - @mailshot/handlers@1.0.1

## 1.0.0

### Major Changes

- Remove SSM Parameter Store in favour of Lambda environment variables for all runtime config

### Patch Changes

- Updated dependencies []:
  - @mailshot/shared@1.0.0
  - @mailshot/handlers@1.0.0

## 0.3.0

### Patch Changes

- Updated dependencies [[`19b6f05`](https://github.com/mdwt/mailshot/commit/19b6f05b176871d05d40bc21417dbcc30b96e9d9)]:
  - @mailshot/handlers@0.3.0

## 0.2.3

### Patch Changes

- Rename project to mailshot and bundle Claude Code skills in scaffolded projects

- Updated dependencies []:
  - @mailshot/shared@0.2.3
  - @mailshot/handlers@0.2.3

## 0.2.0

### Minor Changes

- [`72d23af`](https://github.com/mdwt/mailshot/commit/72d23af8e07ab379c794d2918990f7a517a5fc85) Thanks [@mdwt](https://github.com/mdwt)! - Publish framework packages to npm and add create-mailshot CLI

### Patch Changes

- Updated dependencies [[`72d23af`](https://github.com/mdwt/mailshot/commit/72d23af8e07ab379c794d2918990f7a517a5fc85)]:
  - @mailshot/shared@0.2.0
  - @mailshot/handlers@0.2.0

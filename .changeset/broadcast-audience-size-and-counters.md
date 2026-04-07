---
"@mailshot/handlers": minor
"@mailshot/shared": minor
"@mailshot/cdk": minor
"@mailshot/mcp": minor
---

Rename `BroadcastRecord.subscriberCount` to `audienceSize` and add live engagement counters (`deliveryCount`, `openCount`, `clickCount`, `bounceCount`, `complaintCount`) maintained on a separate `STATS#<sequenceId>/COUNTERS` item by `EngagementHandlerFn`. Counters are merged into `get_broadcast` and `list_broadcasts` responses automatically. The same item also accumulates lifetime stats for sequences as a side benefit.

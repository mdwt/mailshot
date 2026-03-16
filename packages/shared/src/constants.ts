export const PROFILE_SK = "PROFILE" as const;
export const EXEC_SK_PREFIX = "EXEC#" as const;
export const SENT_SK_PREFIX = "SENT#" as const;
export const SUPPRESSION_SK = "SUPPRESSION" as const;

export const subscriberPK = (email: string): string => `SUB#${email}`;
export const executionSK = (sequenceId: string): string =>
  `${EXEC_SK_PREFIX}${sequenceId}`;
export const sentSK = (isoTimestamp: string): string =>
  `${SENT_SK_PREFIX}${isoTimestamp}`;

export const SEND_LOG_TTL_DAYS = 90;

export const DEFAULT_RATE_LIMIT_COUNT = 2;
export const DEFAULT_RATE_LIMIT_WINDOW_HOURS = 12;

export const TEMPLATE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Events table ───────────────────────────────────────────────────────────

export const EVT_SK_PREFIX = "EVT#" as const;
export const TEMPLATE_INDEX = "TemplateIndex" as const;

export const eventSK = (isoTimestamp: string, eventType: string): string =>
  `${EVT_SK_PREFIX}${isoTimestamp}#${eventType}`;

export const EVENT_TTL_DAYS = 365;

export const PROFILE_SK = "PROFILE" as const;
export const EXEC_SK_PREFIX = "EXEC#" as const;
export const SENT_SK_PREFIX = "SENT#" as const;
export const SUPPRESSION_SK = "SUPPRESSION" as const;

export const subscriberPK = (email: string): string => `SUB#${email}`;
export const executionSK = (sequenceId: string): string => `${EXEC_SK_PREFIX}${sequenceId}`;
export const sentSK = (isoTimestamp: string): string => `${SENT_SK_PREFIX}${isoTimestamp}`;

export const TEMPLATE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Tags (inverted index) ─────────────────────────────────────────────────

export const TAG_PK_PREFIX = "TAG#" as const;
export const tagPK = (tag: string): string => `${TAG_PK_PREFIX}${tag}`;

// ── Broadcasts ────────────────────────────────────────────────────────────

export const BCAST_PK_PREFIX = "BCAST#" as const;
export const BCAST_META_SK = "META" as const;
export const broadcastPK = (broadcastId: string): string => `${BCAST_PK_PREFIX}${broadcastId}`;

// ── Events table ───────────────────────────────────────────────────────────

export const EVT_SK_PREFIX = "EVT#" as const;
export const TEMPLATE_INDEX = "TemplateIndex" as const;
export const SEQUENCE_INDEX = "SequenceIndex" as const;

export const eventSK = (isoTimestamp: string, eventType: string): string =>
  `${EVT_SK_PREFIX}${isoTimestamp}#${eventType}`;

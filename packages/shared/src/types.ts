// ── Subscriber ──────────────────────────────────────────────────────────────

export interface Subscriber {
  email: string;
  firstName: string;
  attributes?: Record<string, unknown>;
}

export interface SubscriberProfile {
  PK: string;
  SK: "PROFILE";
  email: string;
  firstName: string;
  unsubscribed: boolean;
  suppressed: boolean;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── Active execution ────────────────────────────────────────────────────────

export interface ActiveExecution {
  PK: string;
  SK: string; // EXEC#<sequenceId>
  executionArn: string;
  sequenceId: string;
  startedAt: string;
}

// ── Send log ────────────────────────────────────────────────────────────────

export interface SendLog {
  PK: string;
  SK: string; // SENT#<ISO timestamp>
  templateKey: string;
  sequenceId: string;
  subject: string;
  sesMessageId: string;
  ttl: number;
}

// ── Suppression record ──────────────────────────────────────────────────────

export interface SuppressionRecord {
  PK: string;
  SK: "SUPPRESSION";
  reason: "bounce" | "complaint";
  bounceType?: string;
  sesNotificationId: string;
  recordedAt: string;
}

// ── SendEmailFn action inputs ───────────────────────────────────────────────

export interface RegisterInput {
  action: "register";
  sequenceId: string;
  subscriber: Subscriber;
  executionArn: string;
}

export interface SendInput {
  action: "send";
  templateKey: string;
  subject: string;
  subscriber: Subscriber;
}

export interface FireAndForgetInput {
  action: "fire_and_forget";
  templateKey: string;
  subject: string;
  subscriber: Subscriber;
}

export interface CompleteInput {
  action: "complete";
  sequenceId: string;
  subscriber: Pick<Subscriber, "email">;
  executionArn: string;
}

export type SendEmailInput =
  | RegisterInput
  | SendInput
  | FireAndForgetInput
  | CompleteInput;

// ── SendEmailFn outputs ─────────────────────────────────────────────────────

export interface RegisterOutput {
  registered: true;
}

export interface SendSuccessOutput {
  sent: true;
  messageId: string;
}

export interface SendSkippedOutput {
  sent: false;
  reason: "unsubscribed" | "suppressed" | "rate_limited";
}

export type SendOutput = SendSuccessOutput | SendSkippedOutput;

// ── CheckConditionFn ────────────────────────────────────────────────────────

export interface CheckConditionInput {
  check: "subscriber_field_exists" | "subscriber_field_equals" | "has_been_sent";
  field?: string;
  value?: string;
  templateKey?: string;
  subscriber: Pick<Subscriber, "email">;
}

export interface CheckConditionOutput {
  result: boolean;
}

// ── Unsubscribe token ───────────────────────────────────────────────────────

export interface UnsubscribeTokenPayload {
  email: string;
  sendTimestamp: string;
  expiryTimestamp: string;
}

// ── SSM parameter paths ─────────────────────────────────────────────────────

export interface SsmParameterPaths {
  tableName: string;
  templateBucket: string;
  defaultFromEmail: string;
  defaultFromName: string;
  sesConfigSet: string;
  unsubscribeBaseUrl: string;
  unsubscribeSecret: string;
  rateLimitCount: string;
  rateLimitWindowHours: string;
}

// ── Email event (engagement tracking) ────────────────────────────────────────

export type EmailEventType =
  | "delivery"
  | "open"
  | "click"
  | "bounce"
  | "complaint";

export interface EmailEvent {
  PK: string; // SUB#<email>
  SK: string; // EVT#<ISO timestamp>#<eventType>
  eventType: EmailEventType;
  templateKey: string;
  sequenceId: string;
  subject: string;
  linkUrl?: string;
  userAgent?: string;
  sesMessageId: string;
  timestamp: string;
  ttl: number;
}

// ── CDK context config ──────────────────────────────────────────────────────

export interface StepFuncEmailerConfig {
  account: string;
  region: string;
  stackName: string;
  tableName: string;
  eventsTableName: string;
  templateBucketName: string;
  eventBusName: string;
  eventSource: string;
  sesConfigSetName: string;
  snsTopicName: string;
  defaultFromEmail: string;
  defaultFromName: string;
  unsubscribeSecret: string;
  rateLimitCount: number;
  rateLimitWindowHours: number;
  ssmPrefix: string;
}

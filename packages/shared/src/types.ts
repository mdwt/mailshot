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

// ── Sequence config types ────────────────────────────────────────────────

export interface SubscriberMapping {
  email: string; // JSONPath e.g. "$.detail.email"
  firstName: string; // JSONPath e.g. "$.detail.firstName"
  attributes?: string; // JSONPath e.g. "$.detail" (entire detail object)
}

export interface SequenceTrigger {
  detailType: string; // EventBridge detail-type to match
  subscriberMapping: SubscriberMapping; // How to extract subscriber from event
}

// Step types
export interface SendStep {
  type: "send";
  templateKey: string; // S3 path e.g. "onboarding/welcome"
  subject: string;
}

export interface WaitStep {
  type: "wait";
  days?: number;
  hours?: number;
  minutes?: number; // useful for testing
}

export interface ConditionStep {
  type: "condition";
  check: "subscriber_field_exists" | "subscriber_field_equals" | "has_been_sent";
  field?: string; // for subscriber_field_exists / subscriber_field_equals
  value?: string; // for subscriber_field_equals
  templateKey?: string; // for has_been_sent
  then: SequenceStep[]; // branch when condition is true
  else?: SequenceStep[]; // branch when condition is false (optional)
}

export type SequenceStep = SendStep | WaitStep | ConditionStep;

export interface FireAndForgetConfig {
  templateKey: string;
  subject: string;
}

// A sequence definition is EITHER multi-step OR fire-and-forget
export interface SequenceDefinitionBase {
  id: string;
  trigger: SequenceTrigger;
}

export interface MultiStepSequence extends SequenceDefinitionBase {
  timeoutDays?: number; // default 30
  steps: SequenceStep[];
  fireAndForget?: never;
}

export interface FireAndForgetSequence extends SequenceDefinitionBase {
  fireAndForget: FireAndForgetConfig;
  steps?: never;
  timeoutDays?: never;
}

export type SequenceDefinition = MultiStepSequence | FireAndForgetSequence;

// Type guards
export function isMultiStep(
  def: SequenceDefinition,
): def is MultiStepSequence {
  return "steps" in def && Array.isArray(def.steps);
}

export function isFireAndForget(
  def: SequenceDefinition,
): def is FireAndForgetSequence {
  return "fireAndForget" in def && def.fireAndForget != null;
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

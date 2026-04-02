// ── Subscriber ──────────────────────────────────────────────────────────────

export interface Subscriber {
  email: string;
  firstName: string;
  attributes?: Record<string, unknown>;
  tags?: string[];
}

export interface SubscriberProfile {
  PK: string;
  SK: "PROFILE";
  email: string;
  firstName: string;
  unsubscribed: boolean;
  suppressed: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
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
  ttl?: number;
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
  templateKey?: string;
  subject?: string;
  variants?: SendVariant[];
  sequenceId?: string;
  subscriber: Subscriber;
  sender?: SenderConfig;
}

export interface FireAndForgetInput {
  action: "fire_and_forget";
  templateKey: string;
  subject: string;
  subscriber: Subscriber;
  sender?: SenderConfig;
  sequenceId?: string; // override "fire_and_forget" default, e.g. broadcastId
}

export interface CompleteInput {
  action: "complete";
  sequenceId: string;
  subscriber: Pick<Subscriber, "email">;
  executionArn: string;
}

export type SendEmailInput = RegisterInput | SendInput | FireAndForgetInput | CompleteInput;

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
  reason: "unsubscribed" | "suppressed";
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

// ── Email event (engagement tracking) ────────────────────────────────────────

export type EmailEventType = "delivery" | "open" | "click" | "bounce" | "complaint" | "reply";

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
export interface SendVariant {
  templateKey: string; // S3 path e.g. "onboarding/welcome-a"
  subject: string;
}

export interface SendStep {
  type: "send";
  templateKey?: string; // S3 path — required unless variants is set
  subject?: string; // required unless variants is set
  variants?: SendVariant[]; // A/B variants (2+), mutually exclusive with templateKey/subject
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

// Native Step Functions Choice - no Lambda invocation, evaluated in the
// state machine using sfn.Condition.stringEquals on the execution input.
export interface ChoiceBranch {
  value: string;
  steps: SequenceStep[];
}

export interface ChoiceStep {
  type: "choice";
  field: string; // JSONPath e.g. "$.subscriber.attributes.platform"
  branches: ChoiceBranch[];
  default?: SequenceStep[]; // fallback when no branch matches
}

export type SequenceStep = SendStep | WaitStep | ConditionStep | ChoiceStep;

// Event-triggered one-off email within a sequence
export interface EventEmail {
  detailType: string; // EventBridge detail-type to match
  templateKey: string;
  subject: string;
  subscriberMapping?: SubscriberMapping; // override sequence-level mapping
}

// Exit event — removes a subscriber from this sequence when the event fires
export interface ExitEvent {
  detailType: string; // EventBridge detail-type to match
  subscriberMapping?: SubscriberMapping; // override sequence-level mapping (only email is used)
}

export interface SenderConfig {
  fromEmail: string;
  fromName: string;
  replyToEmail?: string; // Reply-To header
  captureReplies?: boolean; // If true, create SES receipt rule for replyToEmail
  forwardRepliesTo?: string; // Forward captured replies to this email address
  listUnsubscribe?: boolean; // Include List-Unsubscribe headers (default: true)
}

export interface SequenceDefinition {
  id: string;
  sender: SenderConfig;
  trigger: SequenceTrigger;
  timeoutMinutes: number;
  steps: SequenceStep[];
  events?: EventEmail[]; // fire-and-forget emails triggered by events
  exitOn?: ExitEvent[]; // exit subscriber from this sequence on these events
}

// ── Subscribe input ────────────────────────────────────────────────────────

export interface SubscribeInput {
  subscriber: Subscriber;
}

// ── Broadcast ──────────────────────────────────────────────────────────────

export interface BroadcastFilters {
  tags?: string[]; // AND: subscriber must have ALL listed tags
  attributes?: Record<string, unknown>; // equality match on subscriber attributes
}

export interface BroadcastInput {
  broadcastId: string;
  templateKey: string;
  subject: string;
  sender: SenderConfig;
  filters?: BroadcastFilters;
}

// ── Broadcast record (persisted log) ────────────────────────────────────────

export interface BroadcastRecord {
  PK: "BROADCAST";
  SK: string; // <isoTimestamp>#<broadcastId>
  broadcastId: string;
  templateKey: string;
  subject: string;
  sender: SenderConfig;
  filters?: BroadcastFilters;
  subscriberCount: number;
  messagesQueued: number;
  sentAt: string; // ISO timestamp
}

// ── Tag item (inverted index) ──────────────────────────────────────────────

export interface TagItem {
  PK: string; // TAG#<tagName>
  SK: string; // SUB#<email>
  email: string;
  taggedAt: string;
}

// ── CDK context config ──────────────────────────────────────────────────────

export interface MailshotConfig {
  account: string;
  region: string;
  stackName: string;
  tableName: string;
  eventsTableName: string;
  templateBucketName: string;
  eventBusName: string;
  sesConfigSetName: string;
  snsTopicName: string;
  unsubscribeSecret: string;
  dataTtlDays?: number;
}

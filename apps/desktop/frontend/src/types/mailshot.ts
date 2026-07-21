/**
 * TypeScript mirror of @mailshot/shared sequence config types.
 * The Go backend evaluates sequence.config.ts and ships the definition as a
 * JSON string; these types describe that payload.
 */

export interface SubscriberMapping {
  email: string;
  firstName: string;
  attributes?: string;
}

export interface SequenceTrigger {
  detailType: string;
  subscriberMapping: SubscriberMapping;
}

export interface SendVariant {
  templateKey: string;
  subject: string;
}

export interface SendStep {
  type: "send";
  templateKey?: string;
  subject?: string;
  variants?: SendVariant[];
}

export interface WaitStep {
  type: "wait";
  days?: number;
  hours?: number;
  minutes?: number;
}

export interface ConditionStep {
  type: "condition";
  check: "subscriber_field_exists" | "subscriber_field_equals" | "has_been_sent";
  field?: string;
  value?: string;
  templateKey?: string;
  then: SequenceStep[];
  else?: SequenceStep[];
}

export interface ChoiceBranch {
  value: string;
  steps: SequenceStep[];
}

export interface ChoiceStep {
  type: "choice";
  field: string;
  branches: ChoiceBranch[];
  default?: SequenceStep[];
}

export type SequenceStep = SendStep | WaitStep | ConditionStep | ChoiceStep;

export interface EventEmail {
  detailType: string;
  templateKey: string;
  subject: string;
  subscriberMapping?: SubscriberMapping;
}

export interface ExitEvent {
  detailType: string;
  subscriberMapping?: SubscriberMapping;
}

export interface SenderConfig {
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  captureReplies?: boolean;
  forwardRepliesTo?: string;
  listUnsubscribe?: boolean;
}

export interface SequenceDefinition {
  id: string;
  sender: SenderConfig;
  transactional?: boolean;
  trigger: SequenceTrigger;
  timeoutMinutes: number;
  steps: SequenceStep[];
  events?: EventEmail[];
  exitOn?: ExitEvent[];
}

export function countSteps(steps: SequenceStep[]): number {
  let n = 0;
  for (const s of steps) {
    n++;
    if (s.type === "condition") {
      n += countSteps(s.then) + countSteps(s.else ?? []);
    } else if (s.type === "choice") {
      for (const b of s.branches) n += countSteps(b.steps);
      n += countSteps(s.default ?? []);
    }
  }
  return n;
}

export function waitLabel(s: WaitStep): string {
  if (s.days) return s.days === 1 ? "1 day" : `${s.days} days`;
  if (s.hours) return s.hours === 1 ? "1 hour" : `${s.hours} hours`;
  if (s.minutes) return s.minutes === 1 ? "1 min" : `${s.minutes} min`;
  return "wait";
}

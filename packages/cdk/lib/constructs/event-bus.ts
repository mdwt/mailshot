import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import type { SequenceDefinition } from "@step-func-emailer/shared";

export interface EventBusProps {
  eventBusName: string;
  eventSource: string;
  definitions: SequenceDefinition[];
  stateMachines: Map<string, sfn.StateMachine>;
  sendEmailFn: lambda.IFunction;
}

function pascalCase(id: string): string {
  return id
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

export class EventBusConstruct extends Construct {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventBusProps) {
    super(scope, id);

    this.eventBus = new events.EventBus(this, "Bus", {
      eventBusName: props.eventBusName,
    });

    for (const def of props.definitions) {
      const prefix = pascalCase(def.id);

      // ── Sequence trigger → Step Function ─────────────────────────────
      const sm = props.stateMachines.get(def.id);
      if (!sm) {
        throw new Error(`No state machine found for sequence '${def.id}'`);
      }

      const mapping = def.trigger.subscriberMapping;
      const subscriberInput: Record<string, unknown> = {
        email: events.EventField.fromPath(mapping.email),
        firstName: events.EventField.fromPath(mapping.firstName),
      };
      if (mapping.attributes) {
        subscriberInput.attributes = events.EventField.fromPath(
          mapping.attributes,
        );
      }

      const ruleSlug = def.trigger.detailType.replace(/[^a-zA-Z0-9]/g, "-");

      new events.Rule(this, `${prefix}Rule`, {
        eventBus: this.eventBus,
        ruleName: `${def.id}-${ruleSlug}`,
        eventPattern: {
          detailType: [def.trigger.detailType],
        },
        targets: [
          new targets.SfnStateMachine(sm, {
            input: events.RuleTargetInput.fromObject({
              subscriber: subscriberInput,
            }),
          }),
        ],
      });

      // ── Event-triggered fire-and-forget emails ───────────────────────
      if (def.events) {
        for (let i = 0; i < def.events.length; i++) {
          const evt = def.events[i];
          const evtSlug = evt.detailType.replace(/[^a-zA-Z0-9]/g, "-");

          const evtMapping = evt.subscriberMapping ?? def.trigger.subscriberMapping;
          const evtSubscriber: Record<string, unknown> = {
            email: events.EventField.fromPath(evtMapping.email),
            firstName: events.EventField.fromPath(evtMapping.firstName),
          };
          if (evtMapping.attributes) {
            evtSubscriber.attributes = events.EventField.fromPath(
              evtMapping.attributes,
            );
          }

          new events.Rule(this, `${prefix}Event${i + 1}Rule`, {
            eventBus: this.eventBus,
            ruleName: `${def.id}-${evtSlug}`,
            eventPattern: {
              detailType: [evt.detailType],
            },
            targets: [
              new targets.LambdaFunction(props.sendEmailFn, {
                event: events.RuleTargetInput.fromObject({
                  action: "fire_and_forget",
                  templateKey: evt.templateKey,
                  subject: evt.subject,
                  subscriber: evtSubscriber,
                }),
              }),
            ],
          });
        }
      }
    }
  }
}

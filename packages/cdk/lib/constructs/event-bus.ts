import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import type { SequenceDefinition } from "@step-func-emailer/shared";
import { isMultiStep, isFireAndForget } from "@step-func-emailer/shared";

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
      const ruleSlug = def.trigger.detailType.replace(/[^a-zA-Z0-9]/g, "-");

      if (isMultiStep(def)) {
        const sm = props.stateMachines.get(def.id);
        if (!sm) {
          throw new Error(
            `No state machine found for sequence '${def.id}'`,
          );
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
      } else if (isFireAndForget(def)) {
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

        new events.Rule(this, `${prefix}Rule`, {
          eventBus: this.eventBus,
          ruleName: `${def.id}-${ruleSlug}`,
          eventPattern: {
            detailType: [def.trigger.detailType],
          },
          targets: [
            new targets.LambdaFunction(props.sendEmailFn, {
              event: events.RuleTargetInput.fromObject({
                action: "fire_and_forget",
                templateKey: def.fireAndForget.templateKey,
                subject: def.fireAndForget.subject,
                subscriber: subscriberInput,
              }),
            }),
          ],
        });
      }
    }
  }
}

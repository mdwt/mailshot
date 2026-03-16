import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface EventBusProps {
  eventBusName: string;
  eventSource: string;
  onboardingStateMachine: sfn.StateMachine;
  sendEmailFn: lambda.IFunction;
}

export class EventBusConstruct extends Construct {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventBusProps) {
    super(scope, id);

    this.eventBus = new events.EventBus(this, "Bus", {
      eventBusName: props.eventBusName,
    });

    // ── Sequence rule: customer.created → OnboardingSequence ─────────
    new events.Rule(this, "CustomerCreatedRule", {
      eventBus: this.eventBus,
      ruleName: "customer-created-onboarding",
      eventPattern: {
        detailType: ["customer.created"],
      },
      targets: [
        new targets.SfnStateMachine(props.onboardingStateMachine, {
          input: events.RuleTargetInput.fromObject({
            subscriber: {
              email: events.EventField.fromPath("$.detail.email"),
              firstName: events.EventField.fromPath("$.detail.firstName"),
              attributes: events.EventField.fromPath("$.detail"),
            },
          }),
        }),
      ],
    });

    // Example fire-and-forget rule (commented out, add as needed):
    // new events.Rule(this, "FirstSaleRule", {
    //   eventBus: this.eventBus,
    //   ruleName: "first-sale-email",
    //   eventPattern: { detailType: ["customer.first_sale"] },
    //   targets: [
    //     new targets.LambdaFunction(props.sendEmailFn, {
    //       event: events.RuleTargetInput.fromObject({
    //         action: "fire_and_forget",
    //         templateKey: "events/first-sale",
    //         subject: "You just made your first sale!",
    //         subscriber: {
    //           email: events.EventField.fromPath("$.detail.email"),
    //           firstName: events.EventField.fromPath("$.detail.firstName"),
    //           attributes: events.EventField.fromPath("$.detail"),
    //         },
    //       }),
    //     }),
    //   ],
    // });
  }
}

import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface StateMachinesProps {
  sendEmailFn: lambda.IFunction;
  checkConditionFn: lambda.IFunction;
}

export class StateMachinesConstruct extends Construct {
  public readonly onboardingSequence: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: StateMachinesProps) {
    super(scope, id);

    const retryConfig: sfn.RetryProps = {
      errors: ["States.TaskFailed"],
      interval: cdk.Duration.seconds(60),
      maxAttempts: 3,
      backoffRate: 2,
    };

    // ── Register ─────────────────────────────────────────────────────────
    const register = new tasks.LambdaInvoke(this, "Register", {
      lambdaFunction: props.sendEmailFn,
      payload: sfn.TaskInput.fromObject({
        action: "register",
        sequenceId: "onboarding",
        "subscriber.$": "$.subscriber",
        "executionArn.$": "$$.Execution.Id",
      }),
      resultPath: "$.context",
      payloadResponseOnly: true,
    });

    // ── Placeholder send tasks (to be filled with actual sequence) ───────
    const sendEmail1 = this.createSendTask(
      "SendEmail1",
      props.sendEmailFn,
      "onboarding/welcome",
      "Welcome! Let's get you started",
      retryConfig,
    );

    const wait1 = new sfn.Wait(this, "Wait2Days", {
      time: sfn.WaitTime.duration(cdk.Duration.days(2)),
    });

    const sendEmail2 = this.createSendTask(
      "SendEmail2",
      props.sendEmailFn,
      "onboarding/day-3",
      "Quick tip to help you along",
      retryConfig,
    );

    const wait2 = new sfn.Wait(this, "Wait3Days", {
      time: sfn.WaitTime.duration(cdk.Duration.days(3)),
    });

    const sendEmail3 = this.createSendTask(
      "SendEmail3",
      props.sendEmailFn,
      "onboarding/day-6",
      "How's it going?",
      retryConfig,
    );

    // ── Complete ─────────────────────────────────────────────────────────
    const complete = new tasks.LambdaInvoke(this, "Complete", {
      lambdaFunction: props.sendEmailFn,
      payload: sfn.TaskInput.fromObject({
        action: "complete",
        sequenceId: "onboarding",
        "subscriber.$": "$.subscriber",
        "executionArn.$": "$$.Execution.Id",
      }),
      resultPath: sfn.JsonPath.DISCARD,
      payloadResponseOnly: true,
    });

    const succeed = new sfn.Succeed(this, "Done");

    // ── Chain ────────────────────────────────────────────────────────────
    const definition = register
      .next(sendEmail1)
      .next(wait1)
      .next(sendEmail2)
      .next(wait2)
      .next(sendEmail3)
      .next(complete)
      .next(succeed);

    this.onboardingSequence = new sfn.StateMachine(
      this,
      "OnboardingSequence",
      {
        stateMachineName: "OnboardingSequence",
        definitionBody: sfn.DefinitionBody.fromChainable(definition),
        timeout: cdk.Duration.days(30),
      },
    );
  }

  private createSendTask(
    id: string,
    fn: lambda.IFunction,
    templateKey: string,
    subject: string,
    retryConfig: sfn.RetryProps,
  ): tasks.LambdaInvoke {
    const task = new tasks.LambdaInvoke(this, id, {
      lambdaFunction: fn,
      payload: sfn.TaskInput.fromObject({
        action: "send",
        templateKey,
        subject,
        "subscriber.$": "$.subscriber",
      }),
      resultPath: "$.sendResult",
      payloadResponseOnly: true,
    });
    task.addRetry(retryConfig);
    return task;
  }
}

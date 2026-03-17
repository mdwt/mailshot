import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import type {
  MultiStepSequence,
  SequenceStep,
  SendStep,
  WaitStep,
  ConditionStep,
} from "@step-func-emailer/shared";

export interface StateMachinesProps {
  sendEmailFn: lambda.IFunction;
  checkConditionFn: lambda.IFunction;
  sequences: MultiStepSequence[];
}

function pascalCase(id: string): string {
  return id
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

export class StateMachinesConstruct extends Construct {
  public readonly stateMachines: Map<string, sfn.StateMachine>;

  private readonly retryConfig: sfn.RetryProps = {
    errors: ["States.TaskFailed"],
    interval: cdk.Duration.seconds(60),
    maxAttempts: 3,
    backoffRate: 2,
  };

  constructor(scope: Construct, id: string, props: StateMachinesProps) {
    super(scope, id);

    this.stateMachines = new Map();

    for (const seq of props.sequences) {
      const sm = this.buildSequence(seq, props.sendEmailFn, props.checkConditionFn);
      this.stateMachines.set(seq.id, sm);
    }
  }

  private buildSequence(
    def: MultiStepSequence,
    sendEmailFn: lambda.IFunction,
    checkConditionFn: lambda.IFunction,
  ): sfn.StateMachine {
    const prefix = pascalCase(def.id);

    // Register task
    const register = new tasks.LambdaInvoke(this, `${prefix}-Register`, {
      lambdaFunction: sendEmailFn,
      payload: sfn.TaskInput.fromObject({
        action: "register",
        sequenceId: def.id,
        "subscriber.$": "$.subscriber",
        "executionArn.$": "$$.Execution.Id",
      }),
      resultPath: "$.context",
      payloadResponseOnly: true,
    });

    // Build step chain
    const chain = this.buildChain(
      prefix,
      def.steps,
      sendEmailFn,
      checkConditionFn,
      { counter: 0 },
    );

    // Complete task
    const complete = new tasks.LambdaInvoke(this, `${prefix}-Complete`, {
      lambdaFunction: sendEmailFn,
      payload: sfn.TaskInput.fromObject({
        action: "complete",
        sequenceId: def.id,
        "subscriber.$": "$.subscriber",
        "executionArn.$": "$$.Execution.Id",
      }),
      resultPath: sfn.JsonPath.DISCARD,
      payloadResponseOnly: true,
    });

    const succeed = new sfn.Succeed(this, `${prefix}-Done`);

    // Chain: Register → steps → Complete → Succeed
    let definition: sfn.IChainable;
    if (chain) {
      definition = register.next(chain).next(complete).next(succeed);
    } else {
      definition = register.next(complete).next(succeed);
    }

    return new sfn.StateMachine(this, `${prefix}Sequence`, {
      stateMachineName: `${prefix}Sequence`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.days(def.timeoutDays ?? 30),
    });
  }

  private buildChain(
    prefix: string,
    steps: SequenceStep[],
    sendEmailFn: lambda.IFunction,
    checkConditionFn: lambda.IFunction,
    ctx: { counter: number },
  ): sfn.Chain | null {
    let chain: sfn.Chain | null = null;

    for (const step of steps) {
      ctx.counter++;
      const n = ctx.counter;
      let state: sfn.IChainable;

      switch (step.type) {
        case "send":
          state = this.buildSendStep(prefix, n, step, sendEmailFn);
          break;
        case "wait":
          state = this.buildWaitStep(prefix, n, step);
          break;
        case "condition":
          state = this.buildConditionStep(
            prefix,
            n,
            step,
            sendEmailFn,
            checkConditionFn,
            ctx,
          );
          break;
      }

      chain = chain ? chain.next(state) : sfn.Chain.start(state);
    }

    return chain;
  }

  private buildSendStep(
    prefix: string,
    n: number,
    step: SendStep,
    sendEmailFn: lambda.IFunction,
  ): tasks.LambdaInvoke {
    const task = new tasks.LambdaInvoke(this, `${prefix}-Send${n}`, {
      lambdaFunction: sendEmailFn,
      payload: sfn.TaskInput.fromObject({
        action: "send",
        templateKey: step.templateKey,
        subject: step.subject,
        "subscriber.$": "$.subscriber",
      }),
      resultPath: "$.sendResult",
      payloadResponseOnly: true,
    });
    task.addRetry(this.retryConfig);
    return task;
  }

  private buildWaitStep(
    prefix: string,
    n: number,
    step: WaitStep,
  ): sfn.Wait {
    const totalSeconds =
      (step.days ?? 0) * 86400 +
      (step.hours ?? 0) * 3600 +
      (step.minutes ?? 0) * 60;

    return new sfn.Wait(this, `${prefix}-Wait${n}`, {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(totalSeconds)),
    });
  }

  private buildConditionStep(
    prefix: string,
    n: number,
    step: ConditionStep,
    sendEmailFn: lambda.IFunction,
    checkConditionFn: lambda.IFunction,
    ctx: { counter: number },
  ): sfn.IChainable {
    // Invoke the check-condition Lambda
    const checkTask = new tasks.LambdaInvoke(
      this,
      `${prefix}-Check${n}`,
      {
        lambdaFunction: checkConditionFn,
        payload: sfn.TaskInput.fromObject({
          check: step.check,
          ...(step.field != null && { field: step.field }),
          ...(step.value != null && { value: step.value }),
          ...(step.templateKey != null && { templateKey: step.templateKey }),
          "subscriber.$": "$.subscriber",
        }),
        resultPath: "$.conditionResult",
        payloadResponseOnly: true,
      },
    );
    checkTask.addRetry(this.retryConfig);

    // Build then branch
    const thenChain = this.buildChain(
      prefix,
      step.then,
      sendEmailFn,
      checkConditionFn,
      ctx,
    );

    // Build else branch
    const elseSteps = step.else ?? [];
    const elseChain = this.buildChain(
      prefix,
      elseSteps,
      sendEmailFn,
      checkConditionFn,
      ctx,
    );

    // Choice state
    const choice = new sfn.Choice(this, `${prefix}-Choice${n}`);

    const thenState = thenChain ?? new sfn.Pass(this, `${prefix}-ThenPass${n}`);
    const elseState = elseChain ?? new sfn.Pass(this, `${prefix}-ElsePass${n}`);

    choice
      .when(
        sfn.Condition.booleanEquals("$.conditionResult.result", true),
        thenState,
      )
      .otherwise(elseState);

    // Converge branches
    const converge = new sfn.Pass(this, `${prefix}-Converge${n}`);
    choice.afterwards().next(converge);

    // Return check → choice → converge as a chain
    return sfn.Chain.start(checkTask).next(choice);
  }
}

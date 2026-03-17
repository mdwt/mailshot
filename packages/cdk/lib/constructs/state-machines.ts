import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import type {
  SequenceDefinition,
  SequenceStep,
  SendStep,
  WaitStep,
  ConditionStep,
  ChoiceStep,
} from "@step-func-emailer/shared";

export interface StateMachinesProps {
  sendEmailFn: lambda.IFunction;
  checkConditionFn: lambda.IFunction;
  sequences: SequenceDefinition[];
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
    def: SequenceDefinition,
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
      timeout: cdk.Duration.minutes(def.timeoutMinutes),
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
            prefix, n, step, sendEmailFn, checkConditionFn, ctx,
          );
          break;
        case "choice":
          state = this.buildChoiceStep(
            prefix, n, step, sendEmailFn, checkConditionFn, ctx,
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

  // Lambda-based condition check (reads from DynamoDB — for has_been_sent etc.)
  private buildConditionStep(
    prefix: string,
    n: number,
    step: ConditionStep,
    sendEmailFn: lambda.IFunction,
    checkConditionFn: lambda.IFunction,
    ctx: { counter: number },
  ): sfn.IChainable {
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

    const thenChain = this.buildChain(
      prefix, step.then, sendEmailFn, checkConditionFn, ctx,
    );
    const elseChain = this.buildChain(
      prefix, step.else ?? [], sendEmailFn, checkConditionFn, ctx,
    );

    const choice = new sfn.Choice(this, `${prefix}-Cond${n}`);
    const thenState = thenChain ?? new sfn.Pass(this, `${prefix}-ThenPass${n}`);
    const elseState = elseChain ?? new sfn.Pass(this, `${prefix}-ElsePass${n}`);

    choice
      .when(
        sfn.Condition.booleanEquals("$.conditionResult.result", true),
        thenState,
      )
      .otherwise(elseState);

    const converge = new sfn.Pass(this, `${prefix}-CondMerge${n}`);
    choice.afterwards().next(converge);

    // Chain: checkTask → choice → (branches) → converge
    // Use custom chain so the end state is converge (chainable), not choice
    const checkChain = sfn.Chain.start(checkTask).next(choice);
    return sfn.Chain.custom(checkChain.startState, [converge], converge);
  }

  // Native Step Functions Choice — no Lambda, evaluates JSONPath directly
  private buildChoiceStep(
    prefix: string,
    n: number,
    step: ChoiceStep,
    sendEmailFn: lambda.IFunction,
    checkConditionFn: lambda.IFunction,
    ctx: { counter: number },
  ): sfn.IChainable {
    const choice = new sfn.Choice(this, `${prefix}-Choice${n}`);

    // Build each branch and wire it to the Choice
    for (const branch of step.branches) {
      const branchChain = this.buildChain(
        prefix, branch.steps, sendEmailFn, checkConditionFn, ctx,
      );
      if (branchChain) {
        choice.when(
          sfn.Condition.stringEquals(step.field, branch.value),
          branchChain,
        );
      }
    }

    // Default/otherwise branch
    if (step.default && step.default.length > 0) {
      const defaultChain = this.buildChain(
        prefix, step.default, sendEmailFn, checkConditionFn, ctx,
      );
      if (defaultChain) {
        choice.otherwise(defaultChain);
      } else {
        ctx.counter++;
        choice.otherwise(new sfn.Pass(this, `${prefix}-DefaultPass${ctx.counter}`));
      }
    } else {
      ctx.counter++;
      choice.otherwise(new sfn.Pass(this, `${prefix}-DefaultPass${ctx.counter}`));
    }

    // Converge all branches into a single Pass so the chain can continue
    const converge = new sfn.Pass(this, `${prefix}-ChoiceMerge${n}`);
    choice.afterwards().next(converge);

    // Return a Chain that starts at choice but ends at converge (chainable)
    return sfn.Chain.custom(choice.startState, [converge], converge);
  }
}

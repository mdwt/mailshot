import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { MailshotConfig, SequenceDefinition } from "@mailshot/shared";
import { StorageConstruct } from "./constructs/storage.js";
import { LambdasConstruct } from "./constructs/lambdas.js";
import { SesConfigConstruct } from "./constructs/ses-config.js";
import { StateMachinesConstruct } from "./constructs/state-machines.js";
import { EventBusConstruct } from "./constructs/event-bus.js";

export interface MailshotStackProps extends cdk.StackProps {
  config: MailshotConfig;
  definitions: SequenceDefinition[];
  handlersPath?: string;
  templateBuildDir?: string;
}

export class MailshotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MailshotStackProps) {
    super(scope, id, props);

    const { config, definitions } = props;

    // ── Tags (applied to all resources in the stack) ─────────────────────
    cdk.Tags.of(this).add("application", "mailshot");
    cdk.Tags.of(this).add("stack", config.stackName);

    // ── Storage (DynamoDB + S3) ──────────────────────────────────────────
    const storage = new StorageConstruct(this, "Storage", {
      tableName: config.tableName,
      eventsTableName: config.eventsTableName,
      templateBucketName: config.templateBucketName,
      sequenceIds: definitions.map((d) => d.id),
      templateBuildDir: props.templateBuildDir ?? path.resolve(process.cwd(), "build"),
    });

    // ── SES configuration ────────────────────────────────────────────────
    // Collect unique reply-to emails from sequences with captureReplies enabled
    const replyToEmails = [
      ...new Set(
        definitions
          .filter((d) => d.sender.captureReplies && d.sender.replyToEmail)
          .map((d) => d.sender.replyToEmail!),
      ),
    ];

    // Collect forwardRepliesTo (validate all sequences agree on a single value)
    const forwardRepliesSet = new Set(
      definitions
        .filter((d) => d.sender.captureReplies && d.sender.forwardRepliesTo)
        .map((d) => d.sender.forwardRepliesTo!),
    );
    if (forwardRepliesSet.size > 1) {
      throw new Error(
        `Conflicting forwardRepliesTo values across sequences: ${[...forwardRepliesSet].join(", ")}. All sequences must use the same forwardRepliesTo address.`,
      );
    }
    const replyForwardTo = forwardRepliesSet.size === 1 ? [...forwardRepliesSet][0] : undefined;

    const sesConfig = new SesConfigConstruct(this, "SesConfig", {
      configSetName: config.sesConfigSetName,
      snsTopicName: config.snsTopicName,
      replyToEmails: replyToEmails.length > 0 ? replyToEmails : undefined,
    });

    // ── Lambdas ──────────────────────────────────────────────────────────
    const lambdas = new LambdasConstruct(this, "Lambdas", {
      table: storage.table,
      eventsTable: storage.eventsTable,
      templateBucket: storage.templateBucket,
      snsTopic: sesConfig.snsTopic,
      replyTopic: sesConfig.replyTopic,
      sesConfigSetName: config.sesConfigSetName,
      unsubscribeSecret: config.unsubscribeSecret,
      eventBusName: config.eventBusName,
      dataTtlDays: config.dataTtlDays,
      broadcastFnName: `${config.stackName}-broadcast`,
      replyForwardTo,
      handlersPath: props.handlersPath,
    });

    // Subscribe engagement handler to engagement events
    sesConfig.engagementTopic.addSubscription(
      new cdk.aws_sns_subscriptions.LambdaSubscription(lambdas.engagementHandlerFn),
    );

    // ── State machines ───────────────────────────────────────────────────
    const stateMachines = new StateMachinesConstruct(this, "StateMachines", {
      stackName: config.stackName,
      sendEmailFn: lambdas.sendEmailFn,
      checkConditionFn: lambdas.checkConditionFn,
      sequences: definitions,
    });

    // Grant permissions to stop executions.
    // states:StopExecution targets execution ARNs which contain random IDs -
    // scoping to arn:aws:states:*:*:execution:* is functionally equivalent to *,
    // so we keep * for clarity.
    lambdas.sendEmailFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["states:StopExecution"],
        resources: ["*"],
      }),
    );
    lambdas.unsubscribeFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["states:StopExecution"],
        resources: ["*"],
      }),
    );
    lambdas.bounceHandlerFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["states:StopExecution"],
        resources: ["*"],
      }),
    );
    lambdas.sequenceExitFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["states:StopExecution"],
        resources: ["*"],
      }),
    );

    // Grant read on state machines - construct ARNs manually to avoid circular
    // dependency between StateMachine → Lambda → StateMachine via EventBridge
    const smArns = definitions.map((d) => {
      const name =
        config.stackName +
        "-" +
        d.id
          .split(/[-_]/)
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join("") +
        "Sequence";
      return this.formatArn({
        service: "states",
        resource: "stateMachine",
        resourceName: name,
        arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
      });
    });
    const smExecArns = smArns.map((arn) => arn.replace(":stateMachine:", ":execution:") + ":*");
    lambdas.sendEmailFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["states:DescribeStateMachine", "states:ListExecutions"],
        resources: smArns,
      }),
    );
    lambdas.sendEmailFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["states:DescribeExecution", "states:GetExecutionHistory"],
        resources: smExecArns,
      }),
    );

    // ── EventBridge ──────────────────────────────────────────────────────
    new EventBusConstruct(this, "EventBus", {
      eventBusName: config.eventBusName,
      definitions,
      stateMachines: stateMachines.stateMachines,
      sendEmailFn: lambdas.sendEmailFn,
      sequenceExitFn: lambdas.sequenceExitFn,
      subscribeFn: lambdas.subscribeFn,
    });

    // ── Outputs ──────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "TableName", {
      value: storage.table.tableName,
    });
    new cdk.CfnOutput(this, "TemplateBucket", {
      value: storage.templateBucket.bucketName,
    });
    new cdk.CfnOutput(this, "UnsubscribeUrl", {
      value: lambdas.unsubscribeFnUrl,
    });
    new cdk.CfnOutput(this, "EventBusName", {
      value: config.eventBusName,
    });
    new cdk.CfnOutput(this, "BroadcastFnName", {
      value: lambdas.broadcastFn.functionName,
    });
  }
}

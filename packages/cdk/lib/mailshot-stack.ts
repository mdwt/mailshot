import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { MailshotConfig, SequenceDefinition } from "@mailshot/shared";
import { StorageConstruct } from "./constructs/storage.js";
import { SsmConstruct } from "./constructs/ssm-params.js";
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

    // ── Storage (DynamoDB + S3) ──────────────────────────────────────────
    const storage = new StorageConstruct(this, "Storage", {
      tableName: config.tableName,
      eventsTableName: config.eventsTableName,
      templateBucketName: config.templateBucketName,
      sequenceIds: definitions.map((d) => d.id),
      templateBuildDir: props.templateBuildDir ?? path.resolve(process.cwd(), "build"),
    });

    // ── SES configuration ────────────────────────────────────────────────
    const sesConfig = new SesConfigConstruct(this, "SesConfig", {
      configSetName: config.sesConfigSetName,
      snsTopicName: config.snsTopicName,
    });

    // ── Lambdas ──────────────────────────────────────────────────────────
    const lambdas = new LambdasConstruct(this, "Lambdas", {
      table: storage.table,
      eventsTable: storage.eventsTable,
      templateBucket: storage.templateBucket,
      ssmPrefix: config.ssmPrefix,
      snsTopic: sesConfig.snsTopic,
      sesConfigSetName: config.sesConfigSetName,
      handlersPath: props.handlersPath,
    });

    // Subscribe engagement handler to engagement events
    sesConfig.engagementTopic.addSubscription(
      new cdk.aws_sns_subscriptions.LambdaSubscription(lambdas.engagementHandlerFn),
    );

    // ── SSM Parameters ───────────────────────────────────────────────────
    new SsmConstruct(this, "SsmParams", {
      prefix: config.ssmPrefix,
      tableName: storage.table.tableName,
      eventsTableName: storage.eventsTable.tableName,
      templateBucketName: storage.templateBucket.bucketName,
      defaultFromEmail: config.defaultFromEmail,
      defaultFromName: config.defaultFromName,
      replyToEmail: config.replyToEmail,
      sesConfigSetName: config.sesConfigSetName,
      unsubscribeBaseUrl: lambdas.unsubscribeFnUrl,
      unsubscribeSecret: config.unsubscribeSecret,
    });

    // ── State machines ───────────────────────────────────────────────────
    const stateMachines = new StateMachinesConstruct(this, "StateMachines", {
      sendEmailFn: lambdas.sendEmailFn,
      checkConditionFn: lambdas.checkConditionFn,
      sequences: definitions,
    });

    // Grant permissions to stop executions.
    // states:StopExecution targets execution ARNs which contain random IDs —
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

    // Grant read on state machines — construct ARNs manually to avoid circular
    // dependency between StateMachine → Lambda → StateMachine via EventBridge
    const smArns = definitions.map((d) => {
      const name =
        d.id
          .split(/[-_]/)
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join("") + "Sequence";
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
  }
}

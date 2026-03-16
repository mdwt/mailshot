import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { StepFuncEmailerConfig } from "@step-func-emailer/shared";
import { StorageConstruct } from "./constructs/storage.js";
import { SsmConstruct } from "./constructs/ssm-params.js";
import { LambdasConstruct } from "./constructs/lambdas.js";
import { SesConfigConstruct } from "./constructs/ses-config.js";
import { StateMachinesConstruct } from "./constructs/state-machines.js";
import { EventBusConstruct } from "./constructs/event-bus.js";

export interface StepFuncEmailerStackProps extends cdk.StackProps {
  config: StepFuncEmailerConfig;
}

export class StepFuncEmailerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StepFuncEmailerStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ── Storage (DynamoDB + S3) ──────────────────────────────────────────
    const storage = new StorageConstruct(this, "Storage", {
      tableName: config.tableName,
      eventsTableName: config.eventsTableName,
      templateBucketName: config.templateBucketName,
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
    });

    // Subscribe engagement handler to engagement events
    sesConfig.engagementTopic.addSubscription(
      new cdk.aws_sns_subscriptions.LambdaSubscription(
        lambdas.engagementHandlerFn,
      ),
    );

    // ── SSM Parameters ───────────────────────────────────────────────────
    new SsmConstruct(this, "SsmParams", {
      prefix: config.ssmPrefix,
      tableName: storage.table.tableName,
      eventsTableName: storage.eventsTable.tableName,
      templateBucketName: storage.templateBucket.bucketName,
      defaultFromEmail: config.defaultFromEmail,
      defaultFromName: config.defaultFromName,
      sesConfigSetName: config.sesConfigSetName,
      unsubscribeBaseUrl: lambdas.unsubscribeFnUrl,
      unsubscribeSecret: config.unsubscribeSecret,
      rateLimitCount: config.rateLimitCount,
      rateLimitWindowHours: config.rateLimitWindowHours,
    });

    // ── State machines ───────────────────────────────────────────────────
    const stateMachines = new StateMachinesConstruct(this, "StateMachines", {
      sendEmailFn: lambdas.sendEmailFn,
      checkConditionFn: lambdas.checkConditionFn,
    });

    // Grant the send email lambda permission to stop executions
    stateMachines.onboardingSequence.grantRead(lambdas.sendEmailFn);
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

    // ── EventBridge ──────────────────────────────────────────────────────
    new EventBusConstruct(this, "EventBus", {
      eventBusName: config.eventBusName,
      eventSource: config.eventSource,
      onboardingStateMachine: stateMachines.onboardingSequence,
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

import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface LambdasProps {
  table: dynamodb.Table;
  eventsTable: dynamodb.Table;
  templateBucket: s3.Bucket;
  snsTopic: sns.Topic;
  replyTopic?: sns.Topic;
  sesConfigSetName: string;
  unsubscribeSecret: string;
  eventBusName?: string;
  dataTtlDays?: number;
  replyForwardTo?: string;
  broadcastFnName: string;
  logLevel?: string;
  handlersPath?: string;
}

export class LambdasConstruct extends Construct {
  public readonly sendEmailFn: nodejs.NodejsFunction;
  public readonly checkConditionFn: nodejs.NodejsFunction;
  public readonly unsubscribeFn: nodejs.NodejsFunction;
  public readonly bounceHandlerFn: nodejs.NodejsFunction;
  public readonly engagementHandlerFn: nodejs.NodejsFunction;
  public readonly sequenceExitFn: nodejs.NodejsFunction;
  public readonly subscribeFn: nodejs.NodejsFunction;
  public readonly broadcastFn: nodejs.NodejsFunction;
  public readonly broadcastQueue: sqs.Queue;
  public readonly replyHandlerFn?: nodejs.NodejsFunction;
  public readonly unsubscribeFnUrl: string;

  constructor(scope: Construct, id: string, props: LambdasProps) {
    super(scope, id);

    function resolveHandlersPath(): string {
      const entry = require.resolve("@mailshot/handlers");
      return path.join(path.dirname(entry), "../src");
    }
    const handlersPath = props.handlersPath ?? resolveHandlersPath();

    const commonBundling: nodejs.BundlingOptions = {
      minify: true,
      sourceMap: true,
      target: "node22",
      format: nodejs.OutputFormat.CJS,
      externalModules: [
        "@aws-sdk/client-dynamodb",
        "@aws-sdk/client-eventbridge",
        "@aws-sdk/client-s3",
        "@aws-sdk/client-sesv2",
        "@aws-sdk/client-sfn",
        "@aws-sdk/util-dynamodb",
      ],
    };

    const commonEnv = {
      NODE_OPTIONS: "--enable-source-maps",
      LOG_LEVEL: props.logLevel ?? "INFO",
      POWERTOOLS_LOG_DEDUPLICATION_DISABLED: "true",
      TABLE_NAME: props.table.tableName,
      EVENTS_TABLE_NAME: props.eventsTable.tableName,
      TEMPLATE_BUCKET: props.templateBucket.bucketName,
      SES_CONFIG_SET: props.sesConfigSetName,
      UNSUBSCRIBE_SECRET: props.unsubscribeSecret,
      EVENT_BUS_NAME: props.eventBusName ?? "",
      ...(props.dataTtlDays !== undefined ? { DATA_TTL_DAYS: String(props.dataTtlDays) } : {}),
    };

    // ── SendEmailFn ────────────────────────────────────────────────────
    this.sendEmailFn = new nodejs.NodejsFunction(this, "SendEmailFn", {
      entry: path.join(handlersPath, "handlers/send-email.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      bundling: commonBundling,
    });

    props.table.grantReadWriteData(this.sendEmailFn);
    props.templateBucket.grantRead(this.sendEmailFn);
    const stack = cdk.Stack.of(this);
    this.sendEmailFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail"],
        resources: [
          `arn:aws:ses:${stack.region}:${stack.account}:identity/*`,
          `arn:aws:ses:${stack.region}:${stack.account}:configuration-set/${props.sesConfigSetName}`,
        ],
      }),
    );

    // ── CheckConditionFn ───────────────────────────────────────────────
    this.checkConditionFn = new nodejs.NodejsFunction(this, "CheckConditionFn", {
      entry: path.join(handlersPath, "handlers/check-condition.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: commonBundling,
    });

    props.table.grantReadData(this.checkConditionFn);

    // ── UnsubscribeFn ──────────────────────────────────────────────────
    this.unsubscribeFn = new nodejs.NodejsFunction(this, "UnsubscribeFn", {
      entry: path.join(handlersPath, "handlers/unsubscribe.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: commonBundling,
    });

    props.table.grantReadWriteData(this.unsubscribeFn);
    // ses:PutSuppressedDestination does not support resource-level permissions - * is required
    this.unsubscribeFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:PutSuppressedDestination"],
        resources: ["*"],
      }),
    );

    const fnUrl = this.unsubscribeFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });
    this.unsubscribeFnUrl = fnUrl.url;

    // Only SendEmailFn needs the unsubscribe URL (to generate links in emails)
    this.sendEmailFn.addEnvironment("UNSUBSCRIBE_BASE_URL", fnUrl.url);

    // ── BounceHandlerFn ────────────────────────────────────────────────
    this.bounceHandlerFn = new nodejs.NodejsFunction(this, "BounceHandlerFn", {
      entry: path.join(handlersPath, "handlers/bounce-handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: commonBundling,
    });

    props.table.grantReadWriteData(this.bounceHandlerFn);
    // ses:PutSuppressedDestination does not support resource-level permissions - * is required
    this.bounceHandlerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:PutSuppressedDestination"],
        resources: ["*"],
      }),
    );

    // Subscribe to SES notifications
    props.snsTopic.addSubscription(new snsSubscriptions.LambdaSubscription(this.bounceHandlerFn));

    // ── EngagementHandlerFn ────────────────────────────────────────────
    this.engagementHandlerFn = new nodejs.NodejsFunction(this, "EngagementHandlerFn", {
      entry: path.join(handlersPath, "handlers/engagement-handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: commonBundling,
    });

    props.eventsTable.grantWriteData(this.engagementHandlerFn);

    // ── SequenceExitFn ─────────────────────────────────────────────
    this.sequenceExitFn = new nodejs.NodejsFunction(this, "SequenceExitFn", {
      entry: path.join(handlersPath, "handlers/sequence-exit.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: commonBundling,
    });

    props.table.grantReadWriteData(this.sequenceExitFn);

    // ── SubscribeFn ───────────────────────────────────────────────────
    this.subscribeFn = new nodejs.NodejsFunction(this, "SubscribeFn", {
      entry: path.join(handlersPath, "handlers/subscribe.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: commonBundling,
    });

    props.table.grantReadWriteData(this.subscribeFn);

    // ── Broadcast SQS queue + DLQ ─────────────────────────────────────
    const broadcastDlq = new sqs.Queue(this, "BroadcastSendDLQ", {
      retentionPeriod: cdk.Duration.days(14),
    });

    this.broadcastQueue = new sqs.Queue(this, "BroadcastSendQueue", {
      visibilityTimeout: cdk.Duration.seconds(60), // > SendEmailFn timeout
      deadLetterQueue: {
        queue: broadcastDlq,
        maxReceiveCount: 3,
      },
    });

    // SendEmailFn consumes from broadcast queue
    this.sendEmailFn.addEventSource(
      new lambdaEventSources.SqsEventSource(this.broadcastQueue, {
        batchSize: 1,
      }),
    );

    // ── BroadcastFn ───────────────────────────────────────────────────
    this.broadcastFn = new nodejs.NodejsFunction(this, "BroadcastFn", {
      functionName: props.broadcastFnName,
      entry: path.join(handlersPath, "handlers/broadcast.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.minutes(15),
      environment: {
        ...commonEnv,
        BROADCAST_QUEUE_URL: this.broadcastQueue.queueUrl,
      },
      bundling: {
        ...commonBundling,
        externalModules: [...(commonBundling.externalModules ?? []), "@aws-sdk/client-sqs"],
      },
    });

    props.table.grantReadWriteData(this.broadcastFn);
    this.broadcastQueue.grantSendMessages(this.broadcastFn);

    // ── ReplyHandlerFn (opt-in, requires replyTopic) ─────────────────
    if (props.replyTopic) {
      this.replyHandlerFn = new nodejs.NodejsFunction(this, "ReplyHandlerFn", {
        entry: path.join(handlersPath, "handlers/reply-handler.ts"),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        memorySize: 256,
        timeout: cdk.Duration.seconds(30),
        environment: commonEnv,
        bundling: commonBundling,
      });

      props.table.grantReadData(this.replyHandlerFn);
      props.eventsTable.grantWriteData(this.replyHandlerFn);

      if (props.eventBusName) {
        this.replyHandlerFn.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["events:PutEvents"],
            resources: [
              `arn:aws:events:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:event-bus/${props.eventBusName}`,
            ],
          }),
        );
      }

      if (props.replyForwardTo) {
        this.replyHandlerFn.addEnvironment("REPLY_FORWARD_TO", props.replyForwardTo);
        this.replyHandlerFn.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["ses:SendEmail", "ses:SendRawEmail"],
            resources: [
              `arn:aws:ses:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:identity/*`,
            ],
          }),
        );
      }

      props.replyTopic.addSubscription(
        new snsSubscriptions.LambdaSubscription(this.replyHandlerFn),
      );
    }
  }
}

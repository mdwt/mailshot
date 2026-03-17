import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface LambdasProps {
  table: dynamodb.Table;
  eventsTable: dynamodb.Table;
  templateBucket: s3.Bucket;
  ssmPrefix: string;
  snsTopic: sns.Topic;
  sesConfigSetName: string;
  logLevel?: string;
  handlersPath?: string;
}

export class LambdasConstruct extends Construct {
  public readonly sendEmailFn: nodejs.NodejsFunction;
  public readonly checkConditionFn: nodejs.NodejsFunction;
  public readonly unsubscribeFn: nodejs.NodejsFunction;
  public readonly bounceHandlerFn: nodejs.NodejsFunction;
  public readonly engagementHandlerFn: nodejs.NodejsFunction;
  public readonly unsubscribeFnUrl: string;

  constructor(scope: Construct, id: string, props: LambdasProps) {
    super(scope, id);

    function resolveHandlersPath(): string {
      const entry = require.resolve("@step-func-emailer/handlers");
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
        "@aws-sdk/client-s3",
        "@aws-sdk/client-sesv2",
        "@aws-sdk/client-sfn",
        "@aws-sdk/client-ssm",
        "@aws-sdk/util-dynamodb",
      ],
    };

    const commonEnv = {
      NODE_OPTIONS: "--enable-source-maps",
      SSM_PREFIX: props.ssmPrefix,
      LOG_LEVEL: props.logLevel ?? "INFO",
      POWERTOOLS_LOG_DEDUPLICATION_DISABLED: "true",
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
    this.grantSsmRead(this.sendEmailFn, props.ssmPrefix);

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
    this.grantSsmRead(this.checkConditionFn, props.ssmPrefix);

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
    // ses:PutSuppressedDestination does not support resource-level permissions — * is required
    this.unsubscribeFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:PutSuppressedDestination"],
        resources: ["*"],
      }),
    );
    this.grantSsmRead(this.unsubscribeFn, props.ssmPrefix);

    const fnUrl = this.unsubscribeFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });
    this.unsubscribeFnUrl = fnUrl.url;

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
    // ses:PutSuppressedDestination does not support resource-level permissions — * is required
    this.bounceHandlerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:PutSuppressedDestination"],
        resources: ["*"],
      }),
    );
    this.grantSsmRead(this.bounceHandlerFn, props.ssmPrefix);

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
    this.grantSsmRead(this.engagementHandlerFn, props.ssmPrefix);
  }

  private grantSsmRead(fn: lambda.Function, prefix: string): void {
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          cdk.Arn.format(
            {
              service: "ssm",
              resource: "parameter",
              resourceName: `${prefix.replace(/^\//, "")}/*`,
            },
            cdk.Stack.of(this),
          ),
        ],
      }),
    );
  }
}

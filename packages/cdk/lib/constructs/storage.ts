import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface StorageProps {
  tableName: string;
  eventsTableName: string;
  templateBucketName: string;
  sequenceIds: string[];
}

export class StorageConstruct extends Construct {
  public readonly table: dynamodb.Table;
  public readonly eventsTable: dynamodb.Table;
  public readonly templateBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, "Table", {
      tableName: props.tableName,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // ── Events table (engagement tracking) ─────────────────────────────
    this.eventsTable = new dynamodb.Table(this, "EventsTable", {
      tableName: props.eventsTableName,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    this.eventsTable.addGlobalSecondaryIndex({
      indexName: "TemplateIndex",
      partitionKey: { name: "templateKey", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.templateBucket = new s3.Bucket(this, "TemplateBucket", {
      bucketName: props.templateBucketName,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Deploy rendered templates from build/<sequenceId>/templates/ directories
    for (const seqId of props.sequenceIds) {
      new s3deploy.BucketDeployment(this, `DeployTemplates-${seqId}`, {
        sources: [
          s3deploy.Source.asset(path.join(__dirname, `../../../../build/${seqId}/templates`)),
        ],
        destinationBucket: this.templateBucket,
        destinationKeyPrefix: `${seqId}/`,
      });
    }
  }
}

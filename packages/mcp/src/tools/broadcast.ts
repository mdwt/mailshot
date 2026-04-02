import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { BROADCAST_PK } from "@mailshot/shared";
import type { McpConfig } from "../config.js";

let lambdaClient: LambdaClient;
let dynamo: DynamoDBClient;

function getLambda(region: string): LambdaClient {
  if (!lambdaClient) lambdaClient = new LambdaClient({ region });
  return lambdaClient;
}

function getDynamo(region: string): DynamoDBClient {
  if (!dynamo) dynamo = new DynamoDBClient({ region });
  return dynamo;
}

export interface SendBroadcastParams {
  broadcastId: string;
  templateKey: string;
  subject: string;
  senderFromEmail: string;
  senderFromName: string;
  senderReplyToEmail?: string;
  listUnsubscribe?: boolean;
  filterTags?: string[];
  filterAttributes?: Record<string, unknown>;
}

export async function sendBroadcast(config: McpConfig, params: SendBroadcastParams) {
  const client = getLambda(config.region);

  const payload: Record<string, unknown> = {
    broadcastId: params.broadcastId,
    templateKey: params.templateKey,
    subject: params.subject,
    sender: {
      fromEmail: params.senderFromEmail,
      fromName: params.senderFromName,
      ...(params.senderReplyToEmail && { replyToEmail: params.senderReplyToEmail }),
      ...(params.listUnsubscribe === false && { listUnsubscribe: false }),
    },
  };

  const filters: Record<string, unknown> = {};
  if (params.filterTags && params.filterTags.length > 0) {
    filters.tags = params.filterTags;
  }
  if (params.filterAttributes && Object.keys(params.filterAttributes).length > 0) {
    filters.attributes = params.filterAttributes;
  }
  if (Object.keys(filters).length > 0) {
    payload.filters = filters;
  }

  const result = await client.send(
    new InvokeCommand({
      FunctionName: config.broadcastFnName,
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );

  if (result.FunctionError) {
    const body = result.Payload ? JSON.parse(Buffer.from(result.Payload).toString()) : {};
    throw new Error(`BroadcastFn error: ${body.errorMessage ?? result.FunctionError}`);
  }

  const response = result.Payload ? JSON.parse(Buffer.from(result.Payload).toString()) : {};
  return response;
}

export async function getBroadcast(config: McpConfig, broadcastId: string) {
  const db = getDynamo(config.region);

  // broadcastId is the suffix of the SK after the timestamp — filter for it
  const result = await db.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: "PK = :pk",
      FilterExpression: "broadcastId = :bid",
      ExpressionAttributeValues: marshall({
        ":pk": BROADCAST_PK,
        ":bid": broadcastId,
      }),
      ScanIndexForward: false,
      Limit: 100,
    }),
  );

  const items = (result.Items ?? []).map((i) => unmarshall(i));
  return items.length > 0 ? items[0] : null;
}

export async function listBroadcasts(config: McpConfig, limit: number) {
  const db = getDynamo(config.region);

  const result = await db.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": BROADCAST_PK }),
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
    }),
  );

  return (result.Items ?? []).map((i) => unmarshall(i));
}

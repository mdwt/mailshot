import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
  BatchGetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { BROADCAST_PK, statsPK, STATS_COUNTERS_SK } from "@mailshot/shared";
import type { McpConfig } from "../config.js";

const COUNTER_FIELDS = [
  "deliveryCount",
  "openCount",
  "clickCount",
  "bounceCount",
  "complaintCount",
] as const;

function emptyCounters(): Record<string, number> {
  return Object.fromEntries(COUNTER_FIELDS.map((f) => [f, 0]));
}

function pickCounters(item: Record<string, unknown>): Record<string, number> {
  const out = emptyCounters();
  for (const f of COUNTER_FIELDS) {
    const v = item[f];
    if (typeof v === "number") out[f] = v;
  }
  return out;
}

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
  dryRun?: boolean;
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
  if (params.dryRun) {
    payload.dryRun = true;
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
  if (items.length === 0) return null;
  const record = items[0];

  // Merge denormalised counters from STATS#<broadcastId>/COUNTERS
  const countersRes = await db.send(
    new GetItemCommand({
      TableName: config.tableName,
      Key: marshall({ PK: statsPK(broadcastId), SK: STATS_COUNTERS_SK }),
    }),
  );
  const counters = countersRes.Item ? pickCounters(unmarshall(countersRes.Item)) : emptyCounters();
  return { ...record, ...counters };
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

  const records = (result.Items ?? []).map((i) => unmarshall(i));
  if (records.length === 0) return records;

  // Batch fetch counters for all broadcastIds (chunked at 100, the BatchGetItem limit)
  const broadcastIds = records
    .map((r) => r.broadcastId)
    .filter((id): id is string => typeof id === "string");
  const countersByBroadcastId = new Map<string, Record<string, number>>();

  for (let i = 0; i < broadcastIds.length; i += 100) {
    const chunk = broadcastIds.slice(i, i + 100);
    const res = await db.send(
      new BatchGetItemCommand({
        RequestItems: {
          [config.tableName]: {
            Keys: chunk.map((id) => marshall({ PK: statsPK(id), SK: STATS_COUNTERS_SK })),
          },
        },
      }),
    );
    const items = res.Responses?.[config.tableName] ?? [];
    for (const item of items) {
      const u = unmarshall(item);
      if (typeof u.sequenceId === "string") {
        countersByBroadcastId.set(u.sequenceId, pickCounters(u));
      }
    }
  }

  return records.map((r) => ({
    ...r,
    ...(typeof r.broadcastId === "string"
      ? (countersByBroadcastId.get(r.broadcastId) ?? emptyCounters())
      : emptyCounters()),
  }));
}

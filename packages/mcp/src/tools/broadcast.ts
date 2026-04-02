import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DynamoDBClient, GetItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { broadcastPK, BCAST_META_SK, BCAST_PK_PREFIX } from "@mailshot/shared";
import type { McpConfig } from "../config.js";

let eventBridge: EventBridgeClient;
let dynamo: DynamoDBClient;

function getEventBridge(region: string): EventBridgeClient {
  if (!eventBridge) eventBridge = new EventBridgeClient({ region });
  return eventBridge;
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
  const eb = getEventBridge(config.region);

  const detail: Record<string, unknown> = {
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
    detail.filters = filters;
  }

  const result = await eb.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "mailshot.mcp",
          DetailType: "broadcast.requested",
          EventBusName: config.eventBusName,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );

  const failed = result.FailedEntryCount ?? 0;
  if (failed > 0) {
    const entry = result.Entries?.[0];
    throw new Error(
      `Failed to publish broadcast event: ${entry?.ErrorCode} - ${entry?.ErrorMessage}`,
    );
  }

  return {
    published: true,
    broadcastId: params.broadcastId,
    eventId: result.Entries?.[0]?.EventId,
  };
}

export async function getBroadcast(config: McpConfig, broadcastId: string) {
  const db = getDynamo(config.region);
  const result = await db.send(
    new GetItemCommand({
      TableName: config.tableName,
      Key: marshall({ PK: broadcastPK(broadcastId), SK: BCAST_META_SK }),
    }),
  );
  return result.Item ? unmarshall(result.Item) : null;
}

export async function listBroadcasts(config: McpConfig, limit: number) {
  const db = getDynamo(config.region);
  const result = await db.send(
    new ScanCommand({
      TableName: config.tableName,
      FilterExpression: "begins_with(PK, :prefix) AND SK = :sk",
      ExpressionAttributeValues: marshall({
        ":prefix": BCAST_PK_PREFIX,
        ":sk": BCAST_META_SK,
      }),
      Limit: Math.min(limit, 100) * 10,
    }),
  );

  return (result.Items ?? [])
    .map((i) => unmarshall(i))
    .sort((a, b) => (b.sentAt as string).localeCompare(a.sentAt as string))
    .slice(0, limit);
}

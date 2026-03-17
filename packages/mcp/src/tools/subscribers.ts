import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { SFNClient, StopExecutionCommand } from "@aws-sdk/client-sfn";
import {
  subscriberPK,
  PROFILE_SK,
  EXEC_SK_PREFIX,
  SENT_SK_PREFIX,
  SUPPRESSION_SK,
} from "@mailshot/shared";
import type { McpConfig } from "../config.js";

let dynamo: DynamoDBClient;
let sfn: SFNClient;

function getDynamo(region: string): DynamoDBClient {
  if (!dynamo) dynamo = new DynamoDBClient({ region });
  return dynamo;
}

function getSfn(region: string): SFNClient {
  if (!sfn) sfn = new SFNClient({ region });
  return sfn;
}

export async function getSubscriber(config: McpConfig, email: string) {
  const db = getDynamo(config.region);
  const pk = subscriberPK(email);

  // Get all items for this subscriber in one query
  const result = await db.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": pk }),
    }),
  );

  const items = (result.Items ?? []).map((i) => unmarshall(i));
  const profile = items.find((i) => i.SK === PROFILE_SK) ?? null;
  const executions = items.filter((i) => (i.SK as string).startsWith(EXEC_SK_PREFIX));
  const sendLog = items
    .filter((i) => (i.SK as string).startsWith(SENT_SK_PREFIX))
    .sort((a, b) => (b.SK as string).localeCompare(a.SK as string))
    .slice(0, 20);
  const suppression = items.find((i) => i.SK === SUPPRESSION_SK) ?? null;

  return { profile, executions, sendLog, suppression };
}

export async function listSubscribers(
  config: McpConfig,
  status: string | undefined,
  limit: number,
) {
  const db = getDynamo(config.region);

  let filterExpression: string | undefined;
  const expressionValues: Record<string, unknown> = {
    ":sk": PROFILE_SK,
  };

  if (status === "active") {
    filterExpression = "SK = :sk AND unsubscribed = :false AND suppressed = :false";
    expressionValues[":false"] = false;
  } else if (status === "unsubscribed") {
    filterExpression = "SK = :sk AND unsubscribed = :true";
    expressionValues[":true"] = true;
  } else if (status === "suppressed") {
    filterExpression = "SK = :sk AND suppressed = :true";
    expressionValues[":true"] = true;
  } else {
    filterExpression = "SK = :sk";
  }

  const result = await db.send(
    new ScanCommand({
      TableName: config.tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: marshall(expressionValues),
      Limit: Math.min(limit, 100) * 10, // overscan since filter is post-scan
    }),
  );

  return (result.Items ?? []).map((i) => unmarshall(i)).slice(0, limit);
}

export async function updateSubscriber(
  config: McpConfig,
  email: string,
  attributes: Record<string, unknown>,
) {
  const db = getDynamo(config.region);

  const parts: string[] = [];
  const values: Record<string, unknown> = {
    ":now": new Date().toISOString(),
  };
  const names: Record<string, string> = {};

  for (const [key, value] of Object.entries(attributes)) {
    parts.push(`#attr_${key} = :attr_${key}`);
    names[`#attr_${key}`] = key;
    values[`:attr_${key}`] = value;
  }

  await db.send(
    new UpdateItemCommand({
      TableName: config.tableName,
      Key: marshall({ PK: subscriberPK(email), SK: PROFILE_SK }),
      UpdateExpression: `SET ${parts.join(", ")}, updatedAt = :now`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: marshall(values),
      ConditionExpression: "attribute_exists(PK)",
    }),
  );

  return { updated: true };
}

export async function deleteSubscriber(config: McpConfig, email: string) {
  const db = getDynamo(config.region);
  const pk = subscriberPK(email);

  // Delete from main table
  const mainItems = await db.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": pk }),
      ProjectionExpression: "PK, SK",
    }),
  );

  // Delete from events table
  const eventItems = await db.send(
    new QueryCommand({
      TableName: config.eventsTableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": pk }),
      ProjectionExpression: "PK, SK",
    }),
  );

  const allDeletes = [
    ...(mainItems.Items ?? []).map((item) => ({
      tableName: config.tableName,
      key: item as Record<string, AttributeValue>,
    })),
    ...(eventItems.Items ?? []).map((item) => ({
      tableName: config.eventsTableName,
      key: item as Record<string, AttributeValue>,
    })),
  ];

  // Delete items individually (simpler and avoids BatchWrite type complexity)
  for (const item of allDeletes) {
    await db.send(
      new DeleteItemCommand({
        TableName: item.tableName,
        Key: item.key,
      }),
    );
  }

  return { deleted: true, itemCount: allDeletes.length };
}

export async function unsubscribeSubscriber(config: McpConfig, email: string) {
  const db = getDynamo(config.region);
  const sfnClient = getSfn(config.region);
  const pk = subscriberPK(email);

  // Set unsubscribed flag
  await db.send(
    new UpdateItemCommand({
      TableName: config.tableName,
      Key: marshall({ PK: pk, SK: PROFILE_SK }),
      UpdateExpression: "SET unsubscribed = :val, updatedAt = :now",
      ExpressionAttributeValues: marshall({
        ":val": true,
        ":now": new Date().toISOString(),
      }),
    }),
  );

  // Stop all active executions
  const execResult = await db.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: marshall({
        ":pk": pk,
        ":prefix": EXEC_SK_PREFIX,
      }),
    }),
  );

  const executions = (execResult.Items ?? []).map((i) => unmarshall(i));
  for (const exec of executions) {
    try {
      await sfnClient.send(
        new StopExecutionCommand({
          executionArn: exec.executionArn as string,
          cause: "Subscriber unsubscribed via MCP",
        }),
      );
    } catch {
      // Execution may already be stopped
    }
    await db.send(
      new DeleteItemCommand({
        TableName: config.tableName,
        Key: marshall({ PK: pk, SK: exec.SK }),
      }),
    );
  }

  return { unsubscribed: true, executionsStopped: executions.length };
}

export async function resubscribeSubscriber(config: McpConfig, email: string) {
  const db = getDynamo(config.region);

  await db.send(
    new UpdateItemCommand({
      TableName: config.tableName,
      Key: marshall({ PK: subscriberPK(email), SK: PROFILE_SK }),
      UpdateExpression: "SET unsubscribed = :val, updatedAt = :now",
      ExpressionAttributeValues: marshall({
        ":val": false,
        ":now": new Date().toISOString(),
      }),
      ConditionExpression: "attribute_exists(PK)",
    }),
  );

  return { resubscribed: true };
}

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  subscriberPK,
  PROFILE_SK,
  executionSK,
  sentSK,
  SUPPRESSION_SK,
  EXEC_SK_PREFIX,
  SENT_SK_PREFIX,
  SEND_LOG_TTL_DAYS,
} from "@step-func-emailer/shared";
import type {
  Subscriber,
  SubscriberProfile,
  ActiveExecution,
  SendLog,
} from "@step-func-emailer/shared";

const dynamo = new DynamoDBClient({});

// ── Subscriber profile ──────────────────────────────────────────────────────

export async function getSubscriberProfile(
  tableName: string,
  email: string,
): Promise<SubscriberProfile | null> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ PK: subscriberPK(email), SK: PROFILE_SK }),
    }),
  );
  return result.Item ? (unmarshall(result.Item) as SubscriberProfile) : null;
}

export async function upsertSubscriberProfile(
  tableName: string,
  subscriber: Subscriber,
): Promise<void> {
  const now = new Date().toISOString();
  const pk = subscriberPK(subscriber.email);
  const attrs = subscriber.attributes ?? {};

  // Build SET expressions — never overwrite unsubscribed or suppressed
  const expressionParts = [
    "email = :email",
    "firstName = :firstName",
    "updatedAt = :updatedAt",
  ];
  const expressionValues: Record<string, unknown> = {
    ":email": subscriber.email,
    ":firstName": subscriber.firstName,
    ":updatedAt": now,
    ":createdAt": now,
    ":defaultFalse": false,
  };

  // Merge attributes
  for (const [key, value] of Object.entries(attrs)) {
    expressionParts.push(`attributes.#attr_${key} = :attr_${key}`);
    expressionValues[`:attr_${key}`] = value;
  }

  const expressionNames: Record<string, string> = {};
  for (const key of Object.keys(attrs)) {
    expressionNames[`#attr_${key}`] = key;
  }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ PK: pk, SK: PROFILE_SK }),
      UpdateExpression: `SET ${expressionParts.join(", ")}, createdAt = if_not_exists(createdAt, :createdAt), unsubscribed = if_not_exists(unsubscribed, :defaultFalse), suppressed = if_not_exists(suppressed, :defaultFalse), attributes = if_not_exists(attributes, :emptyMap)`,
      ExpressionAttributeValues: marshall({
        ...expressionValues,
        ":emptyMap": {},
      }),
      ...(Object.keys(expressionNames).length > 0
        ? { ExpressionAttributeNames: expressionNames }
        : {}),
    }),
  );
}

// ── Active executions ───────────────────────────────────────────────────────

export async function getExecution(
  tableName: string,
  email: string,
  sequenceId: string,
): Promise<ActiveExecution | null> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({
        PK: subscriberPK(email),
        SK: executionSK(sequenceId),
      }),
    }),
  );
  return result.Item ? (unmarshall(result.Item) as ActiveExecution) : null;
}

export async function putExecution(
  tableName: string,
  email: string,
  sequenceId: string,
  executionArn: string,
): Promise<void> {
  await dynamo.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall({
        PK: subscriberPK(email),
        SK: executionSK(sequenceId),
        executionArn,
        sequenceId,
        startedAt: new Date().toISOString(),
      }),
    }),
  );
}

export async function deleteExecution(
  tableName: string,
  email: string,
  sequenceId: string,
): Promise<void> {
  await dynamo.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: marshall({
        PK: subscriberPK(email),
        SK: executionSK(sequenceId),
      }),
    }),
  );
}

export async function getAllExecutions(
  tableName: string,
  email: string,
): Promise<ActiveExecution[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: marshall({
        ":pk": subscriberPK(email),
        ":prefix": EXEC_SK_PREFIX,
      }),
    }),
  );
  return (result.Items ?? []).map((item) => unmarshall(item) as ActiveExecution);
}

// ── Send log ────────────────────────────────────────────────────────────────

export async function writeSendLog(
  tableName: string,
  email: string,
  log: Omit<SendLog, "PK" | "SK" | "ttl">,
): Promise<void> {
  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + SEND_LOG_TTL_DAYS * 86400;
  await dynamo.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall({
        PK: subscriberPK(email),
        SK: sentSK(now.toISOString()),
        ...log,
        ttl,
      }),
    }),
  );
}

export async function countRecentSends(
  tableName: string,
  email: string,
  windowHours: number,
): Promise<number> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowHours * 3600 * 1000);

  const result = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression:
        "PK = :pk AND SK BETWEEN :start AND :end",
      ExpressionAttributeValues: marshall({
        ":pk": subscriberPK(email),
        ":start": sentSK(windowStart.toISOString()),
        ":end": sentSK(now.toISOString()),
      }),
      Select: "COUNT",
    }),
  );
  return result.Count ?? 0;
}

export async function hasBeenSent(
  tableName: string,
  email: string,
  templateKey: string,
): Promise<boolean> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "templateKey = :templateKey",
      ExpressionAttributeValues: marshall({
        ":pk": subscriberPK(email),
        ":prefix": SENT_SK_PREFIX,
        ":templateKey": templateKey,
      }),
      Limit: 1,
    }),
  );
  return (result.Count ?? 0) > 0;
}

// ── Suppression ─────────────────────────────────────────────────────────────

export async function writeSuppression(
  tableName: string,
  email: string,
  reason: "bounce" | "complaint",
  bounceType: string | undefined,
  sesNotificationId: string,
): Promise<void> {
  await dynamo.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall({
        PK: subscriberPK(email),
        SK: SUPPRESSION_SK,
        reason,
        ...(bounceType ? { bounceType } : {}),
        sesNotificationId,
        recordedAt: new Date().toISOString(),
      }),
    }),
  );
}

export async function setProfileFlag(
  tableName: string,
  email: string,
  flag: "unsubscribed" | "suppressed",
): Promise<void> {
  await dynamo.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ PK: subscriberPK(email), SK: PROFILE_SK }),
      UpdateExpression: `SET #flag = :val, updatedAt = :now`,
      ExpressionAttributeNames: { "#flag": flag },
      ExpressionAttributeValues: marshall({
        ":val": true,
        ":now": new Date().toISOString(),
      }),
    }),
  );
}

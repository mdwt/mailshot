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
} from "@mailshot/shared";
import type { Subscriber, SubscriberProfile, ActiveExecution, SendLog } from "@mailshot/shared";
import { createLogger } from "./logger.js";

const logger = createLogger("dynamo-client");
const dynamo = new DynamoDBClient({});

// ── Subscriber profile ──────────────────────────────────────────────────────

export async function getSubscriberProfile(
  tableName: string,
  email: string,
): Promise<SubscriberProfile | null> {
  logger.debug("Getting subscriber profile", { email });
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ PK: subscriberPK(email), SK: PROFILE_SK }),
    }),
  );
  const profile = result.Item ? (unmarshall(result.Item) as SubscriberProfile) : null;
  logger.debug("Subscriber profile result", {
    email,
    found: !!profile,
    unsubscribed: profile?.unsubscribed,
    suppressed: profile?.suppressed,
  });
  return profile;
}

const SYSTEM_KEYS = new Set([
  "PK",
  "SK",
  "email",
  "firstName",
  "unsubscribed",
  "suppressed",
  "createdAt",
  "updatedAt",
]);

export function extractAttributes(profile: Record<string, unknown>): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (!SYSTEM_KEYS.has(key)) {
      attrs[key] = value;
    }
  }
  return attrs;
}

export async function upsertSubscriberProfile(
  tableName: string,
  subscriber: Subscriber,
): Promise<void> {
  const now = new Date().toISOString();
  const pk = subscriberPK(subscriber.email);
  const rawAttrs = subscriber.attributes ?? {};
  // Filter out system keys to avoid duplicate paths in the UpdateExpression
  const attrs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawAttrs)) {
    if (!SYSTEM_KEYS.has(key)) {
      attrs[key] = value;
    }
  }

  logger.info("Upserting subscriber profile", {
    email: subscriber.email,
    firstName: subscriber.firstName,
    attributeCount: Object.keys(attrs).length,
  });

  // Build SET expressions — never overwrite unsubscribed or suppressed
  const expressionParts = ["email = :email", "firstName = :firstName", "updatedAt = :updatedAt"];
  const expressionValues: Record<string, unknown> = {
    ":email": subscriber.email,
    ":firstName": subscriber.firstName,
    ":updatedAt": now,
    ":createdAt": now,
    ":defaultFalse": false,
  };

  const expressionNames: Record<string, string> = {};

  // Write each attribute as a top-level column
  for (const [key, value] of Object.entries(attrs)) {
    expressionParts.push(`#attr_${key} = :attr_${key}`);
    expressionNames[`#attr_${key}`] = key;
    expressionValues[`:attr_${key}`] = value;
  }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ PK: pk, SK: PROFILE_SK }),
      UpdateExpression: `SET ${expressionParts.join(", ")}, createdAt = if_not_exists(createdAt, :createdAt), unsubscribed = if_not_exists(unsubscribed, :defaultFalse), suppressed = if_not_exists(suppressed, :defaultFalse)`,
      ExpressionAttributeValues: marshall(expressionValues),
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
  logger.debug("Getting execution", { email, sequenceId });
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
  logger.info("Storing execution", { email, sequenceId, executionArn });
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
  logger.info("Deleting execution", { email, sequenceId });
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
  logger.debug("Querying all executions", { email });
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
  const executions = (result.Items ?? []).map((item) => unmarshall(item) as ActiveExecution);
  logger.debug("Found executions", { email, count: executions.length });
  return executions;
}

// ── Send log ────────────────────────────────────────────────────────────────

export async function writeSendLog(
  tableName: string,
  email: string,
  log: Omit<SendLog, "PK" | "SK" | "ttl">,
): Promise<void> {
  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + SEND_LOG_TTL_DAYS * 86400;
  logger.info("Writing send log", {
    email,
    templateKey: log.templateKey,
    sequenceId: log.sequenceId,
    sesMessageId: log.sesMessageId,
  });
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

export async function hasBeenSent(
  tableName: string,
  email: string,
  templateKey: string,
): Promise<boolean> {
  logger.debug("Checking if template has been sent", { email, templateKey });
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
  const sent = (result.Count ?? 0) > 0;
  logger.debug("Has been sent result", { email, templateKey, sent });
  return sent;
}

// ── Suppression ─────────────────────────────────────────────────────────────

export async function writeSuppression(
  tableName: string,
  email: string,
  reason: "bounce" | "complaint",
  bounceType: string | undefined,
  sesNotificationId: string,
): Promise<void> {
  logger.warn("Writing suppression record", { email, reason, bounceType, sesNotificationId });
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
  logger.warn("Setting profile flag", { email, flag });
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

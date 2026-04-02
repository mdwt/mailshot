import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
  ScanCommand,
  BatchGetItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  subscriberPK,
  PROFILE_SK,
  executionSK,
  sentSK,
  SUPPRESSION_SK,
  EXEC_SK_PREFIX,
  SENT_SK_PREFIX,
  tagPK,
  BROADCAST_PK,
  broadcastSK,
} from "@mailshot/shared";
import type {
  Subscriber,
  SubscriberProfile,
  ActiveExecution,
  SendLog,
  TagItem,
  SenderConfig,
  BroadcastFilters,
} from "@mailshot/shared";
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
  "tags",
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

  // Build SET expressions - never overwrite unsubscribed or suppressed
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

  // Sync tags if provided
  if (subscriber.tags && subscriber.tags.length > 0) {
    await syncTags(tableName, subscriber.email, subscriber.tags);
  }
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
  ttlDays?: number,
): Promise<void> {
  const now = new Date();
  const ttl = ttlDays ? Math.floor(now.getTime() / 1000) + ttlDays * 86400 : undefined;
  logger.info("Writing send log", {
    email,
    templateKey: log.templateKey,
    sequenceId: log.sequenceId,
    sesMessageId: log.sesMessageId,
  });
  await dynamo.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(
        {
          PK: subscriberPK(email),
          SK: sentSK(now.toISOString()),
          ...log,
          ...(ttl !== undefined ? { ttl } : {}),
        },
        { removeUndefinedValues: true },
      ),
    }),
  );
}

export async function getSendLogByMessageId(
  tableName: string,
  email: string,
  sesMessageId: string,
): Promise<SendLog | null> {
  logger.debug("Querying send log by message ID", { email, sesMessageId });
  const result = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "sesMessageId = :msgId",
      ExpressionAttributeValues: marshall({
        ":pk": subscriberPK(email),
        ":prefix": SENT_SK_PREFIX,
        ":msgId": sesMessageId,
      }),
      Limit: 1,
    }),
  );
  if (result.Items && result.Items.length > 0) {
    return unmarshall(result.Items[0]) as SendLog;
  }
  return null;
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

// ── Tags (inverted index) ──────────────────────────────────────────────────

export async function syncTags(tableName: string, email: string, newTags: string[]): Promise<void> {
  logger.info("Syncing tags", { email, tagCount: newTags.length });
  const pk = subscriberPK(email);

  // Read current tags from PROFILE
  const profile = await getSubscriberProfile(tableName, email);
  const currentTags = new Set<string>(
    profile && Array.isArray((profile as Record<string, unknown>).tags)
      ? ((profile as Record<string, unknown>).tags as string[])
      : [],
  );
  const desired = new Set(newTags);

  // Tags to add (in desired but not in current)
  const toAdd = newTags.filter((t) => !currentTags.has(t));
  // Tags to remove (in current but not in desired)
  const toRemove = [...currentTags].filter((t) => !desired.has(t));

  // Write new inverted index items
  const now = new Date().toISOString();
  for (const tag of toAdd) {
    await dynamo.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall({
          PK: tagPK(tag),
          SK: pk,
          email,
          taggedAt: now,
        }),
      }),
    );
  }

  // Delete removed inverted index items
  for (const tag of toRemove) {
    await dynamo.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: marshall({ PK: tagPK(tag), SK: pk }),
      }),
    );
  }

  // Update tags String Set on PROFILE
  if (newTags.length > 0) {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: marshall({ PK: pk, SK: PROFILE_SK }),
        UpdateExpression: "SET #tags = :tags, updatedAt = :now",
        ExpressionAttributeNames: { "#tags": "tags" },
        ExpressionAttributeValues: marshall({
          ":tags": newTags,
          ":now": now,
        }),
      }),
    );
  } else if (toRemove.length > 0) {
    // All tags removed — delete the attribute
    await dynamo.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: marshall({ PK: pk, SK: PROFILE_SK }),
        UpdateExpression: "REMOVE #tags SET updatedAt = :now",
        ExpressionAttributeNames: { "#tags": "tags" },
        ExpressionAttributeValues: marshall({ ":now": now }),
      }),
    );
  }

  logger.info("Tags synced", { email, added: toAdd.length, removed: toRemove.length });
}

export async function getSubscriberEmailsByTag(tableName: string, tag: string): Promise<string[]> {
  logger.debug("Querying subscribers by tag", { tag });
  const emails: string[] = [];
  let lastKey: Record<string, AttributeValue> | undefined;

  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: marshall({ ":pk": tagPK(tag) }),
        ProjectionExpression: "email",
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of result.Items ?? []) {
      const record = unmarshall(item) as TagItem;
      emails.push(record.email);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  logger.debug("Subscribers found for tag", { tag, count: emails.length });
  return emails;
}

export async function batchGetSubscriberProfiles(
  tableName: string,
  emails: string[],
): Promise<SubscriberProfile[]> {
  if (emails.length === 0) return [];

  const profiles: SubscriberProfile[] = [];
  // DynamoDB BatchGetItem supports max 100 keys per request
  const batchSize = 100;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const keys = batch.map((email) => marshall({ PK: subscriberPK(email), SK: PROFILE_SK }));

    const result = await dynamo.send(
      new BatchGetItemCommand({
        RequestItems: {
          [tableName]: { Keys: keys },
        },
      }),
    );

    for (const item of result.Responses?.[tableName] ?? []) {
      profiles.push(unmarshall(item) as SubscriberProfile);
    }
  }

  return profiles;
}

export async function scanActiveSubscribers(
  tableName: string,
  attributeFilters?: Record<string, unknown>,
): Promise<SubscriberProfile[]> {
  logger.debug("Scanning active subscribers", { attributeFilters });
  const subscribers: SubscriberProfile[] = [];
  let lastKey: Record<string, AttributeValue> | undefined;

  // Build filter expression
  const filterParts = ["SK = :sk", "unsubscribed = :false", "suppressed = :false"];
  const expressionValues: Record<string, unknown> = {
    ":sk": PROFILE_SK,
    ":false": false,
  };
  const expressionNames: Record<string, string> = {};

  if (attributeFilters) {
    for (const [key, value] of Object.entries(attributeFilters)) {
      const safeKey = key.replace(/[^a-zA-Z0-9]/g, "_");
      filterParts.push(`#flt_${safeKey} = :flt_${safeKey}`);
      expressionNames[`#flt_${safeKey}`] = key;
      expressionValues[`:flt_${safeKey}`] = value;
    }
  }

  do {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: filterParts.join(" AND "),
        ExpressionAttributeValues: marshall(expressionValues),
        ...(Object.keys(expressionNames).length > 0
          ? { ExpressionAttributeNames: expressionNames }
          : {}),
        ExclusiveStartKey: lastKey,
      }),
    );

    for (const item of result.Items ?? []) {
      subscribers.push(unmarshall(item) as SubscriberProfile);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  logger.debug("Active subscribers found", { count: subscribers.length });
  return subscribers;
}

// ── Broadcast records ──────────────────────────────────────────────────────

export async function writeBroadcastRecord(
  tableName: string,
  params: {
    broadcastId: string;
    templateKey: string;
    subject: string;
    sender: SenderConfig;
    filters?: BroadcastFilters;
    subscriberCount: number;
  },
): Promise<void> {
  logger.info("Writing broadcast record", {
    broadcastId: params.broadcastId,
    subscriberCount: params.subscriberCount,
  });
  const sentAt = new Date().toISOString();
  await dynamo.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(
        {
          PK: BROADCAST_PK,
          SK: broadcastSK(sentAt, params.broadcastId),
          broadcastId: params.broadcastId,
          templateKey: params.templateKey,
          subject: params.subject,
          sender: params.sender,
          filters: params.filters,
          subscriberCount: params.subscriberCount,
          sentAt,
        },
        { removeUndefinedValues: true },
      ),
    }),
  );
}

import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { subscriberPK, EVT_SK_PREFIX, TEMPLATE_INDEX, SEQUENCE_INDEX } from "@mailshot/shared";
import type { McpConfig } from "../config.js";

let dynamo: DynamoDBClient;

function getDynamo(region: string): DynamoDBClient {
  if (!dynamo) dynamo = new DynamoDBClient({ region });
  return dynamo;
}

function buildSkRange(
  startDate: string | undefined,
  endDate: string | undefined,
): { expression: string; values: Record<string, unknown> } | null {
  if (startDate && endDate) {
    return {
      expression: "SK BETWEEN :skStart AND :skEnd",
      values: {
        ":skStart": `${EVT_SK_PREFIX}${startDate}`,
        ":skEnd": `${EVT_SK_PREFIX}${endDate}~`,
      },
    };
  }
  return {
    expression: "begins_with(SK, :skPrefix)",
    values: { ":skPrefix": EVT_SK_PREFIX },
  };
}

export async function getSubscriberEvents(
  config: McpConfig,
  email: string,
  eventType: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  limit: number,
) {
  const db = getDynamo(config.region);
  const pk = subscriberPK(email);
  const skRange = buildSkRange(startDate, endDate);

  const filterParts: string[] = [];
  const filterValues: Record<string, unknown> = {};

  if (eventType) {
    filterParts.push("eventType = :eventType");
    filterValues[":eventType"] = eventType;
  }

  const result = await db.send(
    new QueryCommand({
      TableName: config.eventsTableName,
      KeyConditionExpression: `PK = :pk AND ${skRange!.expression}`,
      ...(filterParts.length > 0 ? { FilterExpression: filterParts.join(" AND ") } : {}),
      ExpressionAttributeValues: marshall({
        ":pk": pk,
        ...skRange!.values,
        ...filterValues,
      }),
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
    }),
  );

  return (result.Items ?? []).map((i) => unmarshall(i));
}

export async function getTemplateEvents(
  config: McpConfig,
  templateKey: string,
  eventType: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  limit: number,
) {
  const db = getDynamo(config.region);
  const skRange = buildSkRange(startDate, endDate);

  const filterParts: string[] = [];
  const filterValues: Record<string, unknown> = {};

  if (eventType) {
    filterParts.push("eventType = :eventType");
    filterValues[":eventType"] = eventType;
  }

  const result = await db.send(
    new QueryCommand({
      TableName: config.eventsTableName,
      IndexName: TEMPLATE_INDEX,
      KeyConditionExpression: `templateKey = :tk AND ${skRange!.expression}`,
      ...(filterParts.length > 0 ? { FilterExpression: filterParts.join(" AND ") } : {}),
      ExpressionAttributeValues: marshall({
        ":tk": templateKey,
        ...skRange!.values,
        ...filterValues,
      }),
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
    }),
  );

  return (result.Items ?? []).map((i) => unmarshall(i));
}

export async function getSequenceEvents(
  config: McpConfig,
  sequenceId: string,
  eventType: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  limit: number,
) {
  const db = getDynamo(config.region);
  const skRange = buildSkRange(startDate, endDate);

  const filterParts: string[] = [];
  const filterValues: Record<string, unknown> = {};

  if (eventType) {
    filterParts.push("eventType = :eventType");
    filterValues[":eventType"] = eventType;
  }

  const result = await db.send(
    new QueryCommand({
      TableName: config.eventsTableName,
      IndexName: SEQUENCE_INDEX,
      KeyConditionExpression: `sequenceId = :seqId AND ${skRange!.expression}`,
      ...(filterParts.length > 0 ? { FilterExpression: filterParts.join(" AND ") } : {}),
      ExpressionAttributeValues: marshall({
        ":seqId": sequenceId,
        ...skRange!.values,
        ...filterValues,
      }),
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
    }),
  );

  return (result.Items ?? []).map((i) => unmarshall(i));
}

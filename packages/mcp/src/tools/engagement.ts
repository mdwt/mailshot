import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  subscriberPK,
  EVT_SK_PREFIX,
  TEMPLATE_INDEX,
} from "@step-func-emailer/shared";
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
      ...(filterParts.length > 0
        ? { FilterExpression: filterParts.join(" AND ") }
        : {}),
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
      ...(filterParts.length > 0
        ? { FilterExpression: filterParts.join(" AND ") }
        : {}),
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

  // No GSI on sequenceId, so we scan with filter
  const filterParts = ["sequenceId = :seqId"];
  const filterValues: Record<string, unknown> = { ":seqId": sequenceId };

  if (eventType) {
    filterParts.push("eventType = :eventType");
    filterValues[":eventType"] = eventType;
  }
  if (startDate) {
    filterParts.push("SK >= :skStart");
    filterValues[":skStart"] = `${EVT_SK_PREFIX}${startDate}`;
  }
  if (endDate) {
    filterParts.push("SK <= :skEnd");
    filterValues[":skEnd"] = `${EVT_SK_PREFIX}${endDate}~`;
  }

  const result = await db.send(
    new ScanCommand({
      TableName: config.eventsTableName,
      FilterExpression: filterParts.join(" AND "),
      ExpressionAttributeValues: marshall(filterValues),
      Limit: Math.min(limit, 100) * 10,
    }),
  );

  return (result.Items ?? [])
    .map((i) => unmarshall(i))
    .sort((a, b) => (b.SK as string).localeCompare(a.SK as string))
    .slice(0, limit);
}

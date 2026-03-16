import {
  SFNClient,
  ListExecutionsCommand,
  ExecutionStatus,
} from "@aws-sdk/client-sfn";
import {
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { EVT_SK_PREFIX } from "@step-func-emailer/shared";
import type { McpConfig } from "../config.js";

let sfn: SFNClient;
let dynamo: DynamoDBClient;

function getSfn(region: string): SFNClient {
  if (!sfn) sfn = new SFNClient({ region });
  return sfn;
}

function getDynamo(region: string): DynamoDBClient {
  if (!dynamo) dynamo = new DynamoDBClient({ region });
  return dynamo;
}

export async function getFailedExecutions(
  config: McpConfig,
  stateMachineArn: string | undefined,
  startDate: string | undefined,
  limit: number,
) {
  if (!stateMachineArn) {
    return {
      error:
        "stateMachineArn is required. Pass the ARN of the state machine to check.",
    };
  }

  const sfnClient = getSfn(config.region);

  const result = await sfnClient.send(
    new ListExecutionsCommand({
      stateMachineArn,
      statusFilter: ExecutionStatus.FAILED,
      maxResults: Math.min(limit, 100),
    }),
  );

  return (result.executions ?? [])
    .filter((e) => {
      if (!startDate) return true;
      return e.startDate && e.startDate >= new Date(startDate);
    })
    .map((e) => ({
      executionArn: e.executionArn,
      name: e.name,
      startDate: e.startDate?.toISOString(),
      stopDate: e.stopDate?.toISOString(),
      status: e.status,
    }));
}

export async function getDeliveryStats(
  config: McpConfig,
  startDate: string,
  endDate: string,
) {
  const db = getDynamo(config.region);

  const result = await db.send(
    new ScanCommand({
      TableName: config.eventsTableName,
      FilterExpression: "SK BETWEEN :skStart AND :skEnd",
      ExpressionAttributeValues: marshall({
        ":skStart": `${EVT_SK_PREFIX}${startDate}`,
        ":skEnd": `${EVT_SK_PREFIX}${endDate}~`,
      }),
    }),
  );

  const items = (result.Items ?? []).map((i) => unmarshall(i));
  const counts: Record<string, number> = {
    delivery: 0,
    open: 0,
    click: 0,
    bounce: 0,
    complaint: 0,
  };

  for (const item of items) {
    const eventType = item.eventType as string;
    if (eventType in counts) counts[eventType]++;
  }

  return {
    period: { startDate, endDate },
    counts,
    total: items.length,
  };
}

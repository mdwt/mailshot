import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { subscriberPK, PROFILE_SK, SUPPRESSION_SK } from "@mailshot/shared";
import type { McpConfig } from "../config.js";

let dynamo: DynamoDBClient;

function getDynamo(region: string): DynamoDBClient {
  if (!dynamo) dynamo = new DynamoDBClient({ region });
  return dynamo;
}

export async function listSuppressed(config: McpConfig, limit: number) {
  const db = getDynamo(config.region);

  const result = await db.send(
    new ScanCommand({
      TableName: config.tableName,
      FilterExpression: "SK = :sk",
      ExpressionAttributeValues: marshall({ ":sk": SUPPRESSION_SK }),
      Limit: Math.min(limit, 100) * 10,
    }),
  );

  return (result.Items ?? []).map((i) => unmarshall(i)).slice(0, limit);
}

export async function removeSuppression(config: McpConfig, email: string) {
  const db = getDynamo(config.region);
  const pk = subscriberPK(email);

  // Delete suppression record
  await db.send(
    new DeleteItemCommand({
      TableName: config.tableName,
      Key: marshall({ PK: pk, SK: SUPPRESSION_SK }),
    }),
  );

  // Clear suppressed flag on profile
  await db.send(
    new UpdateItemCommand({
      TableName: config.tableName,
      Key: marshall({ PK: pk, SK: PROFILE_SK }),
      UpdateExpression: "SET suppressed = :val, updatedAt = :now",
      ExpressionAttributeValues: marshall({
        ":val": false,
        ":now": new Date().toISOString(),
      }),
    }),
  );

  return { removed: true };
}

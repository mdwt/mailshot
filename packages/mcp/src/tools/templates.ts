import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Liquid } from "liquidjs";
import {
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { subscriberPK, PROFILE_SK } from "@step-func-emailer/shared";
import type { McpConfig } from "../config.js";

let s3: S3Client;
let dynamo: DynamoDBClient;
const liquid = new Liquid();

function getS3(region: string): S3Client {
  if (!s3) s3 = new S3Client({ region });
  return s3;
}

function getDynamo(region: string): DynamoDBClient {
  if (!dynamo) dynamo = new DynamoDBClient({ region });
  return dynamo;
}

export async function listTemplates(config: McpConfig, prefix?: string) {
  const s3Client = getS3(config.region);

  const result = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: config.templateBucketName,
      Prefix: prefix,
    }),
  );

  return (result.Contents ?? []).map((obj) => ({
    key: obj.Key,
    size: obj.Size,
    lastModified: obj.LastModified?.toISOString(),
  }));
}

async function fetchTemplate(
  config: McpConfig,
  templateKey: string,
): Promise<string> {
  const s3Client = getS3(config.region);
  const key = templateKey.endsWith(".html")
    ? templateKey
    : `${templateKey}.html`;

  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: config.templateBucketName,
      Key: key,
    }),
  );

  return (await result.Body?.transformToString()) ?? "";
}

export async function previewTemplate(
  config: McpConfig,
  templateKey: string,
  email: string,
) {
  const db = getDynamo(config.region);

  // Get subscriber profile for template variables
  const profileResult = await db.send(
    new GetItemCommand({
      TableName: config.tableName,
      Key: marshall({ PK: subscriberPK(email), SK: PROFILE_SK }),
    }),
  );

  const profile = profileResult.Item ? unmarshall(profileResult.Item) : null;
  if (!profile) {
    return { error: `Subscriber ${email} not found` };
  }

  const html = await fetchTemplate(config, templateKey);

  const rendered = await liquid.parseAndRender(html, {
    email: profile.email,
    firstName: profile.firstName,
    ...(profile.attributes as Record<string, unknown>),
    unsubscribeUrl: "https://example.com/unsubscribe?token=preview",
    currentYear: new Date().getFullYear(),
  });

  return { html: rendered };
}

export async function validateTemplate(
  config: McpConfig,
  templateKey: string,
) {
  const html = await fetchTemplate(config, templateKey);

  try {
    await liquid.parse(html);
    return { valid: true, templateKey };
  } catch (err) {
    return {
      valid: false,
      templateKey,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

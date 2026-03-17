import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createLogger } from "./logger.js";

const logger = createLogger("display-names");
const s3 = new S3Client({});

type DisplayNameMap = Record<string, Record<string, string>>;

let cachedMap: { data: DisplayNameMap; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function loadDisplayNames(bucket: string): Promise<DisplayNameMap> {
  if (cachedMap && Date.now() - cachedMap.fetchedAt < CACHE_TTL_MS) {
    logger.debug("Display names cache hit");
    return cachedMap.data;
  }

  try {
    logger.debug("Loading display names from S3", { bucket });
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: "display-names.json",
      }),
    );
    const body = (await result.Body?.transformToString()) ?? "{}";
    const data = JSON.parse(body) as DisplayNameMap;
    cachedMap = { data, fetchedAt: Date.now() };
    logger.debug("Display names loaded", { mappingCount: Object.keys(data).length });
    return data;
  } catch {
    logger.debug("Display names file not found, using empty map");
    return {};
  }
}

export function resolveDisplayNames(
  displayNameMap: DisplayNameMap,
  attributes: Record<string, unknown>,
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [displayKey, valueMap] of Object.entries(displayNameMap)) {
    // Convention: displayKey "platformName" maps from attribute "platform"
    // The source attribute key is derived by removing "Name" suffix
    const sourceKey = displayKey.replace(/Name$/, "");
    const rawValue = attributes[sourceKey];
    if (typeof rawValue === "string") {
      resolved[displayKey] = valueMap[rawValue] ?? rawValue;
    }
  }

  return resolved;
}

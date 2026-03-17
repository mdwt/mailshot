import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { createLogger } from "./logger.js";

const logger = createLogger("ssm-config");
const ssm = new SSMClient({});
const cache = new Map<string, { value: string; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getParameter(name: string): Promise<string> {
  const cached = cache.get(name);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    logger.debug("SSM cache hit", { parameter: name });
    return cached.value;
  }

  logger.debug("Fetching SSM parameter", { parameter: name });
  const result = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));

  const value = result.Parameter?.Value;
  if (!value) {
    logger.error("SSM parameter not found", { parameter: name });
    throw new Error(`SSM parameter not found: ${name}`);
  }

  cache.set(name, { value, fetchedAt: Date.now() });
  return value;
}

export interface ResolvedConfig {
  tableName: string;
  eventsTableName: string;
  templateBucket: string;
  defaultFromEmail: string;
  defaultFromName: string;
  replyToEmail: string;
  sesConfigSet: string;
  unsubscribeBaseUrl: string;
  unsubscribeSecret: string;
}

const SSM_PREFIX = process.env.SSM_PREFIX ?? "/step-func-emailer";

export async function resolveConfig(): Promise<ResolvedConfig> {
  logger.debug("Resolving config", { prefix: SSM_PREFIX });

  const [
    tableName,
    eventsTableName,
    templateBucket,
    defaultFromEmail,
    defaultFromName,
    replyToEmail,
    sesConfigSet,
    unsubscribeBaseUrl,
    unsubscribeSecret,
  ] = await Promise.all([
    getParameter(`${SSM_PREFIX}/table-name`),
    getParameter(`${SSM_PREFIX}/events-table-name`),
    getParameter(`${SSM_PREFIX}/template-bucket`),
    getParameter(`${SSM_PREFIX}/default-from-email`),
    getParameter(`${SSM_PREFIX}/default-from-name`),
    getParameter(`${SSM_PREFIX}/reply-to-email`).catch(() => ""),
    getParameter(`${SSM_PREFIX}/ses-config-set`),
    getParameter(`${SSM_PREFIX}/unsubscribe-base-url`),
    getParameter(`${SSM_PREFIX}/unsubscribe-secret`),
  ]);

  logger.debug("Config resolved", { tableName, templateBucket });

  return {
    tableName,
    eventsTableName,
    templateBucket,
    defaultFromEmail,
    defaultFromName,
    replyToEmail,
    sesConfigSet,
    unsubscribeBaseUrl,
    unsubscribeSecret,
  };
}

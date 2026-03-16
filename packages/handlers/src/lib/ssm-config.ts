import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
const cache = new Map<string, { value: string; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getParameter(name: string): Promise<string> {
  const cached = cache.get(name);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const result = await ssm.send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  );

  const value = result.Parameter?.Value;
  if (!value) {
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
  sesConfigSet: string;
  unsubscribeBaseUrl: string;
  unsubscribeSecret: string;
  rateLimitCount: number;
  rateLimitWindowHours: number;
}

const SSM_PREFIX = process.env.SSM_PREFIX ?? "/step-func-emailer";

export async function resolveConfig(): Promise<ResolvedConfig> {
  const [
    tableName,
    eventsTableName,
    templateBucket,
    defaultFromEmail,
    defaultFromName,
    sesConfigSet,
    unsubscribeBaseUrl,
    unsubscribeSecret,
    rateLimitCount,
    rateLimitWindowHours,
  ] = await Promise.all([
    getParameter(`${SSM_PREFIX}/table-name`),
    getParameter(`${SSM_PREFIX}/events-table-name`),
    getParameter(`${SSM_PREFIX}/template-bucket`),
    getParameter(`${SSM_PREFIX}/default-from-email`),
    getParameter(`${SSM_PREFIX}/default-from-name`),
    getParameter(`${SSM_PREFIX}/ses-config-set`),
    getParameter(`${SSM_PREFIX}/unsubscribe-base-url`),
    getParameter(`${SSM_PREFIX}/unsubscribe-secret`),
    getParameter(`${SSM_PREFIX}/rate-limit-count`),
    getParameter(`${SSM_PREFIX}/rate-limit-window-hours`),
  ]);

  return {
    tableName,
    eventsTableName,
    templateBucket,
    defaultFromEmail,
    defaultFromName,
    sesConfigSet,
    unsubscribeBaseUrl,
    unsubscribeSecret,
    rateLimitCount: parseInt(rateLimitCount, 10),
    rateLimitWindowHours: parseInt(rateLimitWindowHours, 10),
  };
}

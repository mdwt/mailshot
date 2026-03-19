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

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function resolveConfig(): ResolvedConfig {
  return {
    tableName: required("TABLE_NAME"),
    eventsTableName: required("EVENTS_TABLE_NAME"),
    templateBucket: required("TEMPLATE_BUCKET"),
    defaultFromEmail: required("DEFAULT_FROM_EMAIL"),
    defaultFromName: required("DEFAULT_FROM_NAME"),
    replyToEmail: process.env.REPLY_TO_EMAIL ?? "",
    sesConfigSet: required("SES_CONFIG_SET"),
    unsubscribeBaseUrl: process.env.UNSUBSCRIBE_BASE_URL ?? "",
    unsubscribeSecret: required("UNSUBSCRIBE_SECRET"),
  };
}

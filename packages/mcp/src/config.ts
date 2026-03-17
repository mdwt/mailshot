import * as fs from "node:fs";
import * as path from "node:path";

export interface McpConfig {
  region: string;
  tableName: string;
  eventsTableName: string;
  templateBucketName: string;
}

function findProjectRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, ".env"))) return dir;
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function loadEnvFile(): void {
  const envPath = path.join(findProjectRoot(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function resolveConfig(): McpConfig {
  loadEnvFile();

  const region = process.env.REGION ?? process.env.AWS_REGION ?? "us-east-1";
  const tableName = process.env.TABLE_NAME;
  const eventsTableName = process.env.EVENTS_TABLE_NAME;
  const templateBucketName = process.env.TEMPLATE_BUCKET_NAME;

  if (!tableName || !eventsTableName || !templateBucketName) {
    throw new Error(
      "Missing required env vars: TABLE_NAME, EVENTS_TABLE_NAME, TEMPLATE_BUCKET_NAME. " +
        "Ensure .env exists in the repo root or set them in the environment.",
    );
  }

  return { region, tableName, eventsTableName, templateBucketName };
}

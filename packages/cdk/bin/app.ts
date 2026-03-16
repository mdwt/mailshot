#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as path from "node:path";
import * as fs from "node:fs";
import type { StepFuncEmailerConfig } from "@step-func-emailer/shared";
import { StepFuncEmailerStack } from "../lib/step-func-emailer-stack.js";

// Load .env from repo root
const envPath = path.join(__dirname, "../../../.env");
if (fs.existsSync(envPath)) {
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

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env and fill in your values.`,
    );
  }
  return val;
}

const config: StepFuncEmailerConfig = {
  account: required("ACCOUNT"),
  region: required("REGION"),
  stackName: required("STACK_NAME"),
  tableName: required("TABLE_NAME"),
  eventsTableName: required("EVENTS_TABLE_NAME"),
  templateBucketName: required("TEMPLATE_BUCKET_NAME"),
  eventBusName: required("EVENT_BUS_NAME"),
  eventSource: required("EVENT_SOURCE"),
  sesConfigSetName: required("SES_CONFIG_SET_NAME"),
  snsTopicName: required("SNS_TOPIC_NAME"),
  defaultFromEmail: required("DEFAULT_FROM_EMAIL"),
  defaultFromName: required("DEFAULT_FROM_NAME"),
  unsubscribeSecret: required("UNSUBSCRIBE_SECRET"),
  rateLimitCount: Number(required("RATE_LIMIT_COUNT")),
  rateLimitWindowHours: Number(required("RATE_LIMIT_WINDOW_HOURS")),
  ssmPrefix: required("SSM_PREFIX"),
};

const app = new cdk.App();

new StepFuncEmailerStack(app, config.stackName, {
  env: {
    account: config.account,
    region: config.region,
  },
  config,
});

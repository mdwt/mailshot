#!/usr/bin/env node
import "source-map-support/register";
import * as path from "node:path";
import * as fs from "node:fs";
import * as cdk from "aws-cdk-lib";
import type { StepFuncEmailerConfig } from "@step-func-emailer/shared";
import { StepFuncEmailerStack } from "@step-func-emailer/cdk";
import { loadSequenceConfigs } from "@step-func-emailer/cdk/load-sequences";

// Load .env from project root
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var ${name}. Run /setup-env in Claude Code.`);
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
  sesConfigSetName: required("SES_CONFIG_SET_NAME"),
  snsTopicName: required("SNS_TOPIC_NAME"),
  defaultFromEmail: required("DEFAULT_FROM_EMAIL"),
  defaultFromName: required("DEFAULT_FROM_NAME"),
  replyToEmail: process.env.REPLY_TO_EMAIL || undefined,
  unsubscribeSecret: required("UNSUBSCRIBE_SECRET"),
  ssmPrefix: required("SSM_PREFIX"),
};

const definitions = loadSequenceConfigs();
const app = new cdk.App();
new StepFuncEmailerStack(app, config.stackName, {
  env: { account: config.account, region: config.region },
  config,
  definitions,
});

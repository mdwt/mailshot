#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveConfig } from "./config.js";
import {
  getSubscriber,
  listSubscribers,
  updateSubscriber,
  deleteSubscriber,
  unsubscribeSubscriber,
  resubscribeSubscriber,
} from "./tools/subscribers.js";
import {
  listSuppressed,
  removeSuppression,
} from "./tools/suppression.js";
import {
  getSubscriberEvents,
  getTemplateEvents,
  getSequenceEvents,
} from "./tools/engagement.js";
import {
  listTemplates,
  previewTemplate,
  validateTemplate,
} from "./tools/templates.js";
import {
  getFailedExecutions,
  getDeliveryStats,
} from "./tools/system.js";

const config = resolveConfig();

const server = new McpServer({
  name: "step-func-emailer",
  version: "0.0.0",
});

// ── Subscriber management ──────────────────────────────────────────────────

server.tool(
  "get_subscriber",
  "Get subscriber profile, active executions, and recent send log",
  { email: z.string().email() },
  async ({ email }) => ({
    content: [
      { type: "text", text: JSON.stringify(await getSubscriber(config, email), null, 2) },
    ],
  }),
);

server.tool(
  "list_subscribers",
  "List subscriber profiles, optionally filtered by status",
  {
    status: z
      .enum(["active", "unsubscribed", "suppressed", "all"])
      .optional()
      .default("all"),
    limit: z.number().int().min(1).max(100).optional().default(20),
  },
  async ({ status, limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await listSubscribers(config, status, limit), null, 2),
      },
    ],
  }),
);

server.tool(
  "update_subscriber",
  "Update attribute values on a subscriber profile",
  {
    email: z.string().email(),
    attributes: z.record(z.unknown()),
  },
  async ({ email, attributes }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await updateSubscriber(config, email, attributes), null, 2),
      },
    ],
  }),
);

server.tool(
  "delete_subscriber",
  "Remove all records for a subscriber across both tables",
  { email: z.string().email() },
  async ({ email }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await deleteSubscriber(config, email), null, 2),
      },
    ],
  }),
);

server.tool(
  "unsubscribe_subscriber",
  "Set subscriber as unsubscribed and stop all active executions",
  { email: z.string().email() },
  async ({ email }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await unsubscribeSubscriber(config, email),
          null,
          2,
        ),
      },
    ],
  }),
);

server.tool(
  "resubscribe_subscriber",
  "Clear unsubscribe flag on a subscriber",
  { email: z.string().email() },
  async ({ email }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await resubscribeSubscriber(config, email),
          null,
          2,
        ),
      },
    ],
  }),
);

// ── Suppression management ─────────────────────────────────────────────────

server.tool(
  "list_suppressed",
  "List suppressed subscribers",
  {
    limit: z.number().int().min(1).max(100).optional().default(20),
  },
  async ({ limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await listSuppressed(config, limit), null, 2),
      },
    ],
  }),
);

server.tool(
  "remove_suppression",
  "Remove suppression record and clear suppressed flag on profile",
  { email: z.string().email() },
  async ({ email }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await removeSuppression(config, email), null, 2),
      },
    ],
  }),
);

// ── Engagement ─────────────────────────────────────────────────────────────

server.tool(
  "get_subscriber_events",
  "Get engagement events for one subscriber",
  {
    email: z.string().email(),
    eventType: z
      .enum(["delivery", "open", "click", "bounce", "complaint"])
      .optional(),
    startDate: z.string().optional().describe("ISO 8601 date"),
    endDate: z.string().optional().describe("ISO 8601 date"),
    limit: z.number().int().min(1).max(100).optional().default(20),
  },
  async ({ email, eventType, startDate, endDate, limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getSubscriberEvents(
            config,
            email,
            eventType,
            startDate,
            endDate,
            limit,
          ),
          null,
          2,
        ),
      },
    ],
  }),
);

server.tool(
  "get_template_events",
  "Get engagement events across all subscribers for a template",
  {
    templateKey: z.string(),
    eventType: z
      .enum(["delivery", "open", "click", "bounce", "complaint"])
      .optional(),
    startDate: z.string().optional().describe("ISO 8601 date"),
    endDate: z.string().optional().describe("ISO 8601 date"),
    limit: z.number().int().min(1).max(100).optional().default(20),
  },
  async ({ templateKey, eventType, startDate, endDate, limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getTemplateEvents(
            config,
            templateKey,
            eventType,
            startDate,
            endDate,
            limit,
          ),
          null,
          2,
        ),
      },
    ],
  }),
);

server.tool(
  "get_sequence_events",
  "Get engagement events for all templates in a sequence",
  {
    sequenceId: z.string(),
    eventType: z
      .enum(["delivery", "open", "click", "bounce", "complaint"])
      .optional(),
    startDate: z.string().optional().describe("ISO 8601 date"),
    endDate: z.string().optional().describe("ISO 8601 date"),
    limit: z.number().int().min(1).max(100).optional().default(20),
  },
  async ({ sequenceId, eventType, startDate, endDate, limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getSequenceEvents(
            config,
            sequenceId,
            eventType,
            startDate,
            endDate,
            limit,
          ),
          null,
          2,
        ),
      },
    ],
  }),
);

// ── Templates ──────────────────────────────────────────────────────────────

server.tool(
  "list_templates",
  "List template keys in S3",
  {
    prefix: z.string().optional(),
  },
  async ({ prefix }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await listTemplates(config, prefix), null, 2),
      },
    ],
  }),
);

server.tool(
  "preview_template",
  "Render a template with a subscriber's data",
  {
    templateKey: z.string(),
    email: z.string().email(),
  },
  async ({ templateKey, email }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await previewTemplate(config, templateKey, email),
          null,
          2,
        ),
      },
    ],
  }),
);

server.tool(
  "validate_template",
  "Check Liquid syntax of a template",
  { templateKey: z.string() },
  async ({ templateKey }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await validateTemplate(config, templateKey),
          null,
          2,
        ),
      },
    ],
  }),
);

// ── System health ──────────────────────────────────────────────────────────

server.tool(
  "get_failed_executions",
  "Get recent Step Functions execution failures",
  {
    stateMachineArn: z.string().describe("ARN of the state machine to check"),
    startDate: z.string().optional().describe("ISO 8601 date"),
    limit: z.number().int().min(1).max(100).optional().default(20),
  },
  async ({ stateMachineArn, startDate, limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getFailedExecutions(config, stateMachineArn, startDate, limit),
          null,
          2,
        ),
      },
    ],
  }),
);

server.tool(
  "get_delivery_stats",
  "Get aggregate event counts in a period",
  {
    startDate: z.string().describe("ISO 8601 date"),
    endDate: z.string().describe("ISO 8601 date"),
  },
  async ({ startDate, endDate }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getDeliveryStats(config, startDate, endDate),
          null,
          2,
        ),
      },
    ],
  }),
);

// ── Start server ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

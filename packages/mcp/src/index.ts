#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { version } from "../package.json";
import { resolveConfig } from "./config.js";
import {
  getSubscriber,
  listSubscribers,
  updateSubscriber,
  deleteSubscriber,
  unsubscribeSubscriber,
  resubscribeSubscriber,
} from "./tools/subscribers.js";
import { listSuppressed, removeSuppression } from "./tools/suppression.js";
import { getSubscriberEvents, getTemplateEvents, getSequenceEvents } from "./tools/engagement.js";
import { listTemplates, previewTemplate, validateTemplate } from "./tools/templates.js";
import { getFailedExecutions, getDeliveryStats } from "./tools/system.js";
import { listSequences, exportSequence, listSequenceSubscribers } from "./tools/sequences.js";
import { sendBroadcast, getBroadcast, listBroadcasts } from "./tools/broadcast.js";
import { syncSkills } from "./tools/skills.js";

const config = resolveConfig();

const server = new McpServer({
  name: "mailshot",
  version,
});

// ── Subscriber management ──────────────────────────────────────────────────

server.registerTool(
  "get_subscriber",
  {
    description: "Get subscriber profile, active executions, and recent send log",
    inputSchema: { email: z.string().email() },
  },
  async ({ email }) => ({
    content: [{ type: "text", text: JSON.stringify(await getSubscriber(config, email), null, 2) }],
  }),
);

server.registerTool(
  "list_subscribers",
  {
    description: "List subscriber profiles, optionally filtered by status",
    inputSchema: {
      status: z.enum(["active", "unsubscribed", "suppressed", "all"]).optional().default("all"),
      limit: z.number().int().min(1).max(100).optional().default(20),
    },
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

server.registerTool(
  "update_subscriber",
  {
    description: "Update attribute values on a subscriber profile",
    inputSchema: {
      email: z.string().email(),
      attributes: z.record(z.unknown()),
    },
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

server.registerTool(
  "delete_subscriber",
  {
    description: "Remove all records for a subscriber across both tables",
    inputSchema: { email: z.string().email() },
  },
  async ({ email }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await deleteSubscriber(config, email), null, 2),
      },
    ],
  }),
);

server.registerTool(
  "unsubscribe_subscriber",
  {
    description: "Set subscriber as unsubscribed and stop all active executions",
    inputSchema: { email: z.string().email() },
  },
  async ({ email }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await unsubscribeSubscriber(config, email), null, 2),
      },
    ],
  }),
);

server.registerTool(
  "resubscribe_subscriber",
  {
    description: "Clear unsubscribe flag on a subscriber",
    inputSchema: { email: z.string().email() },
  },
  async ({ email }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await resubscribeSubscriber(config, email), null, 2),
      },
    ],
  }),
);

// ── Suppression management ─────────────────────────────────────────────────

server.registerTool(
  "list_suppressed",
  {
    description: "List suppressed subscribers",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional().default(20),
    },
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

server.registerTool(
  "remove_suppression",
  {
    description: "Remove suppression record and clear suppressed flag on profile",
    inputSchema: { email: z.string().email() },
  },
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

server.registerTool(
  "get_subscriber_events",
  {
    description: "Get engagement events for one subscriber",
    inputSchema: {
      email: z.string().email(),
      eventType: z.enum(["delivery", "open", "click", "bounce", "complaint", "reply"]).optional(),
      startDate: z.string().optional().describe("ISO 8601 date"),
      endDate: z.string().optional().describe("ISO 8601 date"),
      limit: z.number().int().min(1).max(100).optional().default(20),
    },
  },
  async ({ email, eventType, startDate, endDate, limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getSubscriberEvents(config, email, eventType, startDate, endDate, limit),
          null,
          2,
        ),
      },
    ],
  }),
);

server.registerTool(
  "get_template_events",
  {
    description: "Get engagement events across all subscribers for a template",
    inputSchema: {
      templateKey: z.string(),
      eventType: z.enum(["delivery", "open", "click", "bounce", "complaint", "reply"]).optional(),
      startDate: z.string().optional().describe("ISO 8601 date"),
      endDate: z.string().optional().describe("ISO 8601 date"),
      limit: z.number().int().min(1).max(100).optional().default(20),
    },
  },
  async ({ templateKey, eventType, startDate, endDate, limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getTemplateEvents(config, templateKey, eventType, startDate, endDate, limit),
          null,
          2,
        ),
      },
    ],
  }),
);

server.registerTool(
  "get_sequence_events",
  {
    description: "Get engagement events for all templates in a sequence",
    inputSchema: {
      sequenceId: z.string(),
      eventType: z.enum(["delivery", "open", "click", "bounce", "complaint", "reply"]).optional(),
      startDate: z.string().optional().describe("ISO 8601 date"),
      endDate: z.string().optional().describe("ISO 8601 date"),
      limit: z.number().int().min(1).max(100).optional().default(20),
    },
  },
  async ({ sequenceId, eventType, startDate, endDate, limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getSequenceEvents(config, sequenceId, eventType, startDate, endDate, limit),
          null,
          2,
        ),
      },
    ],
  }),
);

// ── Templates ──────────────────────────────────────────────────────────────

server.registerTool(
  "list_templates",
  {
    description: "List template keys in S3",
    inputSchema: {
      prefix: z.string().optional(),
    },
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

server.registerTool(
  "preview_template",
  {
    description: "Render a template with a subscriber's data",
    inputSchema: {
      templateKey: z.string(),
      email: z.string().email(),
    },
  },
  async ({ templateKey, email }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await previewTemplate(config, templateKey, email), null, 2),
      },
    ],
  }),
);

server.registerTool(
  "validate_template",
  {
    description: "Check Liquid syntax of a template",
    inputSchema: { templateKey: z.string() },
  },
  async ({ templateKey }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await validateTemplate(config, templateKey), null, 2),
      },
    ],
  }),
);

// ── Sequences ─────────────────────────────────────────────────────────────

server.registerTool(
  "list_sequences",
  {
    description:
      "List deployed sequences by discovering S3 template prefixes and Step Functions state machines",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await listSequences(config), null, 2),
      },
    ],
  }),
);

server.registerTool(
  "export_sequence",
  {
    description:
      "Export a deployed sequence - reverse-parses ASL to SequenceDefinition, fetches templates and EventBridge trigger config",
    inputSchema: {
      sequenceId: z.string().describe("The sequence ID to export (kebab-case)"),
    },
  },
  async ({ sequenceId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await exportSequence(config, sequenceId), null, 2),
      },
    ],
  }),
);

server.registerTool(
  "list_sequence_subscribers",
  {
    description:
      "List subscribers currently running in a sequence (active executions, newest first)",
    inputSchema: {
      sequenceId: z.string().describe("The sequence ID (kebab-case)"),
      limit: z.number().int().min(1).max(100).optional().default(50),
    },
  },
  async ({ sequenceId, limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await listSequenceSubscribers(config, sequenceId, limit), null, 2),
      },
    ],
  }),
);

// ── Broadcasts ───────────────────────────────────────────────────────────

server.registerTool(
  "send_broadcast",
  {
    description:
      "Send a one-off broadcast email to filtered subscribers. Invokes BroadcastFn directly to resolve subscribers and fan out via SQS. Use dryRun to preview audience size without sending.",
    inputSchema: {
      broadcastId: z.string().describe("Unique broadcast identifier (kebab-case)"),
      templateKey: z.string().describe("S3 template key (e.g., broadcasts/product-update)"),
      subject: z.string().describe("Email subject line (supports Liquid variables)"),
      senderFromEmail: z.string().email().describe("SES-verified sender email"),
      senderFromName: z.string().describe("Sender display name"),
      senderReplyToEmail: z.string().email().optional().describe("Reply-To address"),
      listUnsubscribe: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include List-Unsubscribe headers"),
      filterTags: z
        .array(z.string())
        .optional()
        .describe("Tags filter (AND logic - subscriber must have ALL)"),
      filterAttributes: z
        .record(z.unknown())
        .optional()
        .describe("Attribute equality filters on subscriber profiles"),
      dryRun: z
        .boolean()
        .optional()
        .default(false)
        .describe("When true, resolves subscribers and returns count without sending"),
    },
  },
  async ({
    broadcastId,
    templateKey,
    subject,
    senderFromEmail,
    senderFromName,
    senderReplyToEmail,
    listUnsubscribe,
    filterTags,
    filterAttributes,
    dryRun,
  }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await sendBroadcast(config, {
            broadcastId,
            templateKey,
            subject,
            senderFromEmail,
            senderFromName,
            senderReplyToEmail,
            listUnsubscribe,
            filterTags,
            filterAttributes,
            dryRun,
          }),
          null,
          2,
        ),
      },
    ],
  }),
);

server.registerTool(
  "get_broadcast",
  {
    description:
      "Get a broadcast record by ID, showing config, filters, subscriber count, and send time",
    inputSchema: {
      broadcastId: z.string().describe("The broadcast ID to look up"),
    },
  },
  async ({ broadcastId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await getBroadcast(config, broadcastId), null, 2),
      },
    ],
  }),
);

server.registerTool(
  "list_broadcasts",
  {
    description: "List recent broadcasts, most recent first",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional().default(20),
    },
  },
  async ({ limit }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await listBroadcasts(config, limit), null, 2),
      },
    ],
  }),
);

// ── Skills ─────────────────────────────────────────────────────────────────

server.registerTool(
  "sync_skills",
  {
    description:
      "Refresh the project's .claude/skills/ directory from the canonical skills shipped with @mailshot/skills. Existing files are overwritten — local edits are recoverable via git.",
    inputSchema: {
      projectRoot: z
        .string()
        .optional()
        .describe("Project root to sync into. Defaults to the current working directory."),
    },
  },
  async ({ projectRoot }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(syncSkills(projectRoot), null, 2),
      },
    ],
  }),
);

// ── System health ──────────────────────────────────────────────────────────

server.registerTool(
  "get_failed_executions",
  {
    description: "Get recent Step Functions execution failures",
    inputSchema: {
      stateMachineArn: z.string().describe("ARN of the state machine to check"),
      startDate: z.string().optional().describe("ISO 8601 date"),
      limit: z.number().int().min(1).max(100).optional().default(20),
    },
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

server.registerTool(
  "get_delivery_stats",
  {
    description: "Get aggregate event counts in a period",
    inputSchema: {
      startDate: z.string().describe("ISO 8601 date"),
      endDate: z.string().describe("ISO 8601 date"),
    },
  },
  async ({ startDate, endDate }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await getDeliveryStats(config, startDate, endDate), null, 2),
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

import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { McpConfig } from "../config.js";

let eventBridge: EventBridgeClient;

function getEventBridge(region: string): EventBridgeClient {
  if (!eventBridge) eventBridge = new EventBridgeClient({ region });
  return eventBridge;
}

export interface SendBroadcastParams {
  broadcastId: string;
  templateKey: string;
  subject: string;
  senderFromEmail: string;
  senderFromName: string;
  senderReplyToEmail?: string;
  listUnsubscribe?: boolean;
  filterTags?: string[];
  filterAttributes?: Record<string, unknown>;
}

export async function sendBroadcast(config: McpConfig, params: SendBroadcastParams) {
  const eb = getEventBridge(config.region);

  const detail: Record<string, unknown> = {
    broadcastId: params.broadcastId,
    templateKey: params.templateKey,
    subject: params.subject,
    sender: {
      fromEmail: params.senderFromEmail,
      fromName: params.senderFromName,
      ...(params.senderReplyToEmail && { replyToEmail: params.senderReplyToEmail }),
      ...(params.listUnsubscribe === false && { listUnsubscribe: false }),
    },
  };

  const filters: Record<string, unknown> = {};
  if (params.filterTags && params.filterTags.length > 0) {
    filters.tags = params.filterTags;
  }
  if (params.filterAttributes && Object.keys(params.filterAttributes).length > 0) {
    filters.attributes = params.filterAttributes;
  }
  if (Object.keys(filters).length > 0) {
    detail.filters = filters;
  }

  const result = await eb.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "mailshot.mcp",
          DetailType: "broadcast.requested",
          EventBusName: config.eventBusName,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );

  const failed = result.FailedEntryCount ?? 0;
  if (failed > 0) {
    const entry = result.Entries?.[0];
    throw new Error(
      `Failed to publish broadcast event: ${entry?.ErrorCode} - ${entry?.ErrorMessage}`,
    );
  }

  return {
    published: true,
    broadcastId: params.broadcastId,
    eventId: result.Entries?.[0]?.EventId,
  };
}

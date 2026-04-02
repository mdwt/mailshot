import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import type { BroadcastInput, FireAndForgetInput, SubscriberProfile } from "@mailshot/shared";
import { resolveConfig } from "../lib/config.js";
import {
  getSubscriberEmailsByTag,
  batchGetSubscriberProfiles,
  scanActiveSubscribers,
  extractAttributes,
  writeBroadcastRecord,
} from "../lib/dynamo-client.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("broadcast");
const sqs = new SQSClient({});

interface BroadcastResult {
  broadcastId: string;
  subscriberCount: number;
  messagesQueued: number;
}

export const handler = async (event: BroadcastInput): Promise<BroadcastResult> => {
  logger.info("Broadcast requested", {
    broadcastId: event.broadcastId,
    templateKey: event.templateKey,
    filters: event.filters,
  });

  const config = resolveConfig();
  const queueUrl = process.env.BROADCAST_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("BROADCAST_QUEUE_URL environment variable is required");
  }

  // ── Build subscriber list ──────────────────────────────────────────────
  const subscribers = await resolveSubscribers(config.tableName, event);

  logger.info("Subscribers resolved", {
    broadcastId: event.broadcastId,
    count: subscribers.length,
  });

  if (subscribers.length === 0) {
    await writeBroadcastRecord(config.tableName, {
      broadcastId: event.broadcastId,
      templateKey: event.templateKey,
      subject: event.subject,
      sender: event.sender,
      filters: event.filters,
      subscriberCount: 0,
      messagesQueued: 0,
    });
    return { broadcastId: event.broadcastId, subscriberCount: 0, messagesQueued: 0 };
  }

  // ── Fan out via SQS ────────────────────────────────────────────────────
  let messagesQueued = 0;
  const batchSize = 10; // SQS SendMessageBatch max

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);
    const entries = batch.map((sub, idx) => {
      const payload: FireAndForgetInput = {
        action: "fire_and_forget",
        templateKey: event.templateKey,
        subject: event.subject,
        sender: event.sender,
        sequenceId: event.broadcastId,
        subscriber: {
          email: sub.email,
          firstName: sub.firstName,
          attributes: extractAttributes(sub),
          tags: Array.isArray(sub.tags) ? (sub.tags as string[]) : undefined,
        },
      };
      return {
        Id: String(i + idx),
        MessageBody: JSON.stringify(payload),
      };
    });

    await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      }),
    );
    messagesQueued += entries.length;
  }

  // ── Write broadcast record ──────────────────────────────────────────────
  await writeBroadcastRecord(config.tableName, {
    broadcastId: event.broadcastId,
    templateKey: event.templateKey,
    subject: event.subject,
    sender: event.sender,
    filters: event.filters,
    subscriberCount: subscribers.length,
    messagesQueued,
  });

  logger.info("Broadcast queued", {
    broadcastId: event.broadcastId,
    subscriberCount: subscribers.length,
    messagesQueued,
  });

  return {
    broadcastId: event.broadcastId,
    subscriberCount: subscribers.length,
    messagesQueued,
  };
};

async function resolveSubscribers(
  tableName: string,
  event: BroadcastInput,
): Promise<SubscriberProfile[]> {
  const { filters } = event;
  const hasTags = filters?.tags && filters.tags.length > 0;
  const hasAttributes = filters?.attributes && Object.keys(filters.attributes).length > 0;

  if (hasTags) {
    // Query inverted index for each tag, intersect results
    const tagSets = await Promise.all(
      filters!.tags!.map((tag) => getSubscriberEmailsByTag(tableName, tag)),
    );

    // Intersect: subscriber must have ALL tags
    let emailSet = new Set(tagSets[0]);
    for (let i = 1; i < tagSets.length; i++) {
      const next = new Set(tagSets[i]);
      emailSet = new Set([...emailSet].filter((e) => next.has(e)));
    }

    if (emailSet.size === 0) return [];

    // Fetch full profiles
    const profiles = await batchGetSubscriberProfiles(tableName, [...emailSet]);

    // Filter out inactive subscribers and apply attribute filters
    return profiles.filter((p) => {
      if (p.unsubscribed || p.suppressed) return false;
      if (hasAttributes) {
        for (const [key, value] of Object.entries(filters!.attributes!)) {
          if ((p as Record<string, unknown>)[key] !== value) return false;
        }
      }
      return true;
    });
  }

  // No tag filter — scan with attribute filters
  return scanActiveSubscribers(tableName, hasAttributes ? filters!.attributes : undefined);
}

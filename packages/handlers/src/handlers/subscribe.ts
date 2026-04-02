import type { SubscribeInput } from "@mailshot/shared";
import { resolveConfig } from "../lib/config.js";
import { upsertSubscriberProfile } from "../lib/dynamo-client.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("subscribe");

export const handler = async (event: SubscribeInput): Promise<{ subscribed: true }> => {
  logger.info("Subscribe invoked", {
    email: event.subscriber.email,
    tags: event.subscriber.tags,
  });
  const config = resolveConfig();

  await upsertSubscriberProfile(config.tableName, event.subscriber);

  logger.info("Subscriber registered", {
    email: event.subscriber.email,
    tagCount: event.subscriber.tags?.length ?? 0,
  });

  return { subscribed: true };
};

import type { SNSEvent } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { subscriberPK, eventSK } from "@mailshot/shared";
import type { EmailEventType } from "@mailshot/shared";
import { resolveConfig } from "../lib/config.js";
import { incrementSequenceCounter } from "../lib/dynamo-client.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("engagement-handler");
const dynamo = new DynamoDBClient({});

interface SESMailHeader {
  name: string;
  value: string;
}

interface SESMail {
  messageId: string;
  destination: string[];
  headers: SESMailHeader[];
}

interface SESDeliveryNotification {
  eventType: "Delivery";
  mail: SESMail;
  delivery: { timestamp: string };
}

interface SESOpenNotification {
  eventType: "Open";
  mail: SESMail;
  open: { timestamp: string; userAgent?: string };
}

interface SESClickNotification {
  eventType: "Click";
  mail: SESMail;
  click: { timestamp: string; link: string; userAgent?: string };
}

interface SESBounceNotification {
  eventType: "Bounce";
  mail: SESMail;
  bounce: {
    bounceType: string;
    bouncedRecipients: Array<{ emailAddress: string }>;
    timestamp: string;
  };
}

interface SESComplaintNotification {
  eventType: "Complaint";
  mail: SESMail;
  complaint: {
    complainedRecipients: Array<{ emailAddress: string }>;
    timestamp: string;
  };
}

type SESEventNotification =
  | SESDeliveryNotification
  | SESOpenNotification
  | SESClickNotification
  | SESBounceNotification
  | SESComplaintNotification;

function getHeader(headers: SESMailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractRecipients(notification: SESEventNotification): string[] {
  if (notification.eventType === "Bounce") {
    return notification.bounce.bouncedRecipients.map((r) => r.emailAddress);
  }
  if (notification.eventType === "Complaint") {
    return notification.complaint.complainedRecipients.map((r) => r.emailAddress);
  }
  return notification.mail.destination;
}

function extractTimestamp(notification: SESEventNotification): string {
  switch (notification.eventType) {
    case "Delivery":
      return notification.delivery.timestamp;
    case "Open":
      return notification.open.timestamp;
    case "Click":
      return notification.click.timestamp;
    case "Bounce":
      return notification.bounce.timestamp;
    case "Complaint":
      return notification.complaint.timestamp;
  }
}

const EVENT_TYPE_MAP: Record<string, EmailEventType> = {
  Delivery: "delivery",
  Open: "open",
  Click: "click",
  Bounce: "bounce",
  Complaint: "complaint",
};

export const handler = async (event: SNSEvent): Promise<void> => {
  logger.info("EngagementHandler invoked", { recordCount: event.Records.length });
  const config = resolveConfig();

  for (const record of event.Records) {
    const notification = JSON.parse(record.Sns.Message) as SESEventNotification;
    const eventType = EVENT_TYPE_MAP[notification.eventType];
    if (!eventType) {
      logger.debug("Skipping unknown event type", { eventType: notification.eventType });
      continue;
    }

    const timestamp = extractTimestamp(notification);
    const recipients = extractRecipients(notification);
    const subject = getHeader(notification.mail.headers, "Subject");
    const templateKey = getHeader(notification.mail.headers, "X-Template-Key");
    const sequenceId = getHeader(notification.mail.headers, "X-Sequence-Id") || "fire_and_forget";

    const linkUrl = notification.eventType === "Click" ? notification.click.link : undefined;
    const userAgent =
      notification.eventType === "Open"
        ? notification.open.userAgent
        : notification.eventType === "Click"
          ? notification.click.userAgent
          : undefined;

    logger.info("Processing engagement event", {
      eventType,
      templateKey,
      sequenceId,
      sesMessageId: notification.mail.messageId,
      recipientCount: recipients.length,
      ...(linkUrl ? { linkUrl } : {}),
    });

    const now = new Date();
    const ttl = config.dataTtlDays
      ? Math.floor(now.getTime() / 1000) + config.dataTtlDays * 86400
      : undefined;

    for (const email of recipients) {
      logger.debug("Writing engagement event", { email, eventType, templateKey });
      await dynamo.send(
        new PutItemCommand({
          TableName: config.eventsTableName,
          Item: marshall(
            {
              PK: subscriberPK(email),
              SK: eventSK(timestamp, eventType),
              eventType,
              templateKey,
              sequenceId,
              subject,
              ...(linkUrl ? { linkUrl } : {}),
              ...(userAgent ? { userAgent } : {}),
              sesMessageId: notification.mail.messageId,
              timestamp,
              ...(ttl !== undefined ? { ttl } : {}),
            },
            { removeUndefinedValues: true },
          ),
        }),
      );

      // Update denormalised counters on the main table. Best-effort: failures
      // are logged but never block engagement-event writes (EmailEvents is the
      // source of truth; counters are an eventually-consistent rollup).
      try {
        await incrementSequenceCounter(config.tableName, sequenceId, eventType);
      } catch (err) {
        logger.warn("Failed to increment sequence counter", {
          sequenceId,
          eventType,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  logger.info("EngagementHandler complete");
};

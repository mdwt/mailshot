import type { SNSEvent } from "aws-lambda";
import { resolveConfig } from "../lib/ssm-config.js";
import { writeSuppression, setProfileFlag } from "../lib/dynamo-client.js";
import { stopAllExecutions } from "../lib/execution-stopper.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("bounce-handler");

interface SESBounceNotification {
  notificationType: "Bounce";
  bounce: {
    bounceType: "Permanent" | "Transient";
    bouncedRecipients: Array<{ emailAddress: string }>;
    feedbackId: string;
  };
}

interface SESComplaintNotification {
  notificationType: "Complaint";
  complaint: {
    complainedRecipients: Array<{ emailAddress: string }>;
    feedbackId: string;
  };
}

type SESNotification = SESBounceNotification | SESComplaintNotification;

export const handler = async (event: SNSEvent): Promise<void> => {
  logger.info("BounceHandler invoked", { recordCount: event.Records.length });
  const config = await resolveConfig();

  for (const record of event.Records) {
    const notification = JSON.parse(record.Sns.Message) as SESNotification;

    if (notification.notificationType === "Bounce") {
      if (notification.bounce.bounceType === "Transient") {
        logger.debug("Ignoring transient bounce", {
          feedbackId: notification.bounce.feedbackId,
          recipients: notification.bounce.bouncedRecipients.map((r) => r.emailAddress),
        });
        continue;
      }

      logger.warn("Processing permanent bounce", {
        bounceType: notification.bounce.bounceType,
        feedbackId: notification.bounce.feedbackId,
        recipientCount: notification.bounce.bouncedRecipients.length,
      });

      for (const recipient of notification.bounce.bouncedRecipients) {
        const email = recipient.emailAddress;
        logger.warn("Suppressing bounced subscriber", { email });
        await writeSuppression(
          config.tableName,
          email,
          "bounce",
          notification.bounce.bounceType,
          notification.bounce.feedbackId,
        );
        await setProfileFlag(config.tableName, email, "suppressed");
        await stopAllExecutions(config.tableName, email);
      }
    }

    if (notification.notificationType === "Complaint") {
      logger.warn("Processing complaint", {
        feedbackId: notification.complaint.feedbackId,
        recipientCount: notification.complaint.complainedRecipients.length,
      });

      for (const recipient of notification.complaint.complainedRecipients) {
        const email = recipient.emailAddress;
        logger.warn("Suppressing complained subscriber", { email });
        await writeSuppression(
          config.tableName,
          email,
          "complaint",
          undefined,
          notification.complaint.feedbackId,
        );
        await setProfileFlag(config.tableName, email, "suppressed");
        await stopAllExecutions(config.tableName, email);
      }
    }
  }

  logger.info("BounceHandler complete");
};

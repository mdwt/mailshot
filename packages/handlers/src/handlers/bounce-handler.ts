import type { SNSEvent } from "aws-lambda";
import { resolveConfig } from "../lib/ssm-config.js";
import { writeSuppression, setProfileFlag } from "../lib/dynamo-client.js";
import { stopAllExecutions } from "../lib/execution-stopper.js";

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
  const config = await resolveConfig();

  for (const record of event.Records) {
    const notification = JSON.parse(record.Sns.Message) as SESNotification;

    if (notification.notificationType === "Bounce") {
      // Ignore transient bounces
      if (notification.bounce.bounceType === "Transient") continue;

      for (const recipient of notification.bounce.bouncedRecipients) {
        const email = recipient.emailAddress;
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
      for (const recipient of notification.complaint.complainedRecipients) {
        const email = recipient.emailAddress;
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
};

import type { CheckConditionInput, CheckConditionOutput } from "@step-func-emailer/shared";
import { resolveConfig } from "../lib/ssm-config.js";
import { getSubscriberProfile, hasBeenSent } from "../lib/dynamo-client.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("check-condition");

export const handler = async (event: CheckConditionInput): Promise<CheckConditionOutput> => {
  logger.info("CheckCondition invoked", {
    check: event.check,
    email: event.subscriber.email,
    field: event.field,
    value: event.value,
    templateKey: event.templateKey,
  });

  const config = await resolveConfig();

  switch (event.check) {
    case "subscriber_field_exists": {
      const profile = await getSubscriberProfile(config.tableName, event.subscriber.email);
      if (!profile || !event.field) {
        logger.debug("Field exists check — no profile or no field", {
          profileFound: !!profile,
          field: event.field,
        });
        return { result: false };
      }
      const value = profile[event.field];
      const result = value !== undefined && value !== null && value !== "";
      logger.info("Field exists check result", {
        email: event.subscriber.email,
        field: event.field,
        result,
      });
      return { result };
    }

    case "subscriber_field_equals": {
      const profile = await getSubscriberProfile(config.tableName, event.subscriber.email);
      if (!profile || !event.field) {
        logger.debug("Field equals check — no profile or no field", {
          profileFound: !!profile,
          field: event.field,
        });
        return { result: false };
      }
      const result = profile[event.field] === event.value;
      logger.info("Field equals check result", {
        email: event.subscriber.email,
        field: event.field,
        expectedValue: event.value,
        actualValue: profile[event.field],
        result,
      });
      return { result };
    }

    case "has_been_sent": {
      if (!event.templateKey) {
        logger.debug("Has been sent check — no templateKey provided");
        return { result: false };
      }
      const sent = await hasBeenSent(config.tableName, event.subscriber.email, event.templateKey);
      logger.info("Has been sent check result", {
        email: event.subscriber.email,
        templateKey: event.templateKey,
        result: sent,
      });
      return { result: sent };
    }

    default:
      logger.warn("Unknown check type", { check: event.check });
      return { result: false };
  }
};

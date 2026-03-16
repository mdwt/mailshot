import type {
  CheckConditionInput,
  CheckConditionOutput,
} from "@step-func-emailer/shared";
import { resolveConfig } from "../lib/ssm-config.js";
import {
  getSubscriberProfile,
  hasBeenSent,
} from "../lib/dynamo-client.js";

export const handler = async (
  event: CheckConditionInput,
): Promise<CheckConditionOutput> => {
  const config = await resolveConfig();

  switch (event.check) {
    case "subscriber_field_exists": {
      const profile = await getSubscriberProfile(
        config.tableName,
        event.subscriber.email,
      );
      if (!profile || !event.field) return { result: false };
      const value = profile.attributes[event.field];
      return {
        result: value !== undefined && value !== null && value !== "",
      };
    }

    case "subscriber_field_equals": {
      const profile = await getSubscriberProfile(
        config.tableName,
        event.subscriber.email,
      );
      if (!profile || !event.field) return { result: false };
      return {
        result: profile.attributes[event.field] === event.value,
      };
    }

    case "has_been_sent": {
      if (!event.templateKey) return { result: false };
      const sent = await hasBeenSent(
        config.tableName,
        event.subscriber.email,
        event.templateKey,
      );
      return { result: sent };
    }

    default:
      return { result: false };
  }
};

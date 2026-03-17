import { SFNClient, StopExecutionCommand } from "@aws-sdk/client-sfn";
import type { SendEmailInput, RegisterOutput, SendOutput } from "@mailshot/shared";
import { resolveConfig } from "../lib/ssm-config.js";
import {
  getSubscriberProfile,
  upsertSubscriberProfile,
  extractAttributes,
  getExecution,
  putExecution,
  deleteExecution,
  writeSendLog,
} from "../lib/dynamo-client.js";
import { renderTemplate } from "../lib/template-renderer.js";
import { sendEmail } from "../lib/ses-sender.js";
import { generateToken } from "../lib/unsubscribe-token.js";
import { loadDisplayNames, resolveDisplayNames } from "../lib/display-names.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("send-email");
const sfn = new SFNClient({});

export const handler = async (
  event: SendEmailInput,
): Promise<RegisterOutput | SendOutput | { completed: true }> => {
  logger.info("SendEmail invoked", { action: event.action, email: event.subscriber.email });
  const config = await resolveConfig();

  switch (event.action) {
    case "register":
      return handleRegister(event, config);
    case "send":
      return handleSend(event, config, event.sequenceId ?? "unknown");
    case "fire_and_forget":
      logger.info("Fire and forget", {
        email: event.subscriber.email,
        templateKey: event.templateKey,
      });
      await upsertSubscriberProfile(config.tableName, event.subscriber);
      return handleSend(
        {
          action: "send",
          templateKey: event.templateKey,
          subject: event.subject,
          subscriber: event.subscriber,
        },
        config,
        "fire_and_forget",
      );
    case "complete":
      logger.info("Completing sequence", {
        email: event.subscriber.email,
        sequenceId: event.sequenceId,
      });
      await deleteExecution(config.tableName, event.subscriber.email, event.sequenceId);
      return { completed: true };
  }
};

async function handleRegister(
  event: Extract<SendEmailInput, { action: "register" }>,
  config: Awaited<ReturnType<typeof resolveConfig>>,
): Promise<RegisterOutput> {
  logger.info("Registering subscriber for sequence", {
    email: event.subscriber.email,
    sequenceId: event.sequenceId,
    executionArn: event.executionArn,
  });

  await upsertSubscriberProfile(config.tableName, event.subscriber);

  // Check for existing execution and stop it
  const existing = await getExecution(config.tableName, event.subscriber.email, event.sequenceId);
  if (existing) {
    logger.warn("Stopping existing execution before registering new one", {
      email: event.subscriber.email,
      sequenceId: event.sequenceId,
      oldArn: existing.executionArn,
      newArn: event.executionArn,
    });
    try {
      await sfn.send(
        new StopExecutionCommand({
          executionArn: existing.executionArn,
          cause: "Replaced by new execution",
        }),
      );
    } catch {
      // Execution may already be stopped
    }
    await deleteExecution(config.tableName, event.subscriber.email, event.sequenceId);
  }

  await putExecution(
    config.tableName,
    event.subscriber.email,
    event.sequenceId,
    event.executionArn,
  );

  logger.info("Registration complete", {
    email: event.subscriber.email,
    sequenceId: event.sequenceId,
  });
  return { registered: true };
}

async function handleSend(
  event: Extract<SendEmailInput, { action: "send" }>,
  config: Awaited<ReturnType<typeof resolveConfig>>,
  sequenceId: string = "unknown",
): Promise<SendOutput> {
  logger.info("Processing send", {
    email: event.subscriber.email,
    templateKey: event.templateKey,
    subject: event.subject,
    sequenceId,
  });

  const profile = await getSubscriberProfile(config.tableName, event.subscriber.email);

  // Pre-send checks
  if (profile?.unsubscribed) {
    logger.info("Skipping send — subscriber unsubscribed", { email: event.subscriber.email });
    return { sent: false, reason: "unsubscribed" };
  }
  if (profile?.suppressed) {
    logger.info("Skipping send — subscriber suppressed", { email: event.subscriber.email });
    return { sent: false, reason: "suppressed" };
  }

  // Load display names and build context
  const displayNameMap = await loadDisplayNames(config.templateBucket);
  const attributes =
    (profile ? extractAttributes(profile) : null) ?? event.subscriber.attributes ?? {};
  const displayNames = resolveDisplayNames(displayNameMap, attributes as Record<string, unknown>);

  const unsubscribeUrl = `${config.unsubscribeBaseUrl}?token=${generateToken(event.subscriber.email, config.unsubscribeSecret)}`;

  const context = {
    email: event.subscriber.email,
    firstName: event.subscriber.firstName,
    ...attributes,
    ...displayNames,
    unsubscribeUrl,
    currentYear: new Date().getFullYear(),
  };

  const htmlBody = await renderTemplate(
    config.templateBucket,
    event.templateKey,
    context as Parameters<typeof renderTemplate>[2],
  );

  const fromAddress = config.defaultFromName
    ? `${config.defaultFromName} <${config.defaultFromEmail}>`
    : config.defaultFromEmail;

  const messageId = await sendEmail({
    from: fromAddress,
    to: event.subscriber.email,
    subject: event.subject,
    htmlBody,
    configurationSetName: config.sesConfigSet,
    unsubscribeUrl,
    replyToAddress: config.replyToEmail || undefined,
    templateKey: event.templateKey,
    sequenceId,
  });

  await writeSendLog(config.tableName, event.subscriber.email, {
    templateKey: event.templateKey,
    sequenceId,
    subject: event.subject,
    sesMessageId: messageId,
  });

  logger.info("Send complete", {
    email: event.subscriber.email,
    templateKey: event.templateKey,
    messageId,
    sequenceId,
  });
  return { sent: true, messageId };
}

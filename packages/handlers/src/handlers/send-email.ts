import { createHash } from "node:crypto";
import { SFNClient, StopExecutionCommand } from "@aws-sdk/client-sfn";
import type { SendEmailInput, RegisterOutput, SendOutput } from "@mailshot/shared";
import type { SQSEvent } from "aws-lambda";
import { resolveConfig } from "../lib/config.js";
import {
  getSubscriberProfile,
  upsertSubscriberProfile,
  extractAttributes,
  getExecution,
  putExecution,
  deleteExecution,
  writeSendLog,
} from "../lib/dynamo-client.js";
import { renderTemplate, renderString } from "../lib/template-renderer.js";
import { sendEmail } from "../lib/ses-sender.js";
import { generateToken } from "../lib/unsubscribe-token.js";
import { loadDisplayNames, resolveDisplayNames } from "../lib/display-names.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("send-email");
const sfn = new SFNClient({});

export const handler = async (
  event: SendEmailInput | SQSEvent,
): Promise<RegisterOutput | SendOutput | { completed: true } | void> => {
  // SQS batch invocation (from broadcast queue)
  if ("Records" in event) {
    for (const record of event.Records) {
      const payload = JSON.parse(record.body) as SendEmailInput;
      await processEvent(payload);
    }
    return;
  }

  return processEvent(event);
};

async function processEvent(
  event: SendEmailInput,
): Promise<RegisterOutput | SendOutput | { completed: true }> {
  logger.info("SendEmail invoked", { action: event.action, email: event.subscriber.email });
  const config = resolveConfig();

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
          sender: event.sender,
        },
        config,
        event.sequenceId ?? "fire_and_forget",
      );
    case "complete":
      logger.info("Completing sequence", {
        email: event.subscriber.email,
        sequenceId: event.sequenceId,
      });
      await deleteExecution(config.tableName, event.subscriber.email, event.sequenceId);
      return { completed: true };
  }
}

async function handleRegister(
  event: Extract<SendEmailInput, { action: "register" }>,
  config: ReturnType<typeof resolveConfig>,
): Promise<RegisterOutput> {
  logger.info("Registering subscriber for sequence", {
    email: event.subscriber.email,
    sequenceId: event.sequenceId,
    executionArn: event.executionArn,
  });

  await upsertSubscriberProfile(config.tableName, event.subscriber);

  // Guard: don't start a sequence for unsubscribed or suppressed subscribers
  const profile = await getSubscriberProfile(config.tableName, event.subscriber.email);
  if (profile?.unsubscribed) {
    logger.info("Skipping registration - subscriber unsubscribed", {
      email: event.subscriber.email,
      sequenceId: event.sequenceId,
    });
    throw new Error(
      `Cannot register sequence for unsubscribed subscriber: ${event.subscriber.email}`,
    );
  }
  if (profile?.suppressed) {
    logger.info("Skipping registration - subscriber suppressed", {
      email: event.subscriber.email,
      sequenceId: event.sequenceId,
    });
    throw new Error(
      `Cannot register sequence for suppressed subscriber: ${event.subscriber.email}`,
    );
  }

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
  config: ReturnType<typeof resolveConfig>,
  sequenceId: string = "unknown",
): Promise<SendOutput> {
  // Resolve A/B variant if present
  let templateKey = event.templateKey ?? "";
  let subject = event.subject ?? "";
  if (event.variants?.length) {
    const index = selectVariant(event.subscriber.email, sequenceId, event.variants.length);
    templateKey = event.variants[index].templateKey;
    subject = event.variants[index].subject;
    logger.info("Selected A/B variant", {
      email: event.subscriber.email,
      variantIndex: index,
      templateKey,
      subject,
    });
  }

  logger.info("Processing send", {
    email: event.subscriber.email,
    templateKey,
    subject,
    sequenceId,
  });

  const profile = await getSubscriberProfile(config.tableName, event.subscriber.email);

  // Pre-send checks
  if (profile?.unsubscribed) {
    logger.info("Skipping send - subscriber unsubscribed", { email: event.subscriber.email });
    return { sent: false, reason: "unsubscribed" };
  }
  if (profile?.suppressed) {
    logger.info("Skipping send - subscriber suppressed", { email: event.subscriber.email });
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

  const renderContext = context as Parameters<typeof renderTemplate>[2];
  const htmlBody = await renderTemplate(config.templateBucket, templateKey, renderContext);
  const renderedSubject = await renderString(subject, renderContext);

  const sender = event.sender;
  if (!sender?.fromEmail) {
    throw new Error("Missing sender.fromEmail in event payload");
  }
  const fromAddress = sender.fromName
    ? `${sender.fromName} <${sender.fromEmail}>`
    : sender.fromEmail;

  const messageId = await sendEmail({
    from: fromAddress,
    to: event.subscriber.email,
    subject: renderedSubject,
    htmlBody,
    configurationSetName: config.sesConfigSet,
    unsubscribeUrl,
    replyToAddress: sender.replyToEmail || undefined,
    templateKey,
    sequenceId,
    listUnsubscribe: sender.listUnsubscribe,
  });

  await writeSendLog(
    config.tableName,
    event.subscriber.email,
    {
      templateKey,
      sequenceId,
      subject: renderedSubject,
      sesMessageId: messageId,
    },
    config.dataTtlDays,
  );

  logger.info("Send complete", {
    email: event.subscriber.email,
    templateKey,
    messageId,
    sequenceId,
  });
  return { sent: true, messageId };
}

function selectVariant(email: string, sequenceId: string, count: number): number {
  const hash = createHash("sha256").update(`${email}:${sequenceId}`).digest();
  return hash.readUInt32BE(0) % count;
}

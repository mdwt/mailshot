import { SFNClient, StopExecutionCommand } from "@aws-sdk/client-sfn";
import type {
  SendEmailInput,
  RegisterOutput,
  SendOutput,
} from "@step-func-emailer/shared";
import { resolveConfig } from "../lib/ssm-config.js";
import {
  getSubscriberProfile,
  upsertSubscriberProfile,
  getExecution,
  putExecution,
  deleteExecution,
  countRecentSends,
  writeSendLog,
} from "../lib/dynamo-client.js";
import { renderTemplate } from "../lib/template-renderer.js";
import { sendEmail } from "../lib/ses-sender.js";
import { generateToken } from "../lib/unsubscribe-token.js";
import {
  loadDisplayNames,
  resolveDisplayNames,
} from "../lib/display-names.js";

const sfn = new SFNClient({});

export const handler = async (
  event: SendEmailInput,
): Promise<RegisterOutput | SendOutput | { completed: true }> => {
  const config = await resolveConfig();

  switch (event.action) {
    case "register":
      return handleRegister(event, config);
    case "send":
      return handleSend(event, config);
    case "fire_and_forget":
      // Upsert profile first, then send
      await upsertSubscriberProfile(config.tableName, event.subscriber);
      return handleSend(
        { action: "send", templateKey: event.templateKey, subject: event.subject, subscriber: event.subscriber },
        config,
        "fire_and_forget",
      );
    case "complete":
      await deleteExecution(
        config.tableName,
        event.subscriber.email,
        event.sequenceId,
      );
      return { completed: true };
  }
};

async function handleRegister(
  event: Extract<SendEmailInput, { action: "register" }>,
  config: Awaited<ReturnType<typeof resolveConfig>>,
): Promise<RegisterOutput> {
  await upsertSubscriberProfile(config.tableName, event.subscriber);

  // Check for existing execution and stop it
  const existing = await getExecution(
    config.tableName,
    event.subscriber.email,
    event.sequenceId,
  );
  if (existing) {
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
    await deleteExecution(
      config.tableName,
      event.subscriber.email,
      event.sequenceId,
    );
  }

  await putExecution(
    config.tableName,
    event.subscriber.email,
    event.sequenceId,
    event.executionArn,
  );

  return { registered: true };
}

async function handleSend(
  event: Extract<SendEmailInput, { action: "send" }>,
  config: Awaited<ReturnType<typeof resolveConfig>>,
  sequenceId: string = "unknown",
): Promise<SendOutput> {
  const profile = await getSubscriberProfile(
    config.tableName,
    event.subscriber.email,
  );

  // Pre-send checks
  if (profile?.unsubscribed) {
    return { sent: false, reason: "unsubscribed" };
  }
  if (profile?.suppressed) {
    return { sent: false, reason: "suppressed" };
  }

  const recentCount = await countRecentSends(
    config.tableName,
    event.subscriber.email,
    config.rateLimitWindowHours,
  );
  if (recentCount >= config.rateLimitCount) {
    return { sent: false, reason: "rate_limited" };
  }

  // Load display names and build context
  const displayNameMap = await loadDisplayNames(config.templateBucket);
  const attributes = profile?.attributes ?? event.subscriber.attributes ?? {};
  const displayNames = resolveDisplayNames(
    displayNameMap,
    attributes as Record<string, unknown>,
  );

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
  });

  await writeSendLog(config.tableName, event.subscriber.email, {
    templateKey: event.templateKey,
    sequenceId,
    subject: event.subject,
    sesMessageId: messageId,
  });

  return { sent: true, messageId };
}

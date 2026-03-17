import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { createLogger } from "./logger.js";

const logger = createLogger("ses-sender");
const ses = new SESv2Client({});

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  configurationSetName: string;
  unsubscribeUrl: string;
  replyToAddress?: string;
  templateKey: string;
  sequenceId: string;
}

/**
 * Strip HTML to plain text for the text/plain MIME part.
 * Handles common email HTML patterns without requiring an external dependency.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  - ")
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendEmail(params: SendEmailParams): Promise<string> {
  logger.info("Sending email via SES", {
    to: params.to,
    subject: params.subject,
    templateKey: params.templateKey,
    sequenceId: params.sequenceId,
  });

  const textBody = htmlToPlainText(params.htmlBody);

  const result = await ses.send(
    new SendEmailCommand({
      FromEmailAddress: params.from,
      Destination: { ToAddresses: [params.to] },
      ...(params.replyToAddress ? { ReplyToAddresses: [params.replyToAddress] } : {}),
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: params.htmlBody, Charset: "UTF-8" },
            Text: { Data: textBody, Charset: "UTF-8" },
          },
          Headers: [
            {
              Name: "List-Unsubscribe",
              Value: `<${params.unsubscribeUrl}>`,
            },
            {
              Name: "List-Unsubscribe-Post",
              Value: "List-Unsubscribe=One-Click",
            },
            {
              Name: "X-Template-Key",
              Value: params.templateKey,
            },
            {
              Name: "X-Sequence-Id",
              Value: params.sequenceId,
            },
          ],
        },
      },
      ConfigurationSetName: params.configurationSetName,
      EmailTags: [
        { Name: "templateKey", Value: params.templateKey },
        { Name: "sequenceId", Value: params.sequenceId },
      ],
    }),
  );

  const messageId = result.MessageId ?? "unknown";
  logger.info("Email sent successfully", {
    messageId,
    to: params.to,
    templateKey: params.templateKey,
  });
  return messageId;
}

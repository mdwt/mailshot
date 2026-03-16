import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({});

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  configurationSetName: string;
  unsubscribeUrl: string;
}

export async function sendEmail(params: SendEmailParams): Promise<string> {
  const result = await ses.send(
    new SendEmailCommand({
      FromEmailAddress: params.from,
      Destination: { ToAddresses: [params.to] },
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: params.htmlBody, Charset: "UTF-8" },
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
          ],
        },
      },
      ConfigurationSetName: params.configurationSetName,
    }),
  );

  return result.MessageId ?? "unknown";
}

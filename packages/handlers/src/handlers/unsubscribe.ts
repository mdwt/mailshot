import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { resolveConfig } from "../lib/ssm-config.js";
import { validateToken } from "../lib/unsubscribe-token.js";
import { setProfileFlag } from "../lib/dynamo-client.js";
import { stopAllExecutions } from "../lib/execution-stopper.js";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
};

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;text-align:center;color:#333}h1{font-size:24px}p{font-size:16px;line-height:1.5;color:#666}</style>
</head><body>${body}</body></html>`;
}

export const handler = async (
  event: { queryStringParameters?: Record<string, string | undefined> },
): Promise<APIGatewayProxyResultV2> => {
  const token = event.queryStringParameters?.token;
  if (!token) {
    return {
      statusCode: 400,
      headers: HTML_HEADERS,
      body: htmlPage(
        "Invalid Request",
        "<h1>Invalid Request</h1><p>No unsubscribe token provided.</p>",
      ),
    };
  }

  const config = await resolveConfig();
  const result = validateToken(token, config.unsubscribeSecret);

  if (!result.valid) {
    return {
      statusCode: 400,
      headers: HTML_HEADERS,
      body: htmlPage(
        "Invalid Link",
        `<h1>Invalid Link</h1><p>This unsubscribe link is ${result.reason === "token expired" ? "expired" : "invalid"}. Please contact support if you need help.</p>`,
      ),
    };
  }

  await setProfileFlag(config.tableName, result.email, "unsubscribed");
  await stopAllExecutions(config.tableName, result.email);

  return {
    statusCode: 200,
    headers: HTML_HEADERS,
    body: htmlPage(
      "Unsubscribed",
      "<h1>You've been unsubscribed</h1><p>You won't receive any more emails from us. If this was a mistake, please contact support.</p>",
    ),
  };
};

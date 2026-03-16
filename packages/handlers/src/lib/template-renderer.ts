import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Liquid } from "liquidjs";
import { TEMPLATE_CACHE_TTL_MS } from "@step-func-emailer/shared";

const s3 = new S3Client({});
const liquid = new Liquid();

// Module-level cache survives across warm invocations
const templateCache = new Map<
  string,
  { html: string; fetchedAt: number }
>();

async function fetchTemplate(
  bucket: string,
  templateKey: string,
): Promise<string> {
  const cached = templateCache.get(templateKey);
  if (cached && Date.now() - cached.fetchedAt < TEMPLATE_CACHE_TTL_MS) {
    return cached.html;
  }

  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: `${templateKey}.html`,
    }),
  );

  const html = (await result.Body?.transformToString()) ?? "";
  templateCache.set(templateKey, { html, fetchedAt: Date.now() });
  return html;
}

export interface RenderContext {
  email: string;
  firstName: string;
  unsubscribeUrl: string;
  currentYear: number;
  [key: string]: unknown;
}

export async function renderTemplate(
  bucket: string,
  templateKey: string,
  context: RenderContext,
): Promise<string> {
  const html = await fetchTemplate(bucket, templateKey);
  return liquid.parseAndRender(html, context);
}

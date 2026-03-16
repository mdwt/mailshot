import { createHmac } from "node:crypto";

const EXPIRY_DAYS = 90;

export function generateToken(email: string, secret: string): string {
  const sendTimestamp = new Date().toISOString();
  const expiry = new Date(
    Date.now() + EXPIRY_DAYS * 24 * 3600 * 1000,
  ).toISOString();

  const payload = `${email}|${sendTimestamp}|${expiry}`;
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const token = Buffer.from(`${payload}|${signature}`).toString("base64url");
  return token;
}

export interface ValidatedToken {
  valid: true;
  email: string;
  sendTimestamp: string;
  expiryTimestamp: string;
}

export interface InvalidToken {
  valid: false;
  reason: string;
}

export function validateToken(
  token: string,
  secret: string,
): ValidatedToken | InvalidToken {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 4) {
      return { valid: false, reason: "malformed token" };
    }

    const [email, sendTimestamp, expiryTimestamp, signature] = parts;

    const payload = `${email}|${sendTimestamp}|${expiryTimestamp}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (signature !== expectedSignature) {
      return { valid: false, reason: "invalid signature" };
    }

    if (new Date(expiryTimestamp) < new Date()) {
      return { valid: false, reason: "token expired" };
    }

    return { valid: true, email, sendTimestamp, expiryTimestamp };
  } catch {
    return { valid: false, reason: "invalid token format" };
  }
}

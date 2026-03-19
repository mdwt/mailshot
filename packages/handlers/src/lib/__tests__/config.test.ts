import { describe, it, expect, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("resolveConfig", () => {
  // Re-import each test to pick up fresh env
  async function loadResolveConfig() {
    const mod = await import("../config.js");
    return mod.resolveConfig;
  }

  it("reads all config from environment variables", async () => {
    process.env.TABLE_NAME = "MainTable";
    process.env.EVENTS_TABLE_NAME = "EventsTable";
    process.env.TEMPLATE_BUCKET = "my-bucket";
    process.env.DEFAULT_FROM_EMAIL = "noreply@example.com";
    process.env.DEFAULT_FROM_NAME = "Example";
    process.env.REPLY_TO_EMAIL = "reply@example.com";
    process.env.SES_CONFIG_SET = "my-config-set";
    process.env.UNSUBSCRIBE_BASE_URL = "https://unsub.example.com";
    process.env.UNSUBSCRIBE_SECRET = "secret123";

    const resolveConfig = await loadResolveConfig();
    const config = resolveConfig();

    expect(config).toEqual({
      tableName: "MainTable",
      eventsTableName: "EventsTable",
      templateBucket: "my-bucket",
      defaultFromEmail: "noreply@example.com",
      defaultFromName: "Example",
      replyToEmail: "reply@example.com",
      sesConfigSet: "my-config-set",
      unsubscribeBaseUrl: "https://unsub.example.com",
      unsubscribeSecret: "secret123",
    });
  });

  it("throws when a required variable is missing", async () => {
    // Set all but TABLE_NAME
    process.env.EVENTS_TABLE_NAME = "EventsTable";
    process.env.TEMPLATE_BUCKET = "my-bucket";
    process.env.DEFAULT_FROM_EMAIL = "noreply@example.com";
    process.env.DEFAULT_FROM_NAME = "Example";
    process.env.SES_CONFIG_SET = "my-config-set";
    process.env.UNSUBSCRIBE_BASE_URL = "https://unsub.example.com";
    process.env.UNSUBSCRIBE_SECRET = "secret123";
    delete process.env.TABLE_NAME;

    const resolveConfig = await loadResolveConfig();
    expect(() => resolveConfig()).toThrow("Missing required environment variable: TABLE_NAME");
  });

  it("defaults replyToEmail to empty string when not set", async () => {
    process.env.TABLE_NAME = "MainTable";
    process.env.EVENTS_TABLE_NAME = "EventsTable";
    process.env.TEMPLATE_BUCKET = "my-bucket";
    process.env.DEFAULT_FROM_EMAIL = "noreply@example.com";
    process.env.DEFAULT_FROM_NAME = "Example";
    process.env.SES_CONFIG_SET = "my-config-set";
    process.env.UNSUBSCRIBE_BASE_URL = "https://unsub.example.com";
    process.env.UNSUBSCRIBE_SECRET = "secret123";
    delete process.env.REPLY_TO_EMAIL;

    const resolveConfig = await loadResolveConfig();
    const config = resolveConfig();

    expect(config.replyToEmail).toBe("");
  });

  it("defaults unsubscribeBaseUrl to empty string when not set", async () => {
    process.env.TABLE_NAME = "MainTable";
    process.env.EVENTS_TABLE_NAME = "EventsTable";
    process.env.TEMPLATE_BUCKET = "my-bucket";
    process.env.DEFAULT_FROM_EMAIL = "noreply@example.com";
    process.env.DEFAULT_FROM_NAME = "Example";
    process.env.SES_CONFIG_SET = "my-config-set";
    process.env.UNSUBSCRIBE_SECRET = "secret123";
    delete process.env.UNSUBSCRIBE_BASE_URL;

    const resolveConfig = await loadResolveConfig();
    const config = resolveConfig();

    expect(config.unsubscribeBaseUrl).toBe("");
  });
});

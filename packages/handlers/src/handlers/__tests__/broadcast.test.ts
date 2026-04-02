import { vi } from "vitest";

const mockResolveConfig = vi.fn();
const mockGetSubscriberEmailsByTag = vi.fn();
const mockBatchGetSubscriberProfiles = vi.fn();
const mockScanActiveSubscribers = vi.fn();
const mockExtractAttributes = vi.fn();
const mockWriteBroadcastRecord = vi.fn();

const mockSqsSend = vi.fn();
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class {
    send = mockSqsSend;
  },
  SendMessageBatchCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("../../lib/config.js", () => ({
  resolveConfig: () => mockResolveConfig(),
}));

vi.mock("../../lib/dynamo-client.js", () => ({
  getSubscriberEmailsByTag: (...args: unknown[]) => mockGetSubscriberEmailsByTag(...args),
  batchGetSubscriberProfiles: (...args: unknown[]) => mockBatchGetSubscriberProfiles(...args),
  scanActiveSubscribers: (...args: unknown[]) => mockScanActiveSubscribers(...args),
  extractAttributes: (...args: unknown[]) => mockExtractAttributes(...args),
  writeBroadcastRecord: (...args: unknown[]) => mockWriteBroadcastRecord(...args),
}));

const CONFIG = {
  tableName: "TestTable",
  eventsTableName: "EventsTable",
  templateBucket: "my-bucket",
  sesConfigSet: "my-config-set",
  unsubscribeBaseUrl: "https://unsub.example.com",
  unsubscribeSecret: "test-secret",
};

const TEST_SENDER = {
  fromEmail: "updates@example.com",
  fromName: "My SaaS",
};

beforeEach(() => {
  mockResolveConfig.mockReset().mockReturnValue(CONFIG);
  mockGetSubscriberEmailsByTag.mockReset();
  mockBatchGetSubscriberProfiles.mockReset();
  mockScanActiveSubscribers.mockReset();
  mockExtractAttributes.mockReset().mockReturnValue({});
  mockWriteBroadcastRecord.mockReset().mockResolvedValue(undefined);
  mockSqsSend.mockReset().mockResolvedValue({});
  process.env.BROADCAST_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123/broadcast-queue";
});

const { handler } = await import("../broadcast.js");

describe("broadcast handler", () => {
  it("queries by tag and sends SQS messages", async () => {
    mockGetSubscriberEmailsByTag.mockResolvedValueOnce(["alice@example.com", "bob@example.com"]);
    mockBatchGetSubscriberProfiles.mockResolvedValueOnce([
      {
        email: "alice@example.com",
        firstName: "Alice",
        unsubscribed: false,
        suppressed: false,
      },
      {
        email: "bob@example.com",
        firstName: "Bob",
        unsubscribed: false,
        suppressed: false,
      },
    ]);

    const result = await handler({
      broadcastId: "update-april",
      templateKey: "broadcasts/product-update",
      subject: "What's new",
      sender: TEST_SENDER,
      filters: { tags: ["product-updates"] },
    });

    expect(result.subscriberCount).toBe(2);
    expect(result.dryRun).toBe(false);
    expect(mockGetSubscriberEmailsByTag).toHaveBeenCalledWith("TestTable", "product-updates");
    expect(mockSqsSend).toHaveBeenCalledTimes(1);
  });

  it("filters out unsubscribed subscribers", async () => {
    mockGetSubscriberEmailsByTag.mockResolvedValueOnce(["active@example.com", "unsub@example.com"]);
    mockBatchGetSubscriberProfiles.mockResolvedValueOnce([
      {
        email: "active@example.com",
        firstName: "Active",
        unsubscribed: false,
        suppressed: false,
      },
      {
        email: "unsub@example.com",
        firstName: "Unsub",
        unsubscribed: true,
        suppressed: false,
      },
    ]);

    const result = await handler({
      broadcastId: "update-april",
      templateKey: "broadcasts/product-update",
      subject: "What's new",
      sender: TEST_SENDER,
      filters: { tags: ["product-updates"] },
    });

    expect(result.subscriberCount).toBe(1);
    expect(result.dryRun).toBe(false);
  });

  it("intersects multiple tags (AND logic)", async () => {
    mockGetSubscriberEmailsByTag
      .mockResolvedValueOnce(["alice@example.com", "bob@example.com"])
      .mockResolvedValueOnce(["alice@example.com", "charlie@example.com"]);
    mockBatchGetSubscriberProfiles.mockResolvedValueOnce([
      {
        email: "alice@example.com",
        firstName: "Alice",
        unsubscribed: false,
        suppressed: false,
      },
    ]);

    const result = await handler({
      broadcastId: "update-april",
      templateKey: "broadcasts/product-update",
      subject: "What's new",
      sender: TEST_SENDER,
      filters: { tags: ["product-updates", "beta"] },
    });

    expect(result.subscriberCount).toBe(1);
    expect(mockGetSubscriberEmailsByTag).toHaveBeenCalledTimes(2);
  });

  it("scans all active subscribers when no filters", async () => {
    mockScanActiveSubscribers.mockResolvedValueOnce([
      {
        email: "user@example.com",
        firstName: "User",
        unsubscribed: false,
        suppressed: false,
      },
    ]);

    const result = await handler({
      broadcastId: "update-april",
      templateKey: "broadcasts/product-update",
      subject: "What's new",
      sender: TEST_SENDER,
    });

    expect(result.subscriberCount).toBe(1);
    expect(mockScanActiveSubscribers).toHaveBeenCalledWith("TestTable", undefined);
  });

  it("returns zero when no subscribers match", async () => {
    mockGetSubscriberEmailsByTag.mockResolvedValueOnce([]);

    const result = await handler({
      broadcastId: "update-april",
      templateKey: "broadcasts/product-update",
      subject: "What's new",
      sender: TEST_SENDER,
      filters: { tags: ["nonexistent-tag"] },
    });

    expect(result.subscriberCount).toBe(0);
    expect(result.dryRun).toBe(false);
    expect(mockSqsSend).not.toHaveBeenCalled();
  });

  it("throws when BROADCAST_QUEUE_URL is not set", async () => {
    delete process.env.BROADCAST_QUEUE_URL;
    mockScanActiveSubscribers.mockResolvedValueOnce([
      { email: "a@example.com", firstName: "A", unsubscribed: false, suppressed: false },
    ]);

    await expect(
      handler({
        broadcastId: "update-april",
        templateKey: "broadcasts/product-update",
        subject: "What's new",
        sender: TEST_SENDER,
      }),
    ).rejects.toThrow("BROADCAST_QUEUE_URL");
  });

  it("applies attribute filters when tags and attributes provided", async () => {
    mockGetSubscriberEmailsByTag.mockResolvedValueOnce(["pro@example.com", "free@example.com"]);
    mockBatchGetSubscriberProfiles.mockResolvedValueOnce([
      {
        email: "pro@example.com",
        firstName: "Pro",
        unsubscribed: false,
        suppressed: false,
        plan: "pro",
      },
      {
        email: "free@example.com",
        firstName: "Free",
        unsubscribed: false,
        suppressed: false,
        plan: "free",
      },
    ]);

    const result = await handler({
      broadcastId: "update-april",
      templateKey: "broadcasts/product-update",
      subject: "What's new",
      sender: TEST_SENDER,
      filters: { tags: ["product-updates"], attributes: { plan: "pro" } },
    });

    expect(result.subscriberCount).toBe(1);
  });
});

import { vi } from "vitest";
import type { SNSEvent } from "aws-lambda";

const mockResolveConfig = vi.fn();
const mockSend = vi.fn();
const mockIncrementSequenceCounter = vi.fn();

vi.mock("../../lib/config.js", () => ({
  resolveConfig: () => mockResolveConfig(),
}));

vi.mock("../../lib/dynamo-client.js", () => ({
  incrementSequenceCounter: (...args: unknown[]) => mockIncrementSequenceCounter(...args),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class {
    send = mockSend;
  },
  PutItemCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

// Re-export real marshall/unmarshall
vi.mock("@aws-sdk/util-dynamodb", async () => {
  const actual = await vi.importActual("@aws-sdk/util-dynamodb");
  return actual;
});

const { handler } = await import("../engagement-handler.js");

const CONFIG = {
  tableName: "TestTable",
  eventsTableName: "EventsTable",
};

function snsEvent(message: unknown): SNSEvent {
  return {
    Records: [{ Sns: { Message: JSON.stringify(message) } }],
  } as SNSEvent;
}

const baseHeaders = [
  { name: "Subject", value: "Welcome!" },
  { name: "X-Template-Key", value: "onboarding/welcome" },
  { name: "X-Sequence-Id", value: "onboarding" },
];

beforeEach(() => {
  mockResolveConfig.mockReset().mockReturnValue(CONFIG);
  mockSend.mockReset().mockResolvedValue({});
  mockIncrementSequenceCounter.mockReset().mockResolvedValue(undefined);
});

describe("engagement-handler", () => {
  it("writes delivery event to events table", async () => {
    const event = snsEvent({
      eventType: "Delivery",
      mail: {
        messageId: "msg-1",
        destination: ["user@example.com"],
        headers: baseHeaders,
      },
      delivery: { timestamp: "2026-01-15T10:00:00.000Z" },
    });

    await handler(event);

    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.TableName).toBe("EventsTable");
  });

  it("writes click event with link URL", async () => {
    const event = snsEvent({
      eventType: "Click",
      mail: {
        messageId: "msg-2",
        destination: ["user@example.com"],
        headers: baseHeaders,
      },
      click: {
        timestamp: "2026-01-15T10:00:00.000Z",
        link: "https://example.com/promo",
        userAgent: "Mozilla/5.0",
      },
    });

    await handler(event);

    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("writes open event with user agent", async () => {
    const event = snsEvent({
      eventType: "Open",
      mail: {
        messageId: "msg-3",
        destination: ["user@example.com"],
        headers: baseHeaders,
      },
      open: {
        timestamp: "2026-01-15T10:00:00.000Z",
        userAgent: "Apple Mail",
      },
    });

    await handler(event);

    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("handles bounce event with multiple recipients", async () => {
    const event = snsEvent({
      eventType: "Bounce",
      mail: {
        messageId: "msg-4",
        destination: ["a@example.com"],
        headers: baseHeaders,
      },
      bounce: {
        bounceType: "Permanent",
        bouncedRecipients: [{ emailAddress: "a@example.com" }, { emailAddress: "b@example.com" }],
        timestamp: "2026-01-15T10:00:00.000Z",
      },
    });

    await handler(event);

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("defaults sequenceId to fire_and_forget when header missing", async () => {
    const event = snsEvent({
      eventType: "Delivery",
      mail: {
        messageId: "msg-5",
        destination: ["user@example.com"],
        headers: [{ name: "Subject", value: "Hello" }],
      },
      delivery: { timestamp: "2026-01-15T10:00:00.000Z" },
    });

    await handler(event);

    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("increments sequence counter for delivery events", async () => {
    const event = snsEvent({
      eventType: "Delivery",
      mail: {
        messageId: "msg-c1",
        destination: ["user@example.com"],
        headers: baseHeaders,
      },
      delivery: { timestamp: "2026-01-15T10:00:00.000Z" },
    });

    await handler(event);

    expect(mockIncrementSequenceCounter).toHaveBeenCalledOnce();
    expect(mockIncrementSequenceCounter).toHaveBeenCalledWith(
      "TestTable",
      "onboarding",
      "delivery",
    );
  });

  it("does not throw when counter update fails", async () => {
    mockIncrementSequenceCounter.mockRejectedValueOnce(new Error("throttled"));
    const event = snsEvent({
      eventType: "Delivery",
      mail: {
        messageId: "msg-c2",
        destination: ["user@example.com"],
        headers: baseHeaders,
      },
      delivery: { timestamp: "2026-01-15T10:00:00.000Z" },
    });

    await expect(handler(event)).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("skips unknown event types", async () => {
    const event = snsEvent({
      eventType: "UnknownType",
      mail: {
        messageId: "msg-6",
        destination: ["user@example.com"],
        headers: baseHeaders,
      },
    });

    await handler(event);

    expect(mockSend).not.toHaveBeenCalled();
  });
});

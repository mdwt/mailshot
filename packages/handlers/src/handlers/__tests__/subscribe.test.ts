import { vi } from "vitest";

const mockResolveConfig = vi.fn();
const mockUpsertSubscriberProfile = vi.fn();

vi.mock("../../lib/config.js", () => ({
  resolveConfig: () => mockResolveConfig(),
}));

vi.mock("../../lib/dynamo-client.js", () => ({
  upsertSubscriberProfile: (...args: unknown[]) => mockUpsertSubscriberProfile(...args),
}));

const { handler } = await import("../subscribe.js");

const CONFIG = {
  tableName: "TestTable",
  eventsTableName: "EventsTable",
  templateBucket: "my-bucket",
  sesConfigSet: "my-config-set",
  unsubscribeBaseUrl: "https://unsub.example.com",
  unsubscribeSecret: "test-secret",
};

beforeEach(() => {
  mockResolveConfig.mockReset().mockReturnValue(CONFIG);
  mockUpsertSubscriberProfile.mockReset().mockResolvedValue(undefined);
});

describe("subscribe handler", () => {
  it("upserts subscriber profile with tags", async () => {
    const event = {
      subscriber: {
        email: "user@example.com",
        firstName: "John",
        attributes: { plan: "pro" },
        tags: ["product-updates", "beta"],
      },
    };

    const result = await handler(event);

    expect(result).toEqual({ subscribed: true });
    expect(mockUpsertSubscriberProfile).toHaveBeenCalledWith("TestTable", event.subscriber);
  });

  it("works without tags", async () => {
    const event = {
      subscriber: {
        email: "user@example.com",
        firstName: "Jane",
      },
    };

    const result = await handler(event);

    expect(result).toEqual({ subscribed: true });
    expect(mockUpsertSubscriberProfile).toHaveBeenCalledWith("TestTable", event.subscriber);
  });

  it("works with attributes and no tags", async () => {
    const event = {
      subscriber: {
        email: "user@example.com",
        firstName: "Jane",
        attributes: { country: "US", plan: "free" },
      },
    };

    const result = await handler(event);

    expect(result).toEqual({ subscribed: true });
    expect(mockUpsertSubscriberProfile).toHaveBeenCalledWith("TestTable", event.subscriber);
  });
});

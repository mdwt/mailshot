import { vi } from "vitest";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const mockSend = vi.fn();
class MockCommand {
  _type: string;
  input: unknown;
  constructor(type: string, input: unknown) {
    this._type = type;
    this.input = input;
  }
}
vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class {
    send = mockSend;
  },
  GetItemCommand: class extends MockCommand {
    constructor(input: unknown) {
      super("GetItem", input);
    }
  },
  PutItemCommand: class extends MockCommand {
    constructor(input: unknown) {
      super("PutItem", input);
    }
  },
  UpdateItemCommand: class extends MockCommand {
    constructor(input: unknown) {
      super("UpdateItem", input);
    }
  },
  DeleteItemCommand: class extends MockCommand {
    constructor(input: unknown) {
      super("DeleteItem", input);
    }
  },
  QueryCommand: class extends MockCommand {
    constructor(input: unknown) {
      super("Query", input);
    }
  },
  ScanCommand: class extends MockCommand {
    constructor(input: unknown) {
      super("Scan", input);
    }
  },
  BatchGetItemCommand: class extends MockCommand {
    constructor(input: unknown) {
      super("BatchGetItem", input);
    }
  },
}));

const {
  getSubscriberProfile,
  upsertSubscriberProfile,
  extractAttributes,
  getExecution,
  putExecution,
  deleteExecution,
  getAllExecutions,
  writeSendLog,
  hasBeenSent,
  writeSuppression,
  setProfileFlag,
  syncTags,
  getSubscriberEmailsByTag,
  batchGetSubscriberProfiles,
  scanActiveSubscribers,
} = await import("../dynamo-client.js");

beforeEach(() => {
  mockSend.mockReset();
});

describe("getSubscriberProfile", () => {
  it("returns profile when item exists", async () => {
    const profile = {
      PK: "SUB#user@example.com",
      SK: "PROFILE",
      email: "user@example.com",
      firstName: "Jane",
      unsubscribed: false,
      suppressed: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockSend.mockResolvedValueOnce({ Item: marshall(profile) });

    const result = await getSubscriberProfile("TestTable", "user@example.com");
    expect(result).toEqual(profile);
  });

  it("returns null when item does not exist", async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await getSubscriberProfile("TestTable", "nobody@example.com");
    expect(result).toBeNull();
  });
});

describe("upsertSubscriberProfile", () => {
  it("sends UpdateItemCommand with correct key", async () => {
    mockSend.mockResolvedValueOnce({});

    await upsertSubscriberProfile("TestTable", {
      email: "user@example.com",
      firstName: "Jane",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._type).toBe("UpdateItem");
    expect(cmd.input.TableName).toBe("TestTable");
    // Verify key contains the correct PK
    const key = unmarshall(cmd.input.Key);
    expect(key.PK).toBe("SUB#user@example.com");
    expect(key.SK).toBe("PROFILE");
  });

  it("includes attribute expressions for subscriber attributes", async () => {
    mockSend.mockResolvedValueOnce({});

    await upsertSubscriberProfile("TestTable", {
      email: "user@example.com",
      firstName: "Jane",
      attributes: { platform: "web", plan: "pro" },
    });

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.UpdateExpression).toContain("#attr_platform = :attr_platform");
    expect(cmd.input.UpdateExpression).toContain("#attr_plan = :attr_plan");
    expect(cmd.input.UpdateExpression).not.toContain("attributes.#attr_");
    expect(cmd.input.ExpressionAttributeNames?.["#attr_platform"]).toBe("platform");
  });
});

describe("extractAttributes", () => {
  it("returns only non-system keys", () => {
    const result = extractAttributes({
      PK: "SUB#user@example.com",
      SK: "PROFILE",
      email: "user@example.com",
      firstName: "Jane",
      unsubscribed: false,
      suppressed: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      platform: "web",
      country: "US",
    });
    expect(result).toEqual({ platform: "web", country: "US" });
  });

  it("returns empty object when no custom attributes", () => {
    const result = extractAttributes({
      PK: "SUB#user@example.com",
      SK: "PROFILE",
      email: "user@example.com",
      firstName: "Jane",
      unsubscribed: false,
      suppressed: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result).toEqual({});
  });
});

describe("getExecution", () => {
  it("returns execution when found", async () => {
    const exec = {
      PK: "SUB#user@example.com",
      SK: "EXEC#onboarding",
      executionArn: "arn:aws:states:us-east-1:123:execution:abc",
      sequenceId: "onboarding",
      startedAt: "2026-01-01T00:00:00.000Z",
    };
    mockSend.mockResolvedValueOnce({ Item: marshall(exec) });

    const result = await getExecution("TestTable", "user@example.com", "onboarding");
    expect(result).toEqual(exec);
  });

  it("returns null when not found", async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await getExecution("TestTable", "user@example.com", "onboarding");
    expect(result).toBeNull();
  });
});

describe("putExecution", () => {
  it("stores execution with correct keys", async () => {
    mockSend.mockResolvedValueOnce({});

    await putExecution(
      "TestTable",
      "user@example.com",
      "onboarding",
      "arn:aws:states:us-east-1:123:execution:abc",
    );

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._type).toBe("PutItem");
    const item = unmarshall(cmd.input.Item);
    expect(item.PK).toBe("SUB#user@example.com");
    expect(item.SK).toBe("EXEC#onboarding");
    expect(item.executionArn).toBe("arn:aws:states:us-east-1:123:execution:abc");
    expect(item.sequenceId).toBe("onboarding");
    expect(item.startedAt).toBeTruthy();
  });
});

describe("deleteExecution", () => {
  it("deletes with correct key", async () => {
    mockSend.mockResolvedValueOnce({});

    await deleteExecution("TestTable", "user@example.com", "onboarding");

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._type).toBe("DeleteItem");
    const key = unmarshall(cmd.input.Key);
    expect(key.PK).toBe("SUB#user@example.com");
    expect(key.SK).toBe("EXEC#onboarding");
  });
});

describe("getAllExecutions", () => {
  it("returns all executions for subscriber", async () => {
    const execs = [
      {
        PK: "SUB#user@example.com",
        SK: "EXEC#onboarding",
        executionArn: "arn:1",
        sequenceId: "onboarding",
        startedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        PK: "SUB#user@example.com",
        SK: "EXEC#win-back",
        executionArn: "arn:2",
        sequenceId: "win-back",
        startedAt: "2026-01-02T00:00:00.000Z",
      },
    ];
    mockSend.mockResolvedValueOnce({
      Items: execs.map((e) => marshall(e)),
    });

    const result = await getAllExecutions("TestTable", "user@example.com");
    expect(result).toHaveLength(2);
    expect(result[0].sequenceId).toBe("onboarding");
    expect(result[1].sequenceId).toBe("win-back");
  });

  it("returns empty array when no executions exist", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    const result = await getAllExecutions("TestTable", "user@example.com");
    expect(result).toEqual([]);
  });
});

describe("writeSendLog", () => {
  it("writes send log with TTL", async () => {
    mockSend.mockResolvedValueOnce({});

    await writeSendLog(
      "TestTable",
      "user@example.com",
      {
        templateKey: "onboarding/welcome",
        sequenceId: "onboarding",
        subject: "Welcome!",
        sesMessageId: "msg-123",
      },
      90,
    );

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._type).toBe("PutItem");
    const item = unmarshall(cmd.input.Item);
    expect(item.PK).toBe("SUB#user@example.com");
    expect(item.SK).toMatch(/^SENT#/);
    expect(item.templateKey).toBe("onboarding/welcome");
    expect(item.ttl).toBeGreaterThan(0);
  });

  it("omits ttl when ttlDays is not provided", async () => {
    mockSend.mockResolvedValueOnce({});

    await writeSendLog("TestTable", "user@example.com", {
      templateKey: "onboarding/welcome",
      sequenceId: "onboarding",
      subject: "Welcome!",
      sesMessageId: "msg-123",
    });

    const cmd = mockSend.mock.calls[0][0];
    const item = unmarshall(cmd.input.Item);
    expect(item.ttl).toBeUndefined();
  });
});

describe("hasBeenSent", () => {
  it("returns true when matching send log exists", async () => {
    mockSend.mockResolvedValueOnce({ Count: 1, Items: [{}] });

    const result = await hasBeenSent("TestTable", "user@example.com", "onboarding/welcome");
    expect(result).toBe(true);
  });

  it("returns false when no matching send log", async () => {
    mockSend.mockResolvedValueOnce({ Count: 0, Items: [] });

    const result = await hasBeenSent("TestTable", "user@example.com", "onboarding/welcome");
    expect(result).toBe(false);
  });
});

describe("writeSuppression", () => {
  it("writes bounce suppression record", async () => {
    mockSend.mockResolvedValueOnce({});

    await writeSuppression(
      "TestTable",
      "user@example.com",
      "bounce",
      "Permanent",
      "feedback-id-123",
    );

    const cmd = mockSend.mock.calls[0][0];
    const item = unmarshall(cmd.input.Item);
    expect(item.PK).toBe("SUB#user@example.com");
    expect(item.SK).toBe("SUPPRESSION");
    expect(item.reason).toBe("bounce");
    expect(item.bounceType).toBe("Permanent");
    expect(item.sesNotificationId).toBe("feedback-id-123");
  });

  it("writes complaint suppression without bounceType", async () => {
    mockSend.mockResolvedValueOnce({});

    await writeSuppression(
      "TestTable",
      "user@example.com",
      "complaint",
      undefined,
      "feedback-id-456",
    );

    const cmd = mockSend.mock.calls[0][0];
    const item = unmarshall(cmd.input.Item);
    expect(item.reason).toBe("complaint");
    expect(item.bounceType).toBeUndefined();
  });
});

describe("setProfileFlag", () => {
  it("sets unsubscribed flag", async () => {
    mockSend.mockResolvedValueOnce({});

    await setProfileFlag("TestTable", "user@example.com", "unsubscribed");

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._type).toBe("UpdateItem");
    expect(cmd.input.ExpressionAttributeNames?.["#flag"]).toBe("unsubscribed");
  });

  it("sets suppressed flag", async () => {
    mockSend.mockResolvedValueOnce({});

    await setProfileFlag("TestTable", "user@example.com", "suppressed");

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.ExpressionAttributeNames?.["#flag"]).toBe("suppressed");
  });
});

// ── Tag operations ─────────────────────────────────────────────────────────

describe("syncTags", () => {
  it("writes inverted index items and updates PROFILE for new tags", async () => {
    // getSubscriberProfile returns profile with no existing tags
    mockSend
      .mockResolvedValueOnce({
        Item: marshall({
          PK: "SUB#user@example.com",
          SK: "PROFILE",
          email: "user@example.com",
          firstName: "Jane",
          unsubscribed: false,
          suppressed: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
      })
      // PutItem for tag 1
      .mockResolvedValueOnce({})
      // PutItem for tag 2
      .mockResolvedValueOnce({})
      // UpdateItem for PROFILE tags
      .mockResolvedValueOnce({});

    await syncTags("TestTable", "user@example.com", ["product-updates", "beta"]);

    // GetItem for profile
    expect(mockSend.mock.calls[0][0]._type).toBe("GetItem");
    // Two PutItems for inverted index
    expect(mockSend.mock.calls[1][0]._type).toBe("PutItem");
    expect(unmarshall(mockSend.mock.calls[1][0].input.Item).PK).toBe("TAG#product-updates");
    expect(mockSend.mock.calls[2][0]._type).toBe("PutItem");
    expect(unmarshall(mockSend.mock.calls[2][0].input.Item).PK).toBe("TAG#beta");
    // UpdateItem for PROFILE
    expect(mockSend.mock.calls[3][0]._type).toBe("UpdateItem");
  });

  it("removes old tags and adds new ones", async () => {
    mockSend
      .mockResolvedValueOnce({
        Item: marshall({
          PK: "SUB#user@example.com",
          SK: "PROFILE",
          email: "user@example.com",
          firstName: "Jane",
          unsubscribed: false,
          suppressed: false,
          tags: ["old-tag"],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
      })
      // PutItem for new-tag
      .mockResolvedValueOnce({})
      // DeleteItem for old-tag
      .mockResolvedValueOnce({})
      // UpdateItem for PROFILE tags
      .mockResolvedValueOnce({});

    await syncTags("TestTable", "user@example.com", ["new-tag"]);

    // PutItem for new tag
    expect(unmarshall(mockSend.mock.calls[1][0].input.Item).PK).toBe("TAG#new-tag");
    // DeleteItem for old tag
    expect(mockSend.mock.calls[2][0]._type).toBe("DeleteItem");
    expect(unmarshall(mockSend.mock.calls[2][0].input.Key).PK).toBe("TAG#old-tag");
  });
});

describe("getSubscriberEmailsByTag", () => {
  it("returns emails from inverted index query", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        marshall({ PK: "TAG#beta", SK: "SUB#a@example.com", email: "a@example.com" }),
        marshall({ PK: "TAG#beta", SK: "SUB#b@example.com", email: "b@example.com" }),
      ],
    });

    const result = await getSubscriberEmailsByTag("TestTable", "beta");

    expect(result).toEqual(["a@example.com", "b@example.com"]);
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._type).toBe("Query");
  });

  it("paginates through results", async () => {
    mockSend
      .mockResolvedValueOnce({
        Items: [marshall({ PK: "TAG#x", SK: "SUB#a@example.com", email: "a@example.com" })],
        LastEvaluatedKey: marshall({ PK: "TAG#x", SK: "SUB#a@example.com" }),
      })
      .mockResolvedValueOnce({
        Items: [marshall({ PK: "TAG#x", SK: "SUB#b@example.com", email: "b@example.com" })],
      });

    const result = await getSubscriberEmailsByTag("TestTable", "x");

    expect(result).toEqual(["a@example.com", "b@example.com"]);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});

describe("batchGetSubscriberProfiles", () => {
  it("returns profiles for given emails", async () => {
    const profiles = [
      marshall({
        PK: "SUB#a@example.com",
        SK: "PROFILE",
        email: "a@example.com",
        firstName: "Alice",
      }),
    ];
    mockSend.mockResolvedValueOnce({
      Responses: { TestTable: profiles },
    });

    const result = await batchGetSubscriberProfiles("TestTable", ["a@example.com"]);

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("a@example.com");
  });

  it("returns empty array for empty input", async () => {
    const result = await batchGetSubscriberProfiles("TestTable", []);
    expect(result).toEqual([]);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("scanActiveSubscribers", () => {
  it("scans with active filter", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        marshall({
          PK: "SUB#a@example.com",
          SK: "PROFILE",
          email: "a@example.com",
          firstName: "Alice",
          unsubscribed: false,
          suppressed: false,
        }),
      ],
    });

    const result = await scanActiveSubscribers("TestTable");

    expect(result).toHaveLength(1);
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd._type).toBe("Scan");
    expect(cmd.input.FilterExpression).toContain("unsubscribed = :false");
    expect(cmd.input.FilterExpression).toContain("suppressed = :false");
  });

  it("includes attribute filters", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    await scanActiveSubscribers("TestTable", { plan: "pro" });

    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.input.FilterExpression).toContain("#flt_plan = :flt_plan");
    expect(cmd.input.ExpressionAttributeNames?.["#flt_plan"]).toBe("plan");
  });
});

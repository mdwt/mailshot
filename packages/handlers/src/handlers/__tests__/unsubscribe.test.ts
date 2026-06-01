import { vi } from "vitest";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const mockResolveConfig = vi.fn();
const mockValidateToken = vi.fn();
const mockSetProfileFlag = vi.fn();
const mockStopAllExecutions = vi.fn();

vi.mock("../../lib/config.js", () => ({
  resolveConfig: () => mockResolveConfig(),
}));

vi.mock("../../lib/unsubscribe-token.js", () => ({
  validateToken: (...args: unknown[]) => mockValidateToken(...args),
}));

vi.mock("../../lib/dynamo-client.js", () => ({
  setProfileFlag: (...args: unknown[]) => mockSetProfileFlag(...args),
}));

vi.mock("../../lib/execution-stopper.js", () => ({
  stopAllExecutions: (...args: unknown[]) => mockStopAllExecutions(...args),
}));

const { handler } = await import("../unsubscribe.js");

const CONFIG = {
  tableName: "TestTable",
  unsubscribeSecret: "test-secret",
};

beforeEach(() => {
  mockResolveConfig.mockReset().mockReturnValue(CONFIG);
  mockValidateToken.mockReset();
  mockSetProfileFlag.mockReset().mockResolvedValue(undefined);
  mockStopAllExecutions.mockReset().mockResolvedValue(undefined);
});

describe("unsubscribe handler", () => {
  it("returns 400 when no token is provided", async () => {
    const result = (await handler({
      queryStringParameters: {},
    })) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("No unsubscribe token provided");
  });

  it("returns 400 when queryStringParameters is undefined", async () => {
    const result = (await handler({})) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(400);
  });

  it("returns 400 for invalid token", async () => {
    mockValidateToken.mockReturnValueOnce({
      valid: false,
      reason: "invalid signature",
    });

    const result = (await handler({
      queryStringParameters: { token: "bad-token" },
    })) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("invalid");
  });

  it("returns 400 for expired token", async () => {
    mockValidateToken.mockReturnValueOnce({
      valid: false,
      reason: "token expired",
    });

    const result = (await handler({
      queryStringParameters: { token: "expired-token" },
    })) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("expired");
  });

  it("unsubscribes and stops executions for valid token", async () => {
    mockValidateToken.mockReturnValueOnce({
      valid: true,
      email: "user@example.com",
      sendTimestamp: "2026-01-01T00:00:00.000Z",
      expiryTimestamp: "2026-04-01T00:00:00.000Z",
    });

    const result = (await handler({
      queryStringParameters: { token: "valid-token" },
    })) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain("unsubscribed");
    expect(mockSetProfileFlag).toHaveBeenCalledWith(
      "TestTable",
      "user@example.com",
      "unsubscribed",
    );
    expect(mockStopAllExecutions).toHaveBeenCalledWith("TestTable", "user@example.com", true);
  });
});

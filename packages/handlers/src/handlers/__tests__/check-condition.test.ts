import { vi } from "vitest";

const mockResolveConfig = vi.fn();
const mockGetSubscriberProfile = vi.fn();
const mockHasBeenSent = vi.fn();

vi.mock("../../lib/ssm-config.js", () => ({
  resolveConfig: () => mockResolveConfig(),
}));

vi.mock("../../lib/dynamo-client.js", () => ({
  getSubscriberProfile: (...args: unknown[]) => mockGetSubscriberProfile(...args),
  hasBeenSent: (...args: unknown[]) => mockHasBeenSent(...args),
}));

const { handler } = await import("../check-condition.js");

const CONFIG = { tableName: "TestTable" };

beforeEach(() => {
  mockResolveConfig.mockReset().mockResolvedValue(CONFIG);
  mockGetSubscriberProfile.mockReset();
  mockHasBeenSent.mockReset();
});

describe("check-condition handler", () => {
  describe("subscriber_field_exists", () => {
    it("returns true when field exists and has a value", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({
        platform: "web",
      });

      const result = await handler({
        check: "subscriber_field_exists",
        field: "platform",
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: true });
    });

    it("returns false when field is empty string", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({
        platform: "",
      });

      const result = await handler({
        check: "subscriber_field_exists",
        field: "platform",
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: false });
    });

    it("returns false when field is undefined", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({});

      const result = await handler({
        check: "subscriber_field_exists",
        field: "platform",
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: false });
    });

    it("returns false when profile does not exist", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      const result = await handler({
        check: "subscriber_field_exists",
        field: "platform",
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: false });
    });
  });

  describe("subscriber_field_equals", () => {
    it("returns true when field matches value", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({
        plan: "pro",
      });

      const result = await handler({
        check: "subscriber_field_equals",
        field: "plan",
        value: "pro",
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: true });
    });

    it("returns false when field does not match", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({
        plan: "free",
      });

      const result = await handler({
        check: "subscriber_field_equals",
        field: "plan",
        value: "pro",
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: false });
    });

    it("returns false when profile is null", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      const result = await handler({
        check: "subscriber_field_equals",
        field: "plan",
        value: "pro",
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: false });
    });
  });

  describe("has_been_sent", () => {
    it("returns true when template has been sent", async () => {
      mockHasBeenSent.mockResolvedValueOnce(true);

      const result = await handler({
        check: "has_been_sent",
        templateKey: "onboarding/welcome",
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: true });
    });

    it("returns false when template has not been sent", async () => {
      mockHasBeenSent.mockResolvedValueOnce(false);

      const result = await handler({
        check: "has_been_sent",
        templateKey: "onboarding/welcome",
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: false });
    });

    it("returns false when templateKey is missing", async () => {
      const result = await handler({
        check: "has_been_sent",
        subscriber: { email: "user@example.com" },
      } as any);

      expect(result).toEqual({ result: false });
      expect(mockHasBeenSent).not.toHaveBeenCalled();
    });
  });

  describe("unknown check", () => {
    it("returns false for unknown check type", async () => {
      const result = await handler({
        check: "unknown_check" as any,
        subscriber: { email: "user@example.com" },
      });

      expect(result).toEqual({ result: false });
    });
  });
});

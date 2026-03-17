import { vi } from "vitest";

const mockResolveConfig = vi.fn();
const mockGetSubscriberProfile = vi.fn();
const mockUpsertSubscriberProfile = vi.fn();
const mockGetExecution = vi.fn();
const mockPutExecution = vi.fn();
const mockDeleteExecution = vi.fn();
const mockWriteSendLog = vi.fn();
const mockRenderTemplate = vi.fn();
const mockSendEmail = vi.fn();
const mockGenerateToken = vi.fn();
const mockLoadDisplayNames = vi.fn();
const mockResolveDisplayNames = vi.fn();

const mockSfnSend = vi.fn();
vi.mock("@aws-sdk/client-sfn", () => ({
  SFNClient: class {
    send = mockSfnSend;
  },
  StopExecutionCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock("../../lib/ssm-config.js", () => ({
  resolveConfig: () => mockResolveConfig(),
}));

vi.mock("../../lib/dynamo-client.js", () => ({
  getSubscriberProfile: (...args: unknown[]) => mockGetSubscriberProfile(...args),
  upsertSubscriberProfile: (...args: unknown[]) => mockUpsertSubscriberProfile(...args),
  extractAttributes: (profile: Record<string, unknown>) => {
    const SYSTEM_KEYS = new Set([
      "PK",
      "SK",
      "email",
      "firstName",
      "unsubscribed",
      "suppressed",
      "createdAt",
      "updatedAt",
    ]);
    const attrs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(profile)) {
      if (!SYSTEM_KEYS.has(key)) attrs[key] = value;
    }
    return attrs;
  },
  getExecution: (...args: unknown[]) => mockGetExecution(...args),
  putExecution: (...args: unknown[]) => mockPutExecution(...args),
  deleteExecution: (...args: unknown[]) => mockDeleteExecution(...args),
  writeSendLog: (...args: unknown[]) => mockWriteSendLog(...args),
}));

vi.mock("../../lib/template-renderer.js", () => ({
  renderTemplate: (...args: unknown[]) => mockRenderTemplate(...args),
}));

vi.mock("../../lib/ses-sender.js", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("../../lib/unsubscribe-token.js", () => ({
  generateToken: (...args: unknown[]) => mockGenerateToken(...args),
}));

vi.mock("../../lib/display-names.js", () => ({
  loadDisplayNames: (...args: unknown[]) => mockLoadDisplayNames(...args),
  resolveDisplayNames: (...args: unknown[]) => mockResolveDisplayNames(...args),
}));

const { handler } = await import("../send-email.js");

const CONFIG = {
  tableName: "TestTable",
  eventsTableName: "EventsTable",
  templateBucket: "my-bucket",
  defaultFromEmail: "noreply@example.com",
  defaultFromName: "Example",
  sesConfigSet: "my-config-set",
  unsubscribeBaseUrl: "https://unsub.example.com",
  unsubscribeSecret: "test-secret",
};

beforeEach(() => {
  mockResolveConfig.mockReset().mockResolvedValue(CONFIG);
  mockGetSubscriberProfile.mockReset();
  mockUpsertSubscriberProfile.mockReset().mockResolvedValue(undefined);
  mockGetExecution.mockReset();
  mockPutExecution.mockReset().mockResolvedValue(undefined);
  mockDeleteExecution.mockReset().mockResolvedValue(undefined);
  mockWriteSendLog.mockReset().mockResolvedValue(undefined);
  mockRenderTemplate.mockReset().mockResolvedValue("<h1>Hello</h1>");
  mockSendEmail.mockReset().mockResolvedValue("msg-123");
  mockGenerateToken.mockReset().mockReturnValue("token-abc");
  mockLoadDisplayNames.mockReset().mockResolvedValue({});
  mockResolveDisplayNames.mockReset().mockReturnValue({});
  mockSfnSend.mockReset();
});

describe("send-email handler", () => {
  describe("register action", () => {
    const registerEvent = {
      action: "register" as const,
      sequenceId: "onboarding",
      subscriber: { email: "user@example.com", firstName: "Jane" },
      executionArn: "arn:aws:states:us-east-1:123:execution:new",
    };

    it("upserts profile and stores execution", async () => {
      mockGetExecution.mockResolvedValueOnce(null);

      const result = await handler(registerEvent);

      expect(result).toEqual({ registered: true });
      expect(mockUpsertSubscriberProfile).toHaveBeenCalledWith(
        "TestTable",
        registerEvent.subscriber,
      );
      expect(mockPutExecution).toHaveBeenCalledWith(
        "TestTable",
        "user@example.com",
        "onboarding",
        registerEvent.executionArn,
      );
    });

    it("stops existing execution before registering new one", async () => {
      mockGetExecution.mockResolvedValueOnce({
        executionArn: "arn:aws:states:us-east-1:123:execution:old",
        sequenceId: "onboarding",
      });
      mockSfnSend.mockResolvedValueOnce({});

      const result = await handler(registerEvent);

      expect(result).toEqual({ registered: true });
      expect(mockSfnSend).toHaveBeenCalledOnce();
      expect(mockDeleteExecution).toHaveBeenCalledWith(
        "TestTable",
        "user@example.com",
        "onboarding",
      );
      expect(mockPutExecution).toHaveBeenCalled();
    });

    it("handles already-stopped execution gracefully", async () => {
      mockGetExecution.mockResolvedValueOnce({
        executionArn: "arn:old",
        sequenceId: "onboarding",
      });
      mockSfnSend.mockRejectedValueOnce(new Error("ExecutionDoesNotExist"));

      const result = await handler(registerEvent);

      expect(result).toEqual({ registered: true });
      expect(mockDeleteExecution).toHaveBeenCalled();
    });
  });

  describe("send action", () => {
    const sendEvent = {
      action: "send" as const,
      templateKey: "onboarding/welcome",
      subject: "Welcome!",
      subscriber: { email: "user@example.com", firstName: "Jane" },
    };

    it("sends email successfully", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({
        email: "user@example.com",
        firstName: "Jane",
        unsubscribed: false,
        suppressed: false,
      });

      const result = await handler(sendEvent);

      expect(result).toEqual({ sent: true, messageId: "msg-123" });
      expect(mockRenderTemplate).toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalled();
      expect(mockWriteSendLog).toHaveBeenCalled();
    });

    it("skips send when subscriber is unsubscribed", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({
        email: "user@example.com",
        firstName: "Jane",
        unsubscribed: true,
        suppressed: false,
      });

      const result = await handler(sendEvent);

      expect(result).toEqual({ sent: false, reason: "unsubscribed" });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("skips send when subscriber is suppressed", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({
        email: "user@example.com",
        firstName: "Jane",
        unsubscribed: false,
        suppressed: true,
      });

      const result = await handler(sendEvent);

      expect(result).toEqual({ sent: false, reason: "suppressed" });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("sends when profile does not exist yet", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      const result = await handler(sendEvent);

      expect(result).toEqual({ sent: true, messageId: "msg-123" });
    });

    it("formats from address with display name", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      await handler(sendEvent);

      const sendCall = mockSendEmail.mock.calls[0][0];
      expect(sendCall.from).toBe("Example <noreply@example.com>");
    });

    it("generates unsubscribe URL with token", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      await handler(sendEvent);

      expect(mockGenerateToken).toHaveBeenCalledWith("user@example.com", "test-secret");
      const sendCall = mockSendEmail.mock.calls[0][0];
      expect(sendCall.unsubscribeUrl).toBe("https://unsub.example.com?token=token-abc");
    });
  });

  describe("fire_and_forget action", () => {
    it("upserts profile then sends email", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      const result = await handler({
        action: "fire_and_forget",
        templateKey: "promo/sale",
        subject: "Sale!",
        subscriber: { email: "user@example.com", firstName: "Jane" },
      });

      expect(result).toEqual({ sent: true, messageId: "msg-123" });
      expect(mockUpsertSubscriberProfile).toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  describe("complete action", () => {
    it("deletes execution and returns completed", async () => {
      const result = await handler({
        action: "complete",
        sequenceId: "onboarding",
        subscriber: { email: "user@example.com" },
        executionArn: "arn:aws:states:us-east-1:123:execution:abc",
      });

      expect(result).toEqual({ completed: true });
      expect(mockDeleteExecution).toHaveBeenCalledWith(
        "TestTable",
        "user@example.com",
        "onboarding",
      );
    });
  });
});

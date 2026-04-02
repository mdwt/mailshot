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

vi.mock("../../lib/config.js", () => ({
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
  renderString: (template: string) => Promise.resolve(template),
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
  sesConfigSet: "my-config-set",
  unsubscribeBaseUrl: "https://unsub.example.com",
  unsubscribeSecret: "test-secret",
};

const TEST_SENDER = {
  fromEmail: "noreply@example.com",
  fromName: "Example",
  replyToEmail: "support@example.com",
};

beforeEach(() => {
  mockResolveConfig.mockReset().mockReturnValue(CONFIG);
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
      mockGetSubscriberProfile.mockResolvedValueOnce({ unsubscribed: false, suppressed: false });
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

    it("throws when subscriber is unsubscribed", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({ unsubscribed: true, suppressed: false });

      await expect(handler(registerEvent)).rejects.toThrow(
        "Cannot register sequence for unsubscribed subscriber",
      );
      expect(mockPutExecution).not.toHaveBeenCalled();
    });

    it("throws when subscriber is suppressed", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({ unsubscribed: false, suppressed: true });

      await expect(handler(registerEvent)).rejects.toThrow(
        "Cannot register sequence for suppressed subscriber",
      );
      expect(mockPutExecution).not.toHaveBeenCalled();
    });

    it("stops existing execution before registering new one", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce({ unsubscribed: false, suppressed: false });
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
      mockGetSubscriberProfile.mockResolvedValueOnce({ unsubscribed: false, suppressed: false });
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
      sender: TEST_SENDER,
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

    it("passes listUnsubscribe to sendEmail when sender disables it", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      await handler({
        ...sendEvent,
        sender: { ...TEST_SENDER, listUnsubscribe: false },
      });

      const sendCall = mockSendEmail.mock.calls[0][0];
      expect(sendCall.listUnsubscribe).toBe(false);
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
        sender: TEST_SENDER,
      });

      expect(result).toEqual({ sent: true, messageId: "msg-123" });
      expect(mockUpsertSubscriberProfile).toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  describe("A/B variants", () => {
    const variantEvent = {
      action: "send" as const,
      variants: [
        { templateKey: "onboarding/welcome-a", subject: "Welcome A!" },
        { templateKey: "onboarding/welcome-b", subject: "Welcome B!" },
      ],
      sequenceId: "onboarding",
      subscriber: { email: "user@example.com", firstName: "Jane" },
      sender: TEST_SENDER,
    };

    it("sends with selected variant templateKey and subject", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      const result = await handler(variantEvent);

      expect(result).toEqual({ sent: true, messageId: "msg-123" });
      const sendCall = mockSendEmail.mock.calls[0][0];
      // Should use one of the variant templateKeys
      expect(["onboarding/welcome-a", "onboarding/welcome-b"]).toContain(sendCall.templateKey);
      expect(["Welcome A!", "Welcome B!"]).toContain(sendCall.subject);
    });

    it("selects the same variant deterministically for the same subscriber", async () => {
      mockGetSubscriberProfile.mockResolvedValue(null);

      await handler(variantEvent);
      const firstTemplateKey = mockSendEmail.mock.calls[0][0].templateKey;

      mockSendEmail.mockClear();
      await handler(variantEvent);
      const secondTemplateKey = mockSendEmail.mock.calls[0][0].templateKey;

      expect(firstTemplateKey).toBe(secondTemplateKey);
    });

    it("writes send log with the variant templateKey", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      await handler(variantEvent);

      const logCall = mockWriteSendLog.mock.calls[0];
      expect(["onboarding/welcome-a", "onboarding/welcome-b"]).toContain(logCall[2].templateKey);
    });

    it("uses direct templateKey/subject when no variants", async () => {
      mockGetSubscriberProfile.mockResolvedValueOnce(null);

      await handler({
        action: "send" as const,
        templateKey: "onboarding/welcome",
        subject: "Welcome!",
        subscriber: { email: "user@example.com", firstName: "Jane" },
        sender: TEST_SENDER,
      });

      const sendCall = mockSendEmail.mock.calls[0][0];
      expect(sendCall.templateKey).toBe("onboarding/welcome");
      expect(sendCall.subject).toBe("Welcome!");
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

  describe("SQS record unwrapping", () => {
    it("processes SQS records containing fire_and_forget payloads", async () => {
      mockGetSubscriberProfile.mockResolvedValue({
        unsubscribed: false,
        suppressed: false,
        email: "user@example.com",
        firstName: "Jane",
      });

      const sqsEvent = {
        Records: [
          {
            body: JSON.stringify({
              action: "fire_and_forget",
              templateKey: "broadcasts/update",
              subject: "What's new",
              sender: TEST_SENDER,
              sequenceId: "broadcast-april",
              subscriber: { email: "user@example.com", firstName: "Jane" },
            }),
          },
        ],
      } as unknown as Parameters<typeof handler>[0];

      await handler(sqsEvent);

      expect(mockUpsertSubscriberProfile).toHaveBeenCalledWith("TestTable", {
        email: "user@example.com",
        firstName: "Jane",
      });
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it("uses custom sequenceId from fire_and_forget payload", async () => {
      mockGetSubscriberProfile.mockResolvedValue({
        unsubscribed: false,
        suppressed: false,
        email: "user@example.com",
        firstName: "Jane",
      });

      const sqsEvent = {
        Records: [
          {
            body: JSON.stringify({
              action: "fire_and_forget",
              templateKey: "broadcasts/update",
              subject: "What's new",
              sender: TEST_SENDER,
              sequenceId: "my-broadcast-id",
              subscriber: { email: "user@example.com", firstName: "Jane" },
            }),
          },
        ],
      } as unknown as Parameters<typeof handler>[0];

      await handler(sqsEvent);

      // Verify the send log uses the broadcastId as sequenceId
      expect(mockWriteSendLog).toHaveBeenCalled();
      const sendLogCall = mockWriteSendLog.mock.calls[0];
      expect(sendLogCall[2].sequenceId).toBe("my-broadcast-id");
    });
  });
});

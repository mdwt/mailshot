import { vi } from "vitest";
import type { SNSEvent } from "aws-lambda";

const mockResolveConfig = vi.fn();
const mockWriteSuppression = vi.fn();
const mockSetProfileFlag = vi.fn();
const mockStopAllExecutions = vi.fn();
const mockAddToSuppressionList = vi.fn();

vi.mock("../../lib/config.js", () => ({
  resolveConfig: () => mockResolveConfig(),
}));

vi.mock("../../lib/dynamo-client.js", () => ({
  writeSuppression: (...args: unknown[]) => mockWriteSuppression(...args),
  setProfileFlag: (...args: unknown[]) => mockSetProfileFlag(...args),
}));

vi.mock("../../lib/execution-stopper.js", () => ({
  stopAllExecutions: (...args: unknown[]) => mockStopAllExecutions(...args),
}));

vi.mock("../../lib/ses-suppression.js", () => ({
  addToSuppressionList: (...args: unknown[]) => mockAddToSuppressionList(...args),
}));

const { handler } = await import("../bounce-handler.js");

const CONFIG = { tableName: "TestTable" };

function snsEvent(message: unknown): SNSEvent {
  return {
    Records: [
      {
        Sns: { Message: JSON.stringify(message) },
      },
    ],
  } as SNSEvent;
}

beforeEach(() => {
  mockResolveConfig.mockReset().mockReturnValue(CONFIG);
  mockWriteSuppression.mockReset().mockResolvedValue(undefined);
  mockSetProfileFlag.mockReset().mockResolvedValue(undefined);
  mockStopAllExecutions.mockReset().mockResolvedValue(undefined);
  mockAddToSuppressionList.mockReset().mockResolvedValue(undefined);
});

describe("bounce-handler", () => {
  it("suppresses subscriber on permanent bounce", async () => {
    const event = snsEvent({
      notificationType: "Bounce",
      bounce: {
        bounceType: "Permanent",
        bouncedRecipients: [{ emailAddress: "bounced@example.com" }],
        feedbackId: "feedback-1",
      },
    });

    await handler(event);

    expect(mockWriteSuppression).toHaveBeenCalledWith(
      "TestTable",
      "bounced@example.com",
      "bounce",
      "Permanent",
      "feedback-1",
    );
    expect(mockSetProfileFlag).toHaveBeenCalledWith(
      "TestTable",
      "bounced@example.com",
      "suppressed",
    );
    expect(mockStopAllExecutions).toHaveBeenCalledWith("TestTable", "bounced@example.com", false);
    expect(mockAddToSuppressionList).toHaveBeenCalledWith("bounced@example.com", "BOUNCE");
  });

  it("ignores transient bounces", async () => {
    const event = snsEvent({
      notificationType: "Bounce",
      bounce: {
        bounceType: "Transient",
        bouncedRecipients: [{ emailAddress: "user@example.com" }],
        feedbackId: "feedback-2",
      },
    });

    await handler(event);

    expect(mockWriteSuppression).not.toHaveBeenCalled();
    expect(mockSetProfileFlag).not.toHaveBeenCalled();
    expect(mockStopAllExecutions).not.toHaveBeenCalled();
    expect(mockAddToSuppressionList).not.toHaveBeenCalled();
  });

  it("suppresses subscriber on complaint", async () => {
    const event = snsEvent({
      notificationType: "Complaint",
      complaint: {
        complainedRecipients: [{ emailAddress: "complainer@example.com" }],
        feedbackId: "feedback-3",
      },
    });

    await handler(event);

    expect(mockWriteSuppression).toHaveBeenCalledWith(
      "TestTable",
      "complainer@example.com",
      "complaint",
      undefined,
      "feedback-3",
    );
    expect(mockSetProfileFlag).toHaveBeenCalledWith(
      "TestTable",
      "complainer@example.com",
      "suppressed",
    );
    expect(mockStopAllExecutions).toHaveBeenCalledWith(
      "TestTable",
      "complainer@example.com",
      false,
    );
    expect(mockAddToSuppressionList).toHaveBeenCalledWith("complainer@example.com", "COMPLAINT");
  });

  it("handles multiple recipients in a bounce", async () => {
    const event = snsEvent({
      notificationType: "Bounce",
      bounce: {
        bounceType: "Permanent",
        bouncedRecipients: [{ emailAddress: "a@example.com" }, { emailAddress: "b@example.com" }],
        feedbackId: "feedback-4",
      },
    });

    await handler(event);

    expect(mockWriteSuppression).toHaveBeenCalledTimes(2);
    expect(mockSetProfileFlag).toHaveBeenCalledTimes(2);
    expect(mockStopAllExecutions).toHaveBeenCalledTimes(2);
  });

  it("handles multiple SNS records", async () => {
    const event: SNSEvent = {
      Records: [
        {
          Sns: {
            Message: JSON.stringify({
              notificationType: "Bounce",
              bounce: {
                bounceType: "Permanent",
                bouncedRecipients: [{ emailAddress: "a@example.com" }],
                feedbackId: "f1",
              },
            }),
          },
        },
        {
          Sns: {
            Message: JSON.stringify({
              notificationType: "Complaint",
              complaint: {
                complainedRecipients: [{ emailAddress: "b@example.com" }],
                feedbackId: "f2",
              },
            }),
          },
        },
      ],
    } as SNSEvent;

    await handler(event);

    expect(mockWriteSuppression).toHaveBeenCalledTimes(2);
  });
});

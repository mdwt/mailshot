import type { SequenceDefinition } from "@step-func-emailer/shared";

export default {
  id: "onboarding",
  trigger: {
    detailType: "new-customer",
    subscriberMapping: {
      email: "$.detail.email",
      firstName: "$.detail.firstName",
      attributes: "$.detail",
    },
  },
  timeoutDays: 30,
  steps: [
    { type: "send", templateKey: "onboarding/generic-welcome", subject: "Welcome to CheckoutJoy — let's get you set up" },
    { type: "wait", days: 1 },
    { type: "send", templateKey: "onboarding/day-1-setup-checkin", subject: "Did you get connected? (quick check-in)" },
    { type: "wait", days: 2 },
    { type: "send", templateKey: "onboarding/day-3-features", subject: "3 features that boost checkout conversions" },
    { type: "wait", days: 2 },
    { type: "send", templateKey: "onboarding/day-5-social-proof", subject: "How other course creators use CheckoutJoy" },
    { type: "wait", days: 2 },
    { type: "send", templateKey: "onboarding/day-7-trial-halfway", subject: "Your trial is halfway — here's what to do next" },
    { type: "wait", days: 2 },
    { type: "send", templateKey: "onboarding/day-9-vat-tax", subject: "Automate VAT and sales tax on your checkouts" },
    { type: "wait", days: 2 },
    { type: "send", templateKey: "onboarding/day-11-conversion-tools", subject: "Boost conversions with countdown timers and affiliates" },
    { type: "wait", days: 1 },
    { type: "send", templateKey: "onboarding/day-12-trial-ending", subject: "Your trial ends in 2 days" },
  ],
} satisfies SequenceDefinition;

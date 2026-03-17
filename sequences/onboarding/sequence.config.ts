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
  timeoutMinutes: 43200, // 30 days
  steps: [
    // ── Layer 1: Platform/country/gateway-specific welcome (Day 0) ────
    {
      type: "choice",
      field: "$.subscriber.attributes.platform",
      branches: [
        {
          value: "kajabi",
          steps: [{
            type: "choice",
            field: "$.subscriber.attributes.country",
            branches: [
              {
                value: "ZA",
                steps: [{
                  type: "choice",
                  field: "$.subscriber.attributes.gateway",
                  branches: [
                    { value: "payfast", steps: [{ type: "send", templateKey: "onboarding/kajabi-za-payfast", subject: "Connect PayFast to Kajabi in 10 minutes" }] },
                    { value: "paystack", steps: [{ type: "send", templateKey: "onboarding/kajabi-za-paystack", subject: "Connect Paystack to Kajabi — accept Rand payments today" }] },
                  ],
                  default: [{ type: "send", templateKey: "onboarding/kajabi-global", subject: "Your Kajabi checkout upgrade starts here" }],
                }],
              },
              { value: "IN", steps: [{ type: "send", templateKey: "onboarding/kajabi-in", subject: "Connect Razorpay to Kajabi — accept INR & UPI payments" }] },
              { value: "PH", steps: [{ type: "send", templateKey: "onboarding/kajabi-ph", subject: "Accept GCash, GrabPay & local payments on Kajabi" }] },
            ],
            default: [{ type: "send", templateKey: "onboarding/kajabi-global", subject: "Your Kajabi checkout upgrade starts here" }],
          }],
        },
        {
          value: "thinkific",
          steps: [{
            type: "choice",
            field: "$.subscriber.attributes.country",
            branches: [
              { value: "ZA", steps: [{ type: "send", templateKey: "onboarding/thinkific-za", subject: "Sell Thinkific courses in Rands with PayFast" }] },
              { value: "IN", steps: [{ type: "send", templateKey: "onboarding/thinkific-in", subject: "Accept INR payments on Thinkific with Razorpay" }] },
              { value: "SE", steps: [{ type: "send", templateKey: "onboarding/thinkific-se", subject: "Accept Klarna payments on Thinkific" }] },
            ],
            default: [{ type: "send", templateKey: "onboarding/thinkific-global", subject: "Build better checkout pages for Thinkific" }],
          }],
        },
        {
          value: "teachable",
          steps: [{
            type: "choice",
            field: "$.subscriber.attributes.country",
            branches: [
              { value: "ZA", steps: [{ type: "send", templateKey: "onboarding/teachable-za", subject: "Accept Rand payments on Teachable" }] },
            ],
            default: [{ type: "send", templateKey: "onboarding/teachable-global", subject: "Custom checkout pages for Teachable" }],
          }],
        },
        {
          value: "highlevel",
          steps: [{
            type: "choice",
            field: "$.subscriber.attributes.country",
            branches: [
              { value: "ZA", steps: [{ type: "send", templateKey: "onboarding/highlevel-za", subject: "Accept Rand payments on HighLevel with PayFast" }] },
            ],
            default: [{ type: "send", templateKey: "onboarding/highlevel-global", subject: "Custom checkouts for HighLevel — connect any gateway" }],
          }],
        },
        {
          value: "kartra",
          steps: [{
            type: "choice",
            field: "$.subscriber.attributes.country",
            branches: [
              { value: "ZA", steps: [{ type: "send", templateKey: "onboarding/kartra-za", subject: "Accept Rand payments on Kartra with Paystack" }] },
            ],
            default: [{ type: "send", templateKey: "onboarding/kartra-global", subject: "Custom checkout pages for Kartra" }],
          }],
        },
      ],
      default: [{ type: "send", templateKey: "onboarding/generic-welcome", subject: "Welcome to CheckoutJoy — let's get you set up" }],
    },

    // ── Layer 2+3: Linear follow-up sequence (Days 1–12) ─────────────
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

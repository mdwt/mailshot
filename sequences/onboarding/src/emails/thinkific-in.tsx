import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function ThinkificIn({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Accept INR payments on Thinkific with Razorpay</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Thinkific and need Indian Rupee
            payments — Razorpay is the way to go.
          </Text>

          <Text style={paragraph}>
            Watch this 14-minute tutorial covering UPI and Google Pay
            subscriptions:
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=0m_-ucp832Q">
              Watch: Razorpay + Thinkific Setup →
            </Button>
          </Section>

          <Text style={paragraph}>
            Your students will be able to pay with UPI, Google Pay, netbanking,
            and cards — all in INR.
          </Text>

          <Text style={paragraph}>
            Prefer to read? Here's the{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/guides/Thinkific/razorpay-how-to">
              written Razorpay + Thinkific guide
            </Link>
            .
          </Text>

          <Text style={paragraph}>
            You've got 14 days to test everything for free.
          </Text>

          <Text style={paragraph}>
            Just reply if you need help — I respond personally.
          </Text>

          <Text style={paragraph}>
            Meiring{"\n"}Founder, CheckoutJoy
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            <Link style={footerLink} href={unsubscribeUrl}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

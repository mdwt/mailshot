import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function KajabiIn({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Connect Razorpay to Kajabi — accept INR & UPI payments</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Kajabi and need to accept Indian
            Rupee payments — Razorpay is perfect for this. UPI, cards,
            netbanking — all of it.
          </Text>

          <Text style={paragraph}>
            Watch this tutorial — I walk through the entire Razorpay + Kajabi
            connection in 16 minutes:
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=Io2WueyU-Ak">
              Watch: Razorpay + Kajabi Setup →
            </Button>
          </Section>

          <Text style={paragraph}>
            By the end, you'll be accepting UPI, Google Pay, and credit card
            payments in INR on your Kajabi courses.
          </Text>

          <Text style={paragraph}>
            Prefer to read? Here's the{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/guides/kajabi/how-to-razorpay-kajabi-setup-guide">
              written setup guide
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

import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function TeachableZa({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Accept Rand payments on Teachable</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Teachable in South Africa — let's
            get you accepting local payments.
          </Text>

          <Text style={paragraph}>
            Watch this tutorial to connect PayFast or Paystack for ZAR payments
            on Teachable:
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=EKe3x8AgAhQ">
              Watch: Custom Teachable Checkouts →
            </Button>
          </Section>

          <Text style={paragraph}>
            Once set up, SA students can pay via EFT, credit card, and
            SnapScan — all in Rands.
          </Text>

          <Text style={paragraph}>
            Prefer to read? Here's the{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/integrations/teachable">
              Teachable integration guide
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

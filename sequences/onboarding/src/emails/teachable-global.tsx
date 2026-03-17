import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function TeachableGlobal({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Custom checkout pages for Teachable</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Teachable — let me show you how
            to build custom checkout pages that convert better than Teachable's
            default.
          </Text>

          <Text style={paragraph}>
            Watch this 13-minute tutorial — from setup to your first custom
            checkout:
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=EKe3x8AgAhQ">
              Watch: Custom Teachable Checkouts →
            </Button>
          </Section>

          <Text style={paragraph}>
            You'll be able to add countdown timers, custom fields,
            multi-currency support, and more.
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

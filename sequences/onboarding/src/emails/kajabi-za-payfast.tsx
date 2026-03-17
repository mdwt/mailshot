import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function KajabiZaPayfast({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Connect PayFast to Kajabi in 10 minutes</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Kajabi in South Africa using
            PayFast — great combo for accepting Rand payments. Let me get you
            set up.
          </Text>

          <Text style={paragraph}>
            Watch this step-by-step tutorial — it covers everything from
            connecting PayFast to setting up ZAR pricing on your Kajabi
            checkout:
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=MP289keY97Y">
              Watch: PayFast + Kajabi Setup →
            </Button>
          </Section>

          <Text style={paragraph}>
            By the end of this 18-minute tutorial, you'll be accepting EFT,
            credit card, SnapScan, and Masterpass payments on your Kajabi
            courses.
          </Text>

          <Text style={paragraph}>
            Prefer to read? Here's the{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/guides/kajabi/how-to-payfast-kajabi-setup-guide">
              written step-by-step guide
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

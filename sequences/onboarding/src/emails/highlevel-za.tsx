import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function HighlevelZa({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Accept Rand payments on HighLevel with PayFast</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on HighLevel in South Africa — let's
            get PayFast connected so you can sell in Rands.
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=zX5qm3DJn20">
              Watch: PayFast + HighLevel Setup →
            </Button>
          </Section>

          <Text style={paragraph}>
            Your clients can pay via EFT, credit card, and SnapScan — all in
            Rands.
          </Text>

          <Text style={paragraph}>
            Prefer to read? Here's the{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/guides/highlevel/setup-guide">
              HighLevel connection guide
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

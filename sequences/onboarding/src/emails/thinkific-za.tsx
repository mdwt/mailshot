import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function ThinkificZa({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Sell Thinkific courses in Rands with PayFast</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Thinkific in South Africa — let's
            get you accepting Rand payments with PayFast.
          </Text>

          <Text style={paragraph}>
            Watch this step-by-step tutorial to connect PayFast to your
            Thinkific school:
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=vj_bxyJB5Vc">
              Watch: PayFast + Thinkific Setup →
            </Button>
          </Section>

          <Text style={paragraph}>
            Once done, your students can pay in ZAR via EFT, credit card, and
            SnapScan.
          </Text>

          <Text style={paragraph}>
            Prefer to read? Here's the{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/integrations/thinkific/getting-started">
              Thinkific getting started guide
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

import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function ThinkificGlobal({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Build better checkout pages for Thinkific</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Thinkific — great choice. Let me
            show you how to build custom checkout pages that convert.
          </Text>

          <Section>
            <Button style={cta} href="https://checkoutjoy.com/docs/integrations/thinkific/getting-started">
              Read: Thinkific Getting Started Guide →
            </Button>
          </Section>

          <Text style={paragraph}>
            Need a specific payment gateway? Pick your region:
          </Text>

          <Text style={paragraph}>
            •{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=vj_bxyJB5Vc">
              PayFast (South Africa)
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=0m_-ucp832Q">
              Razorpay (India)
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=GiC3AEnK4pg">
              Klarna (Nordics)
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=YRVpQrKAgIA">
              Multi-currency
            </Link>
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

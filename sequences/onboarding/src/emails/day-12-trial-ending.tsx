import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function Day12TrialEnding({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your trial ends in 2 days</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Your 14-day trial ends in 2 days. If CheckoutJoy is working for
            you, your plan will continue automatically — no action needed.
          </Text>

          <Text style={paragraph}>
            If you're still on the fence, here's what I'd suggest: make a test
            purchase on your checkout page. Seeing the full flow — from checkout
            to course enrollment — usually makes the decision easy.
          </Text>

          <Text style={paragraph}>
            And if it's not the right fit, no worries at all. You can cancel
            anytime from your dashboard.
          </Text>

          <Text style={paragraph}>
            Questions? Just reply — happy to help.
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

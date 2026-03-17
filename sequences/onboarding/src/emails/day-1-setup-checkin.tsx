import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function Day1SetupCheckin({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Did you get connected? (quick check-in)</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Quick check-in — did you manage to connect your payment gateway
            yesterday?
          </Text>

          <Text style={paragraph}>
            If you got stuck, just reply with where you're at and I'll help you
            through it. Most people get set up in under 15 minutes.
          </Text>

          <Text style={paragraph}>
            If you haven't started yet, no worries — here's a general overview
            of selling courses from South Africa without Stripe:
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=jpj2k712IbU">
              Watch: Selling Courses Without Stripe →
            </Button>
          </Section>

          <Text style={paragraph}>
            You've still got plenty of time on your trial.
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

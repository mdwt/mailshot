import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function KartraGlobal({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Custom checkout pages for Kartra</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Kartra — let me show you how to
            connect local payment gateways and build better checkout pages.
          </Text>

          <Section>
            <Button style={cta} href="https://checkoutjoy.com/docs/integrations/kartra">
              Read: Kartra Integration Guide →
            </Button>
          </Section>

          <Text style={paragraph}>
            Need a specific gateway? Watch the{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=e4beSsI43bo">
              Paystack + Kartra tutorial
            </Link>{" "}
            for South African payments.
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

import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function GenericWelcome({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to CheckoutJoy — let's get you set up</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! I'm Meiring, the founder — thanks for
            signing up.
          </Text>

          <Text style={paragraph}>
            CheckoutJoy connects your course platform to local payment
            gateways, so your students can pay in their own currency. No Stripe
            needed.
          </Text>

          <Text style={paragraph}>
            Quick start — pick your platform:
          </Text>

          <Text style={paragraph}>
            •{" "}
            <Link style={link} href="https://checkoutjoy.com/kajabi/">
              Kajabi
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://checkoutjoy.com/thinkific/">
              Thinkific
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://checkoutjoy.com/teachable/">
              Teachable
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://checkoutjoy.com/highlevel/">
              HighLevel
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://checkoutjoy.com/kartra/">
              Kartra
            </Link>
          </Text>

          <Text style={paragraph}>
            You've got 14 days to test everything for free.
          </Text>

          <Text style={paragraph}>
            Just reply with your platform + gateway and I'll send you the exact
            tutorial you need.
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

import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function Day3Features({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>3 features that boost checkout conversions</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Now that you're connected, here are 3 features that our
            highest-converting customers use:
          </Text>

          <Text style={paragraph}>
            <strong>1. Countdown timers</strong> — create urgency on your
            checkout pages:{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=vgmUh_vazjY">
              Watch
            </Link>
          </Text>

          <Text style={paragraph}>
            <strong>2. Custom storefronts</strong> — build a branded sales
            page:{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/features/storefronts">
              Read
            </Link>
          </Text>

          <Text style={paragraph}>
            <strong>3. Checkout widgets</strong> — embed buy buttons anywhere:{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/features/checkouts/widgets">
              Read
            </Link>
          </Text>

          <Text style={paragraph}>
            Try adding at least one of these to your checkout before the end of
            your trial.
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

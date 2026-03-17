import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function Day11ConversionTools({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Boost conversions with countdown timers and affiliates</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Two more power features before your trial wraps up:
          </Text>

          <Text style={paragraph}>
            <strong>1. Countdown timers</strong> — create real urgency on your
            checkout pages:{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=vgmUh_vazjY">
              Watch
            </Link>
          </Text>

          <Text style={paragraph}>
            <strong>2. Affiliate program</strong> — let others sell your courses
            for a commission:{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/features/affiliates">
              Read
            </Link>
          </Text>

          <Text style={paragraph}>
            Both are included in your plan — no extra cost.
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

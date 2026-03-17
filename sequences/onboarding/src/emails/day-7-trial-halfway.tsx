import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function Day7TrialHalfway({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your trial is halfway — here's what to do next</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            You're halfway through your 14-day trial. Here's a quick checklist
            to make sure you're getting the most out of it:
          </Text>

          <Text style={paragraph}>
            • Connected your payment gateway{"\n"}
            • Created your first checkout page{"\n"}
            • Made a test purchase{"\n"}
            • Added your branding (logo, colours)
          </Text>

          <Text style={paragraph}>
            If you've done all four, you're in great shape. If not, reply and
            I'll help you knock them out quickly.
          </Text>

          <Text style={paragraph}>
            The goal is to have everything ready so you can start selling before
            your trial ends.
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

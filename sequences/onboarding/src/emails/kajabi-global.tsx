import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function KajabiGlobal({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your Kajabi checkout upgrade starts here</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Kajabi — great choice. Let me
            show you how to level up your checkout pages.
          </Text>

          <Text style={paragraph}>
            Start with this quick video — 3 ways to improve your Kajabi
            checkouts (multi-currency, countdown timers, and more):
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=FZFzzRGL3gc">
              Watch: 3 Ways to Improve Kajabi Checkouts →
            </Button>
          </Section>

          <Text style={paragraph}>
            Want to connect a specific payment gateway? Here are your options:
          </Text>

          <Text style={paragraph}>
            •{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=MP289keY97Y">
              PayFast (South Africa)
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=Io2WueyU-Ak">
              Razorpay (India)
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=zpTuaJKjGEs">
              Xendit (Philippines/SEA)
            </Link>
            {"\n"}•{" "}
            <Link style={link} href="https://www.youtube.com/watch?v=icbdU3Z5wPQ">
              Vipps (Norway)
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

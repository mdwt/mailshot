import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function ThinkificSe({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Accept Klarna payments on Thinkific</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're on Thinkific in Scandinavia — let's
            get Klarna connected so your students can buy now, pay later.
          </Text>

          <Text style={paragraph}>
            Watch this step-by-step tutorial to connect Klarna to your
            Thinkific school:
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=GiC3AEnK4pg">
              Watch: Klarna + Thinkific Setup →
            </Button>
          </Section>

          <Text style={paragraph}>
            Klarna is huge in the Nordics — offering it can significantly boost
            your conversion rate.
          </Text>

          <Text style={paragraph}>
            Prefer to read? Here's the{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/guides/Thinkific/klarna-how-to">
              written Klarna + Thinkific guide
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

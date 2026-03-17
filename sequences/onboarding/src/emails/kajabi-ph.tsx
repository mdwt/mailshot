import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function KajabiPh({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Accept GCash, GrabPay & local payments on Kajabi</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            Welcome to CheckoutJoy! You're selling on Kajabi from the
            Philippines — let's get GCash, GrabPay, and other local payment
            methods connected.
          </Text>

          <Text style={paragraph}>
            Watch this tutorial — I show you how to connect Xendit to Kajabi so
            your Filipino customers can pay the way they prefer:
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=zpTuaJKjGEs">
              Watch: Xendit + Kajabi Setup →
            </Button>
          </Section>

          <Text style={paragraph}>
            Your students will be able to pay with GCash, GrabPay, bank
            transfer, and cards — all through Xendit.
          </Text>

          <Text style={paragraph}>
            Prefer to read? Here's the{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/guides/kajabi/xendit-how-to">
              written setup guide
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

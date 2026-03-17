import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function Day5SocialProof({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>How other course creators use CheckoutJoy</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            I wanted to share what some of our customers are doing with
            CheckoutJoy — might spark some ideas for your setup.
          </Text>

          <Text style={paragraph}>
            Course creators in South Africa, India, and the Philippines are
            using CheckoutJoy to accept local payments on Kajabi, Thinkific, and
            Teachable. Some are processing hundreds of transactions per month
            that they couldn't have accepted before.
          </Text>

          <Text style={paragraph}>
            The most successful ones all have one thing in common: they set up
            their checkout and sent traffic within the first week.
          </Text>

          <Text style={paragraph}>
            If you haven't made a test purchase yet, that's a great next step.
            Set up a test product, run through the checkout yourself, and make
            sure everything works before you send real traffic.
          </Text>

          <Text style={paragraph}>
            Need help setting that up? Just reply.
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

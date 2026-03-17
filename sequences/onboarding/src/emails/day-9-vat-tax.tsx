import {
  Html, Head, Body, Container, Text, Link, Hr, Preview, Button, Section,
} from "@react-email/components";
import * as React from "react";
import { main, container, paragraph, cta, link, hr, footer, footerLink } from "./_styles.js";

interface Props {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function Day9VatTax({
  firstName = "there",
  unsubscribeUrl = "#",
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Automate VAT and sales tax on your checkouts</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {firstName},</Text>

          <Text style={paragraph}>
            If you need to charge VAT or sales tax, CheckoutJoy handles it
            automatically. No more manual calculations or spreadsheet headaches.
          </Text>

          <Section>
            <Button style={cta} href="https://www.youtube.com/watch?v=2SHSPOI9S4g">
              Watch: Automatic Sales Tax Setup →
            </Button>
          </Section>

          <Text style={paragraph}>
            That's a 5-minute tutorial that covers the full setup.
          </Text>

          <Text style={paragraph}>
            For a deeper dive into invoicing and VAT compliance, check out the{" "}
            <Link style={link} href="https://checkoutjoy.com/docs/features/invoices/sales-tax">
              tax documentation
            </Link>
            .
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

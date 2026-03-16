import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Link,
  Hr,
  Preview,
} from "@react-email/components";
import * as React from "react";

interface PlaceholderEmailProps {
  firstName?: string;
  unsubscribeUrl?: string;
}

export default function PlaceholderEmail({
  firstName = "there",
  unsubscribeUrl = "#",
}: PlaceholderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Placeholder email template</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hey {firstName},</Text>
          <Text style={paragraph}>
            This is a placeholder template. Replace it with your actual email
            content.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            <Link href={unsubscribeUrl} style={footerLink}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container: React.CSSProperties = {
  margin: "0 auto",
  padding: "24px 20px",
  maxWidth: "580px",
};

const paragraph: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.5",
  color: "#333333",
};

const hr: React.CSSProperties = {
  borderColor: "#eeeeee",
  margin: "32px 0",
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
  marginTop: "40px",
};

const footerLink: React.CSSProperties = {
  color: "#999999",
};

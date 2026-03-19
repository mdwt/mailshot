# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.x.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Mailshot, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, use one of these methods:

1. **GitHub Private Vulnerability Reporting** — Use the [Security tab](https://github.com/mdwt/mailshot/security/advisories/new) to submit a private advisory directly on GitHub.
2. **Email** — Send details to **meiringdewet1@gmail.com**.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to expect

- **Acknowledgment** within 48 hours of your report
- **Status update** within 7 days with an assessment and remediation plan
- **Public disclosure** via GitHub Security Advisory after a fix is released

## Security Considerations

Mailshot is a serverless email sequencing framework deployed on AWS. Key areas of security concern include:

- **Unsubscribe tokens** — HMAC-SHA256 signed with a secret key stored in SSM Parameter Store, with 90-day expiry
- **Unsubscribe endpoint** — Unauthenticated Lambda Function URL; token validation is the sole access control
- **SES sending** — Ensure SES is configured in production mode (not sandbox) with appropriate sending limits
- **DynamoDB access** — All subscriber data (email, attributes) is stored in a single table; IAM policies should follow least privilege
- **SSM Parameter Store** — Contains all runtime configuration including secrets; restrict access to deployment roles and Lambda execution roles
- **S3 template bucket** — Contains rendered HTML templates; should not be publicly accessible
- **EventBridge** — Custom event bus should restrict which sources can publish events

## Best Practices for Deployers

- Rotate the unsubscribe HMAC secret periodically
- Enable AWS CloudTrail for audit logging
- Use a dedicated AWS account or at minimum a dedicated IAM role for Mailshot resources
- Review SES bounce and complaint rates to maintain sender reputation
- Keep dependencies up to date — run `pnpm audit` regularly

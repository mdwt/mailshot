# PII Storage — Compliance Notes

Internal research notes on what legal and regulatory frameworks actually
require when storing subscriber email addresses and related personal data in
DynamoDB, and where the current default deployment sits relative to those
requirements. Captured as input to the DynamoDB encryption work tracked on
the `claude/dynamodb-email-encryption-*` branches.

> **Not legal advice.** These notes are an engineering-level summary based
> on the public text of the listed frameworks and standard AWS guidance.
> Anyone shipping to production under any of these regimes should get
> their own qualified review.

## What we store that counts as personal data

Subscriber records persisted by Mailshot in DynamoDB include:

- Email address (also embedded in DynamoDB partition and sort keys)
- First name
- Arbitrary custom attributes supplied by the user's app (platform,
  country, gateway, etc.)
- Engagement signals (opens, clicks, link URLs, user-agent)
- Captured reply bodies (when `captureReplies: true`)
- Suppression reason and bounce metadata

Under every framework below, **email addresses on their own are personal
data**. Engagement signals tied to an email are also personal data. Reply
bodies may contain anything the sender writes back.

## Framework summary

### GDPR (EU 2016/679)

- Email addresses are personal data under **Art. 4(1)**.
- **Art. 32** requires "appropriate technical and organisational measures"
  proportionate to the risk — encryption is named as an example, not as an
  absolute requirement. AWS-managed encryption at rest combined with
  least-privilege IAM is widely accepted as meeting Art. 32 for low-to-
  moderate-risk processing of marketing-style email data.
- **Pseudonymization** is defined in Art. 4(5) and *encouraged* by
  recital 26 and Art. 32(1)(a). It is not mandatory, but it materially
  reduces breach-notification severity (Art. 33–34): a leak of pseudonymised
  data without the linking key is generally not a notifiable personal-data
  breach.
- **Right to erasure** (Art. 17) is satisfied today via the MCP
  `delete_subscriber` tool; encryption changes do not affect this.

**Implication for Mailshot:** Default deployment with AWS-owned encryption
+ IAM satisfies the legal floor for typical marketing/transactional use.
Pseudonymising the email in DynamoDB partition keys is a posture upgrade,
not a legal gate.

### UK GDPR / Data Protection Act 2018

Mirrors EU GDPR for the purposes of this analysis.

### CCPA / CPRA (California)

- Email addresses are personal information under **Cal. Civ. Code
  § 1798.140(o)**.
- The statute requires "reasonable security procedures and practices."
  AWS-managed encryption at rest + IAM is consistent with that standard.
- No pseudonymization mandate.

**Implication:** Same posture as GDPR — current default is sufficient;
encryption upgrades are optional defense-in-depth.

### SOC 2 (Type I / Type II)

- The Trust Services Criteria require encryption of data at rest **and**
  in transit. DynamoDB's default AWS-owned KMS key satisfies the "at rest"
  control; TLS-by-default on AWS APIs satisfies "in transit."
- Type II audits typically want evidence of key management practice.
  Switching to **AWS-managed** (`alias/aws/dynamodb`) gives CloudTrail
  visibility into key use, which is easier to evidence than the AWS-owned
  key. A **customer-managed CMK** gives full rotation and revocation
  control and is the cleanest evidence for Type II.

**Implication:** A free upgrade to AWS-managed encryption is the lowest-
friction posture improvement for SOC 2 evidence.

### HIPAA

- Only relevant if email addresses become **PHI** — i.e., they are
  associated with health information for individually identifiable
  individuals.
- Requires a signed **BAA with AWS** (covers DynamoDB, KMS, Lambda, SES,
  Step Functions, etc.).
- The HIPAA Security Rule (§ 164.312) requires encryption of ePHI at rest
  as an "addressable" implementation specification. In practice auditors
  expect either AWS-managed or customer-managed KMS keys, with CMK being
  the conservative default for production PHI workloads.

**Implication:** Mailshot is not HIPAA-ready by default. A deployer
intending to send transactional health communications would need to enable
a customer-managed CMK on both tables and ensure their AWS account is
under a BAA before going live.

### PCI DSS

Email addresses on their own are not in scope for PCI DSS — PCI applies to
cardholder data (PAN, CVV, etc.), which Mailshot does not handle. No
specific obligations unless reply bodies or custom attributes are misused
to carry cardholder data, which should be prevented at the application
layer.

### CAN-SPAM (US)

No encryption requirements. Mailshot already satisfies CAN-SPAM's
operational requirements (unsubscribe link, accurate sender headers).

### Other regional regimes worth noting

- **PIPEDA (Canada):** "appropriate safeguards" — same posture as
  GDPR/CCPA; current default is sufficient.
- **LGPD (Brazil):** modelled on GDPR; same conclusions apply.
- **POPIA (South Africa):** requires "appropriate, reasonable technical
  and organisational measures." AWS default encryption + IAM is
  consistent.

## What the current default deployment provides

As of the audit on the `claude/dynamodb-email-encryption-*` branches:

- DynamoDB tables (main and events) use the **AWS-owned KMS key** — the
  free default. Encryption at rest is on, but the key is not visible to
  the account and there is no per-account audit trail of key use.
- S3 template bucket uses `BucketEncryption.S3_MANAGED`.
- All AWS API calls are over TLS by default.
- IAM roles are scoped per-Lambda by CDK; least privilege is the intent.
- The HMAC secret used for unsubscribe tokens is stored in SSM Parameter
  Store (`UNSUBSCRIBE_SECRET`).
- Emails are stored in plaintext in DynamoDB partition keys (`SUB#<email>`)
  in both tables and in two inverted indexes (`TAG#<tag>`/`SK = SUB#<email>`
  and `EXEC#<seq>`/`SK = SUB#<email>`).

## Where this leaves us

For the typical marketing/transactional use case (no PHI, no cardholder
data, standard GDPR/CCPA exposure):

- **The legal floor is met by the current default.**
- Switching to the **AWS-managed** KMS key is free and gives meaningful
  audit-trail value for SOC 2 evidence and general posture.
- A **customer-managed CMK** is the right default for any deployer with
  HIPAA, a serious SOC 2 Type II audit, or a documented requirement for
  key rotation and revocation.
- **Application-layer pseudonymization** of the email in DynamoDB keys is
  a defense-in-depth measure, not a compliance obligation. Its main value
  is reducing the severity of a hypothetical leak of DynamoDB contents
  (e.g., exposed backup, misconfigured replica, compromised read-only IAM
  principal).

The detailed engineering options for each of these levels — costs, code
impact, migration considerations — are tracked separately in the
encryption design notes (forthcoming).

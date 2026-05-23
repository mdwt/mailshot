# Internal Docs

Engineering notes, design memos, and compliance research that live with the
code but are **not** published to the public docs site (which is in
`apps/docs/`).

This directory is for material that's useful to contributors and operators
but doesn't need to be on the website — RFC-style design notes, security and
compliance research, migration plans, etc.

## Contents

- [`pii-compliance.md`](./pii-compliance.md) — What legal/regulatory frameworks
  actually require for storing email addresses and subscriber PII in
  DynamoDB, and where the current default deployment sits relative to those
  requirements.

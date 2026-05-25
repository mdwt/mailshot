---
"@mailshot/shared": minor
"@mailshot/handlers": minor
"@mailshot/cdk": minor
---

Add a `transactional` flag to sequences. Transactional sequences (and their event emails) reach subscribers who have unsubscribed from marketing and omit List-Unsubscribe headers, while still respecting bounce/complaint suppression. Unsubscribe is now a pure marketing opt-out: it no longer adds addresses to the SES suppression list (reserved for bounces/complaints) and no longer cancels in-flight transactional sequences.

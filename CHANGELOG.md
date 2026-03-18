# mailshot

## 0.1.0

### Features

- Config-driven sequence framework with auto-discovery
- Five Lambda handlers: SendEmail, Bounce, Engagement, Unsubscribe, Ingest
- Single-table DynamoDB design with subscriber profiles, executions, and send logs
- React Email templates with Liquid rendering
- SES bounce/complaint handling with automatic suppression
- EventBridge integration for event-driven sequences
- Step Functions state machines for email sequence orchestration
- MCP server for Claude Code integration
- CDK infrastructure with modular constructs

### Infrastructure

- Husky + lint-staged for pre-commit quality checks
- Commitlint for conventional commit enforcement
- Changesets for version management and changelog generation

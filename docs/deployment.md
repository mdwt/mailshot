# Deployment

## Prerequisites

- Node.js 22+
- pnpm
- AWS CLI configured with a profile that has permissions for CDK, Lambda, DynamoDB, S3, SES, EventBridge, Step Functions, SNS, SSM
- AWS CDK CLI (`npm install -g aws-cdk`)
- A verified SES domain or email address in the target region

## Environment setup

### Option 1: Interactive setup (recommended)

Use the Claude Code skill:

```
/setup-env
```

This walks you through:

1. Choosing an AWS profile
2. Discovering verified SES identities
3. Choosing sender details (from email, display name, reply-to)
4. Choosing or creating an SES configuration set
5. Naming resources (tables, bucket, bus, etc.)
6. Generating the HMAC unsubscribe secret
7. Writing the `.env` file

### Option 2: Manual setup

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
ACCOUNT=123456789012
REGION=us-east-1
STACK_NAME=StepFuncEmailer
TABLE_NAME=StepFuncEmailer
EVENTS_TABLE_NAME=StepFuncEmailer-events
TEMPLATE_BUCKET_NAME=step-func-emailer-templates-123456789012
EVENT_BUS_NAME=step-func-emailer-bus
SES_CONFIG_SET_NAME=step-func-emailer-config
SNS_TOPIC_NAME=step-func-emailer-ses-notifications
DEFAULT_FROM_EMAIL=hello@yourdomain.com
DEFAULT_FROM_NAME=YourCompany
REPLY_TO_EMAIL=support@yourdomain.com
UNSUBSCRIBE_SECRET=<generate with: openssl rand -hex 32>
SSM_PREFIX=/step-func-emailer
```

## Build pipeline

Build order matters — `shared` must build first:

```bash
pnpm install
pnpm --filter @step-func-emailer/shared build    # Types and constants
pnpm --filter @step-func-emailer/<sequenceId> build  # Templates (per sequence)
pnpm --filter @step-func-emailer/cdk build        # CDK infrastructure
```

Or build everything at once:

```bash
pnpm -r build
```

## Deploy workflow

### Option 1: Full deploy skill (recommended)

```
/deploy
```

This runs the complete pipeline:

1. Validates all sequence configs
2. Builds shared package
3. Builds all sequences (renders templates to HTML)
4. Generates Mermaid diagrams
5. Verifies all template HTML files exist
6. Builds and synthesizes CDK
7. Shows build artifacts for review
8. Deploys to AWS (after confirmation)
9. Reports stack outputs

### Option 2: Manual deploy

```bash
# Validate
pnpm --filter @step-func-emailer/cdk synth

# Deploy
pnpm --filter @step-func-emailer/cdk deploy
```

## What CDK deploys

A single `cdk deploy` creates/updates everything:

- **DynamoDB** — Main table + Events table (with TemplateIndex GSI)
- **S3** — Template bucket + BucketDeployment (uploads `build/<sequenceId>/templates/` per sequence)
- **Lambda** — 5 functions (SendEmail, CheckCondition, Unsubscribe, BounceHandler, EngagementHandler)
- **Step Functions** — One state machine per sequence (auto-discovered from `sequences/*/`)
- **EventBridge** — Custom bus + routing rules for triggers and fire-and-forget events
- **SES** — Configuration set + SNS event destinations
- **SNS** — Topics for bounce/complaint and engagement notifications
- **SSM** — All config values as parameters under the configured prefix

## Build artifacts

After building, all artifacts are in `build/`:

```
build/
  <sequenceId>/
    templates/          Rendered HTML files (deployed to S3)
      welcome.html
      day-1-checkin.html
    diagrams/           Mermaid flowcharts
      diagram.mmd
      diagram.png
  cdk/
    cdk.out/            Synthesized CloudFormation templates
```

## CDK constructs

The stack is composed of 6 constructs, instantiated in order:

1. **StorageConstruct** — Tables + bucket
2. **SesConfigConstruct** — SES config set + SNS topics
3. **LambdasConstruct** — Lambda functions with IAM permissions
4. **SsmConstruct** — SSM parameters
5. **StateMachinesConstruct** — Step Functions state machines (auto-discovers sequences)
6. **EventBusConstruct** — EventBridge bus + rules (auto-discovers sequences)

## SSM Parameter Store

All configuration is stored in SSM, not as Lambda environment variables. Lambdas read from SSM at runtime with 5-minute caching. This means you can update config values in SSM without redeploying Lambdas (changes take effect within 5 minutes).

Parameters under the configured prefix (default `/step-func-emailer/`):

| Parameter              | Value                       |
| ---------------------- | --------------------------- |
| `table-name`           | Main DynamoDB table name    |
| `events-table-name`    | Events table name           |
| `template-bucket`      | S3 template bucket name     |
| `default-from-email`   | SES sender address          |
| `default-from-name`    | SES sender display name     |
| `reply-to-email`       | Reply-to address (optional) |
| `ses-config-set`       | SES configuration set name  |
| `unsubscribe-base-url` | UnsubscribeFn Function URL  |
| `unsubscribe-secret`   | HMAC signing secret         |

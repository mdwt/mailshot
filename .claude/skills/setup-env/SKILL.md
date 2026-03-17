# Setup Environment

Interactive setup wizard that configures the `.env` file by discovering AWS resources from a chosen profile. Queries STS, SES, and SNS to auto-populate account ID, region, verified domains, from addresses, and configuration sets.

## Usage

```
/setup-env
```

## Instructions

You are configuring the project's `.env` file by discovering real AWS resources. Follow this workflow exactly, using `AskUserQuestion` for each decision point.

### Step 1: Choose AWS profile

Run `aws configure list-profiles` to get available profiles. Use `AskUserQuestion` to ask:

**"Use an existing AWS profile or create a new one with least-privilege permissions?"**

Options:

1. **Use existing profile** — present the available profiles (pick the most likely 3-4, or ask the user to type theirs if many exist)
2. **Create new profile** — create a new IAM user with the minimum permissions needed for this project (MCP server, CDK deploy, test events)

#### Option 1: Use existing profile

Once chosen, run:

```bash
aws sts get-caller-identity --profile <profile> --output json
aws configure get region --profile <profile>
```

Extract the **account ID** and **region**. If the STS call fails (expired creds, MFA needed), tell the user and stop.

#### Option 2: Create new profile with least-privilege permissions

Ask the user for an **admin profile** — an existing profile with IAM permissions to create users and policies. This will only be used during setup.

```bash
aws sts get-caller-identity --profile <admin-profile> --output json
aws configure get region --profile <admin-profile>
```

Extract the **account ID** and **region**. If the STS call fails, tell the user and stop.

Ask the user for a **name** for the new profile. Default to `step-func-emailer`.

**Important:** Do NOT create the IAM user yet. Continue through steps 2-5 first to collect all resource names (table, bucket, event bus, etc.). The IAM policy needs these names to scope permissions. Return to this step after step 5 to create the user.

After step 5, create the IAM user and policy with the resource names collected:

```bash
# Create the IAM policy with least-privilege permissions
aws iam create-policy \
  --profile <admin-profile> \
  --policy-name <new-profile-name>-policy \
  --policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:<region>:<account>:table/<table-name>",
        "arn:aws:dynamodb:<region>:<account>:table/<table-name>/index/*",
        "arn:aws:dynamodb:<region>:<account>:table/<events-table-name>",
        "arn:aws:dynamodb:<region>:<account>:table/<events-table-name>/index/*"
      ]
    },
    {
      "Sid": "S3Templates",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::<template-bucket-name>", "arn:aws:s3:::<template-bucket-name>/*"]
    },
    {
      "Sid": "StepFunctions",
      "Effect": "Allow",
      "Action": ["states:StopExecution", "states:ListExecutions"],
      "Resource": "*"
    },
    {
      "Sid": "EventBridge",
      "Effect": "Allow",
      "Action": "events:PutEvents",
      "Resource": "arn:aws:events:<region>:<account>:event-bus/<event-bus-name>"
    },
    {
      "Sid": "CDKBootstrap",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::<account>:role/cdk-hnb659fds-*-<account>-<region>"
    }
  ]
}' --output json
```

Extract the policy ARN from the response. Then create the IAM user and attach the policy:

```bash
# Create IAM user
aws iam create-user --profile <admin-profile> --user-name <new-profile-name> --output json

# Attach the policy
aws iam attach-user-policy --profile <admin-profile> \
  --user-name <new-profile-name> \
  --policy-arn <policy-arn>

# Create access keys
aws iam create-access-key --profile <admin-profile> --user-name <new-profile-name> --output json
```

Extract the `AccessKeyId` and `SecretAccessKey` from the response. Configure the new AWS profile:

```bash
aws configure set aws_access_key_id <access-key-id> --profile <new-profile-name>
aws configure set aws_secret_access_key <secret-access-key> --profile <new-profile-name>
aws configure set region <region> --profile <new-profile-name>
```

Verify the new profile works:

```bash
aws sts get-caller-identity --profile <new-profile-name> --output json
```

Use `<new-profile-name>` as the profile for the rest of the setup. Tell the user the access key secret was only shown once and is now configured in their AWS CLI profile.

### Step 2: Discover SES identities

```bash
aws sesv2 list-email-identities --profile <profile> --region <region> --output json
```

Filter to only **verified** identities (`VerificationStatus: SUCCESS`, `SendingEnabled: true`). Separate into:

- **Domains** (`IdentityType: DOMAIN`)
- **Email addresses** (`IdentityType: EMAIL_ADDRESS`)

If no verified identities are found, warn the user that SES is not set up in this region. Ask if they want to try a different region or continue with manual values.

### Step 3: Choose sending domain / from email

Present the verified domains and email addresses to the user via `AskUserQuestion`:

**"Which domain should emails be sent from?"** — list verified domains. This determines what `DEFAULT_FROM_EMAIL` will use (e.g., choosing `example.com` means the from address will be `something@example.com`).

Then ask: **"What should the default from email address be?"** — offer suggestions based on the chosen domain (e.g., `hello@<domain>`, `noreply@<domain>`) plus any verified individual email addresses on that domain.

Then ask: **"What should the default from display name be?"** — suggest the domain name titlecased, or common patterns.

Then ask: **"What reply-to email address should be used? (optional)"** — suggest `support@<domain>`, `help@<domain>`, or leave blank. This sets `REPLY_TO_EMAIL`, which adds a `Reply-To` header to all outgoing emails. If left blank, the variable is omitted from `.env`.

### Step 4: Discover existing SES configuration sets

```bash
aws sesv2 list-configuration-sets --profile <profile> --region <region> --output json
```

If configuration sets exist, ask the user if they want to **reuse an existing one** or **create a new one** (the CDK stack will create it). If they choose an existing one, use that name. Otherwise, default to `step-func-emailer-config`.

### Step 5: Choose resource names

Ask the user for a **project prefix** to use for naming resources. Default to `step-func-emailer`. This prefix will be used to generate:

- `STACK_NAME` → `<Prefix>` (PascalCase, e.g., `StepFuncEmailer`)
- `TABLE_NAME` → `<Prefix>` (PascalCase)
- `EVENTS_TABLE_NAME` → `<Prefix>-events`
- `TEMPLATE_BUCKET_NAME` → `<prefix>-templates-<accountId>` (lowercase with account ID for uniqueness)
- `EVENT_BUS_NAME` → `<prefix>-bus`
- `SES_CONFIG_SET_NAME` → from step 4, or `<prefix>-config`
- `SNS_TOPIC_NAME` → `<prefix>-ses-notifications`
- `SSM_PREFIX` → `/<prefix>`

Present the generated names to the user and let them confirm or adjust.

### Step 6: Generate unsubscribe secret

Generate a random secret for HMAC-SHA256 unsubscribe token signing:

```bash
openssl rand -hex 32
```

### Step 7: Write the `.env` file

Check if `.env` already exists. If it does, show a diff of what will change and ask for confirmation before overwriting.

Write the `.env` file with all values:

```
AWS_PROFILE=<profile>
ACCOUNT=<accountId>
REGION=<region>
STACK_NAME=<stackName>
TABLE_NAME=<tableName>
EVENTS_TABLE_NAME=<eventsTableName>
TEMPLATE_BUCKET_NAME=<templateBucketName>
EVENT_BUS_NAME=<eventBusName>
SES_CONFIG_SET_NAME=<sesConfigSetName>
SNS_TOPIC_NAME=<snsTopicName>
DEFAULT_FROM_EMAIL=<fromEmail>
DEFAULT_FROM_NAME=<fromName>
REPLY_TO_EMAIL=<replyToEmail>  # omit line if blank
UNSUBSCRIBE_SECRET=<secret>
SSM_PREFIX=<ssmPrefix>
```

### Step 8: Set up MCP server

Register the MCP server for Claude Code so the subscriber management and engagement tools are available:

```bash
claude mcp add step-func-emailer -e AWS_PROFILE=<profile> -- npx @step-func-emailer/mcp
```

Tell the user they'll need to restart Claude Code for the MCP tools to become available.

### Step 9: Verify

Run a quick sanity check:

```bash
source .env && echo "Account: $ACCOUNT | Region: $REGION | From: $DEFAULT_FROM_EMAIL"
```

Print a summary:

```
Environment configured:
- AWS Account: <accountId> (profile: <profile>)
- Region: <region>
- From: <fromName> <fromEmail>
- Stack: <stackName>
- SES Config Set: <sesConfigSetName> (existing/new)
- IAM user: <new-profile-name> (least-privilege) — if created
- MCP server: registered (restart Claude Code to activate)

Run /deploy when you're ready to deploy.
```

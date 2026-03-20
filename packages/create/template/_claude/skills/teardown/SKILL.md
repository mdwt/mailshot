---
description: Tear down a deployed stack and optionally delete retained resources (DynamoDB tables + S3 bucket). Use when the user wants to destroy, tear down, remove, delete the stack, clean up AWS, or undo a deployment. Trigger phrases: "teardown", "tear down", "destroy", "delete stack", "remove stack", "clean up AWS", "cdk destroy".
disable-model-invocation: true
---

# Teardown

Guided teardown workflow: check for running executions, confirm with the user, destroy the CDK stack, and optionally delete retained data resources.

## Usage

```
/teardown
```

## Instructions

Run through each phase below in order. Stop at the first failure with a clear error message.

### Phase 1: Load config from .env

Read the root `.env` file and extract these values:

- `AWS_PROFILE`
- `STACK_NAME`
- `TABLE_NAME`
- `EVENTS_TABLE_NAME`
- `TEMPLATE_BUCKET_NAME`
- `REGION`

If `.env` is missing, tell the user to run `/setup-env` first and stop.

Verify AWS credentials work:

```bash
AWS_PROFILE=<profile> aws sts get-caller-identity --region <region>
```

If credentials fail, stop and report the error.

### Phase 2: Check deployment status

```bash
AWS_PROFILE=<profile> aws cloudformation describe-stacks --stack-name <stackName> --region <region>
```

- If the stack exists in a stable state (`CREATE_COMPLETE`, `UPDATE_COMPLETE`, `UPDATE_ROLLBACK_COMPLETE`, etc.) → proceed to Phase 3
- If the stack is in a transitional state (`CREATE_IN_PROGRESS`, `DELETE_IN_PROGRESS`, `UPDATE_IN_PROGRESS`, etc.) → warn the user the stack is currently transitioning, tell them to wait, and stop
- If the stack doesn't exist (error: "does not exist") → skip to Phase 5 to check for orphaned retained resources

### Phase 3: Check for running Step Functions executions

List the stack's state machines:

```bash
AWS_PROFILE=<profile> aws stepfunctions list-state-machines --region <region>
```

Filter results to state machines whose name starts with the stack name. For each matching state machine, check for running executions:

```bash
AWS_PROFILE=<profile> aws stepfunctions list-executions --state-machine-arn <arn> --status-filter RUNNING --region <region>
```

If any running executions are found, report how many and on which state machines. Ask the user:

1. **Stop all running executions first, then proceed with teardown**
2. **Proceed with teardown anyway** (running executions will be orphaned and eventually fail)
3. **Cancel teardown**

If stopping executions, use `aws stepfunctions stop-execution` for each:

```bash
AWS_PROFILE=<profile> aws stepfunctions stop-execution --execution-arn <arn> --cause "Stack teardown" --region <region>
```

### Phase 4: Choose teardown level and confirm

Present the user with two teardown options:

1. **Stack only** - destroys the CloudFormation stack but leaves the 3 retained data resources:
   - DynamoDB table: `<TABLE_NAME>`
   - DynamoDB events table: `<EVENTS_TABLE_NAME>`
   - S3 template bucket: `<TEMPLATE_BUCKET_NAME>`

2. **Full teardown** - destroys the stack AND deletes all 3 retained data resources. **This permanently deletes all subscriber data, engagement events, and uploaded templates.**

Show exactly what will be deleted and what will be retained for the chosen option.

Then ask the user to **type the stack name** (`<STACK_NAME>`) to confirm. This is a destructive operation - do not accept "yes", "y", or any other shorthand. Only proceed if the typed value exactly matches the stack name.

### Phase 5: Execute stack destruction

If the stack exists (i.e., we didn't skip here from Phase 2):

```bash
dotenv -- npx cdk destroy --force
```

The `--force` flag skips CDK's interactive confirmation prompt, which is redundant since the user already confirmed by typing the stack name. The `dotenv --` prefix loads `.env` automatically (including `AWS_PROFILE`). Never run `npx cdk destroy` without `dotenv --`.

Wait for the command to complete. If it fails, report the error and stop.

### Phase 6: Delete retained resources (full teardown only)

Only run this phase if the user chose "Full teardown" in Phase 4 (or if skipped from Phase 2 and the user chose to clean up orphaned resources).

For each resource, handle the "already deleted" case gracefully (the resource may not exist if this is cleaning up orphans).

**Empty and delete S3 bucket:**

```bash
AWS_PROFILE=<profile> aws s3 rm s3://<TEMPLATE_BUCKET_NAME> --recursive --region <region>
AWS_PROFILE=<profile> aws s3 rb s3://<TEMPLATE_BUCKET_NAME> --region <region>
```

**Delete DynamoDB tables:**

```bash
AWS_PROFILE=<profile> aws dynamodb delete-table --table-name <TABLE_NAME> --region <region>
AWS_PROFILE=<profile> aws dynamodb delete-table --table-name <EVENTS_TABLE_NAME> --region <region>
```

**Wait for table deletion to complete:**

```bash
AWS_PROFILE=<profile> aws dynamodb wait table-not-exists --table-name <TABLE_NAME> --region <region>
AWS_PROFILE=<profile> aws dynamodb wait table-not-exists --table-name <EVENTS_TABLE_NAME> --region <region>
```

### Phase 7: Verify and report

Confirm the stack is gone:

```bash
AWS_PROFILE=<profile> aws cloudformation describe-stacks --stack-name <stackName> --region <region>
```

This should return an error ("does not exist"). If the stack still exists, report a warning.

If full teardown, confirm the retained resources are gone too (check for errors on describe calls).

Print a final summary:

```
Teardown complete.
- Stack: <stackName> - deleted
- DynamoDB table (<TABLE_NAME>) - deleted / retained
- DynamoDB events table (<EVENTS_TABLE_NAME>) - deleted / retained
- S3 bucket (<TEMPLATE_BUCKET_NAME>) - deleted / retained
- .env file - kept (run /setup-env to reconfigure, or /deploy to redeploy)
```

If any resources were retained, remind the user they can run `/teardown` again to clean them up later.

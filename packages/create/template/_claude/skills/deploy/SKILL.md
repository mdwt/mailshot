# Deploy

Full deployment workflow: validate all sequences, build everything, generate all artifacts into `build/`, verify with the user, and deploy to AWS.

## Usage

```
/deploy
```

## Instructions

Run through each phase below in order. Stop at the first failure with a clear error message. Always ask for confirmation before the final `cdk deploy` step.

### Phase 1: Validate all sequences

Run `/validate-sequence` (no argument — validates all sequences). If any sequence fails validation, stop and report the errors. Do not proceed to build/deploy with invalid configs.

### Phase 2: Build shared dependencies

```bash
pnpm build
```

This builds all packages in the correct order.

### Phase 3: Verify all template HTML files

After building, collect every `templateKey` from every `sequence.config.ts` (send steps recursively + events) and verify the corresponding `build/<sequenceId>/templates/<templateName>.html` file exists (where `templateKey` is `<sequenceId>/<templateName>`).

If any are missing, report which templateKeys are missing and which sequence they belong to. This catches cases where:

- A template was referenced in the config but the .tsx file was never created
- The render script failed silently for a specific template
- A templateKey has a typo

### Phase 4: CDK synth

Read `AWS_PROFILE` from the root `.env` file and pass it as an environment variable:

```bash
AWS_PROFILE=<profile-from-env> npx cdk synth
```

Review the synth output for any errors or warnings. If synth fails, report the error and stop.

### Phase 5: Review build artifacts with user

Show the user a complete summary of all generated artifacts in `build/`:

- **For each sequence**: list the `build/<sequenceId>/templates/` files
- **CDK output**: confirm `build/cdk/` contains synthesized CloudFormation templates
- Show total counts: number of sequences, templates per sequence, total templates

Then show a deployment summary:

- List of sequences (with step count and event count for each)
- Any changes detected (new sequences, modified configs)

Ask: **"All build artifacts are in `build/`. Please review the files above. Ready to deploy? This will update the live AWS stack."**

Only proceed after the user confirms.

### Phase 6: Deploy

Read `AWS_PROFILE` from the root `.env` file and pass it as an environment variable to the deploy command:

```bash
AWS_PROFILE=<profile-from-env> npx cdk deploy --require-approval never
```

This single command handles everything:

- Updates DynamoDB tables if needed
- Deploys Lambda functions
- Creates/updates Step Functions state machines
- Creates/updates EventBridge rules
- Uploads all rendered HTML templates to S3 (via CDK BucketDeployment from `build/<sequenceId>/templates/`)
- Updates SSM parameters
- Updates SES configuration

### Phase 7: Post-deploy verification

After deploy completes, report:

- Stack outputs (table name, template bucket, unsubscribe URL, event bus name)
- Any CloudFormation warnings

```
Deploy complete.
- Stack: <stackName>
- Sequences: <list>
- Templates uploaded to: <bucketName>
```

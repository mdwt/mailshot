import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  SFNClient,
  ListStateMachinesCommand,
  DescribeStateMachineCommand,
} from "@aws-sdk/client-sfn";
import {
  EventBridgeClient,
  ListRulesCommand,
  DescribeRuleCommand,
  ListTargetsByRuleCommand,
} from "@aws-sdk/client-eventbridge";
import type {
  SequenceDefinition,
  SequenceStep,
  SubscriberMapping,
  EventEmail,
} from "@mailshot/shared";
import type { McpConfig } from "../config.js";

let s3: S3Client;
let sfn: SFNClient;
let eb: EventBridgeClient;

function getS3(region: string): S3Client {
  if (!s3) s3 = new S3Client({ region });
  return s3;
}

function getSfn(region: string): SFNClient {
  if (!sfn) sfn = new SFNClient({ region });
  return sfn;
}

function getEb(region: string): EventBridgeClient {
  if (!eb) eb = new EventBridgeClient({ region });
  return eb;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pascalCase(id: string): string {
  return id
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function unpascalCase(pascal: string): string {
  return pascal
    .replace(/([A-Z])/g, (match, _p1, offset) => (offset === 0 ? match : `-${match}`))
    .toLowerCase();
}

function secondsToDuration(secs: number): { days?: number; hours?: number; minutes?: number } {
  if (secs % 86400 === 0) return { days: secs / 86400 };
  if (secs % 3600 === 0) return { hours: secs / 3600 };
  if (secs % 60 === 0) return { minutes: secs / 60 };

  const days = Math.floor(secs / 86400);
  const remainder = secs % 86400;
  const hours = Math.floor(remainder / 3600);
  const minutes = Math.floor((remainder % 3600) / 60);

  const result: { days?: number; hours?: number; minutes?: number } = {};
  if (days > 0) result.days = days;
  if (hours > 0) result.hours = hours;
  if (minutes > 0) result.minutes = minutes;
  return result;
}

// ── ASL Reverse Parser ───────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function parseSteps(
  states: Record<string, any>,
  currentStateName: string | undefined,
  prefix: string,
  stopAtState?: string,
): SequenceStep[] {
  const steps: SequenceStep[] = [];
  let current = currentStateName;

  while (current && current !== stopAtState) {
    const state = states[current];
    if (!state) break;
    const name = current;

    // Send step: {Prefix}-Send{N}
    const sendMatch = name.match(new RegExp(`^${escapeRegex(prefix)}-Send(\\d+)$`));
    if (sendMatch) {
      const params = state.Parameters ?? {};
      steps.push({
        type: "send",
        templateKey: params.templateKey ?? params["templateKey.$"] ?? "",
        subject: params.subject ?? params["subject.$"] ?? "",
      });
      current = state.Next;
      continue;
    }

    // Wait step: {Prefix}-Wait{N}
    const waitMatch = name.match(new RegExp(`^${escapeRegex(prefix)}-Wait(\\d+)$`));
    if (waitMatch) {
      const secs = state.Seconds ?? 0;
      steps.push({ type: "wait", ...secondsToDuration(secs) });
      current = state.Next;
      continue;
    }

    // Condition step: {Prefix}-Check{N} → Cond{N} → branches → CondMerge{N}
    const checkMatch = name.match(new RegExp(`^${escapeRegex(prefix)}-Check(\\d+)$`));
    if (checkMatch) {
      const n = checkMatch[1];
      const params = state.Parameters ?? {};
      const condChoiceName = state.Next;
      const condChoice = states[condChoiceName];
      const mergeStateName = `${prefix}-CondMerge${n}`;

      // Extract check parameters
      const check = params.check ?? params["check.$"] ?? "subscriber_field_exists";
      const field = params.field ?? params["field.$"] ?? undefined;
      const value = params.value ?? params["value.$"] ?? undefined;
      const templateKey = params.templateKey ?? params["templateKey.$"] ?? undefined;

      // Parse branches
      let thenTarget: string | undefined;
      const elseTarget: string | undefined = condChoice?.Default;

      if (condChoice?.Choices) {
        for (const rule of condChoice.Choices) {
          if (rule.BooleanEquals === true) {
            thenTarget = rule.Next;
          }
        }
      }
      const thenSteps = parseSteps(states, thenTarget, prefix, mergeStateName);
      const elseSteps = parseSteps(states, elseTarget, prefix, mergeStateName);

      const step: SequenceStep = {
        type: "condition",
        check,
        then: thenSteps,
      };
      if (field !== undefined) (step as any).field = field;
      if (value !== undefined) (step as any).value = value;
      if (templateKey !== undefined) (step as any).templateKey = templateKey;
      if (elseSteps.length > 0) (step as any).else = elseSteps;

      steps.push(step);
      current = states[mergeStateName]?.Next;
      continue;
    }

    // Choice step: {Prefix}-Choice{N} → branches → ChoiceMerge{N}
    const choiceMatch = name.match(new RegExp(`^${escapeRegex(prefix)}-Choice(\\d+)$`));
    if (choiceMatch) {
      const n = choiceMatch[1];
      const mergeStateName = `${prefix}-ChoiceMerge${n}`;

      // Extract field from first choice rule's Variable
      const choices = state.Choices ?? [];
      const field = choices[0]?.Variable ?? "";

      const branches: { value: string; steps: SequenceStep[] }[] = [];
      for (const rule of choices) {
        if (rule.StringEquals !== undefined) {
          const branchSteps = parseSteps(states, rule.Next, prefix, mergeStateName);
          branches.push({ value: rule.StringEquals, steps: branchSteps });
        }
      }

      // Default branch
      let defaultSteps: SequenceStep[] | undefined;
      if (state.Default) {
        const defaultParsed = parseSteps(states, state.Default, prefix, mergeStateName);
        if (defaultParsed.length > 0) {
          defaultSteps = defaultParsed;
        }
      }

      const step: SequenceStep = {
        type: "choice",
        field,
        branches,
      };
      if (defaultSteps) (step as any).default = defaultSteps;

      steps.push(step);
      current = states[mergeStateName]?.Next;
      continue;
    }

    // Structural states - skip/break
    if (
      name.includes("Complete") ||
      name.includes("Done") ||
      name.includes("Merge") ||
      name.includes("Pass")
    ) {
      break;
    }

    // Unknown state - skip
    current = state.Next;
  }

  return steps;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── EventBridge Parsing ──────────────────────────────────────────────────────

function parseInputTransformer(
  inputPathsMap: Record<string, string> | undefined,
  inputTemplate: string | undefined,
): SubscriberMapping | undefined {
  if (!inputPathsMap || !inputTemplate) return undefined;

  try {
    // CDK generates InputTemplate as a JSON string with <varName> placeholders
    // Parse the template to find subscriber field mappings
    // The template looks like: {"subscriber":{"email":<email>,"firstName":<firstName>,...}}
    const reverseMap: Record<string, string> = {};
    for (const [varName, jsonPath] of Object.entries(inputPathsMap)) {
      reverseMap[varName] = jsonPath;
    }

    // Find which variables map to subscriber fields by parsing the template
    const mapping: SubscriberMapping = {
      email: "$.detail.email",
      firstName: "$.detail.firstName",
    };

    // Try to find email mapping
    const emailMatch = inputTemplate.match(/"email"\s*:\s*<([^>]+)>/);
    if (emailMatch && reverseMap[emailMatch[1]]) {
      mapping.email = reverseMap[emailMatch[1]];
    }

    // Try to find firstName mapping
    const firstNameMatch = inputTemplate.match(/"firstName"\s*:\s*<([^>]+)>/);
    if (firstNameMatch && reverseMap[firstNameMatch[1]]) {
      mapping.firstName = reverseMap[firstNameMatch[1]];
    }

    // Try to find attributes mapping
    const attributesMatch = inputTemplate.match(/"attributes"\s*:\s*<([^>]+)>/);
    if (attributesMatch && reverseMap[attributesMatch[1]]) {
      mapping.attributes = reverseMap[attributesMatch[1]];
    }

    return mapping;
  } catch {
    return undefined;
  }
}

// ── list_sequences ───────────────────────────────────────────────────────────

export interface SequenceInfo {
  sequenceId: string;
  stateMachineArn?: string;
  templateKeys: string[];
}

export async function listSequences(config: McpConfig): Promise<SequenceInfo[]> {
  const s3Client = getS3(config.region);
  const sfnClient = getSfn(config.region);

  // 1. S3 bucket prefixes → sequence IDs
  const s3Result = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: config.templateBucketName,
      Delimiter: "/",
    }),
  );

  const s3Sequences = new Map<string, string[]>();
  for (const prefix of s3Result.CommonPrefixes ?? []) {
    const sequenceId = prefix.Prefix?.replace(/\/$/, "");
    if (sequenceId) {
      s3Sequences.set(sequenceId, []);
    }
  }

  // Get template keys per sequence
  for (const sequenceId of s3Sequences.keys()) {
    const templatesResult = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: config.templateBucketName,
        Prefix: `${sequenceId}/`,
      }),
    );
    const keys = (templatesResult.Contents ?? [])
      .map((obj) => obj.Key!)
      .filter((k) => k.endsWith(".html"))
      .map((k) => k.replace(/\.html$/, ""));
    s3Sequences.set(sequenceId, keys);
  }

  // 2. List state machines → cross-reference with S3 prefixes
  const smResult = await sfnClient.send(new ListStateMachinesCommand({}));
  const smMap = new Map<string, string>();
  for (const sm of smResult.stateMachines ?? []) {
    if (sm.name?.endsWith("Sequence")) {
      // Reverse PascalCase → kebab-case
      const pascal = sm.name.replace(/Sequence$/, "");
      const kebab = unpascalCase(pascal);
      smMap.set(kebab, sm.stateMachineArn!);
    }
  }

  // 3. Combine results
  const allIds = new Set([...s3Sequences.keys(), ...smMap.keys()]);
  const results: SequenceInfo[] = [];

  for (const sequenceId of allIds) {
    results.push({
      sequenceId,
      stateMachineArn: smMap.get(sequenceId),
      templateKeys: s3Sequences.get(sequenceId) ?? [],
    });
  }

  return results.sort((a, b) => a.sequenceId.localeCompare(b.sequenceId));
}

// ── export_sequence ──────────────────────────────────────────────────────────

export interface ExportedSequence {
  definition: SequenceDefinition;
  templates: { key: string; html: string }[];
  warnings: string[];
}

export async function exportSequence(
  config: McpConfig,
  sequenceId: string,
): Promise<ExportedSequence> {
  const sfnClient = getSfn(config.region);
  const s3Client = getS3(config.region);
  const ebClient = getEb(config.region);
  const warnings: string[] = [];

  // 1. Find and describe state machine
  const prefix = pascalCase(sequenceId);
  const smName = `${prefix}Sequence`;

  const smList = await sfnClient.send(new ListStateMachinesCommand({}));
  const smEntry = (smList.stateMachines ?? []).find((sm) => sm.name === smName);
  if (!smEntry) {
    throw new Error(`State machine '${smName}' not found. Is the sequence deployed?`);
  }

  const smDetail = await sfnClient.send(
    new DescribeStateMachineCommand({ stateMachineArn: smEntry.stateMachineArn }),
  );
  const asl = JSON.parse(smDetail.definition!);

  // 2. Extract timeoutMinutes from ASL TimeoutSeconds
  const timeoutSeconds = asl.TimeoutSeconds;
  const timeoutMinutes = timeoutSeconds ? Math.round(timeoutSeconds / 60) : 43200;

  // 3. Parse ASL → steps
  // Find the first step after Register
  const registerState = asl.States[`${prefix}-Register`];
  const firstStepName = registerState?.Next;
  const steps = parseSteps(asl.States, firstStepName, prefix);

  // 4. Get trigger config from EventBridge
  let detailType = `${sequenceId}.trigger`;
  let subscriberMapping: SubscriberMapping = {
    email: "$.detail.email",
    firstName: "$.detail.firstName",
    attributes: "$.detail",
  };

  try {
    const rulesResult = await ebClient.send(
      new ListRulesCommand({
        EventBusName: config.eventBusName,
        NamePrefix: `${sequenceId}-`,
      }),
    );

    // Find the trigger rule (targets Step Functions, not Lambda)
    for (const rule of rulesResult.Rules ?? []) {
      const targetsResult = await ebClient.send(
        new ListTargetsByRuleCommand({
          Rule: rule.Name,
          EventBusName: config.eventBusName,
        }),
      );

      const sfnTarget = (targetsResult.Targets ?? []).find((t) =>
        t.Arn?.includes(":stateMachine:"),
      );
      if (sfnTarget) {
        // This is the sequence trigger rule
        const ruleDetail = await ebClient.send(
          new DescribeRuleCommand({
            Name: rule.Name,
            EventBusName: config.eventBusName,
          }),
        );

        // Extract detailType from event pattern
        const pattern = ruleDetail.EventPattern ? JSON.parse(ruleDetail.EventPattern) : {};
        if (pattern["detail-type"]?.[0]) {
          detailType = pattern["detail-type"][0];
        }

        // Extract subscriber mapping from input transformer
        const inputTransformer = sfnTarget.InputTransformer;
        if (inputTransformer) {
          const parsed = parseInputTransformer(
            inputTransformer.InputPathsMap,
            inputTransformer.InputTemplate,
          );
          if (parsed) {
            subscriberMapping = parsed;
          } else {
            warnings.push(
              "Could not fully parse EventBridge input transformer - using default subscriber mapping",
            );
          }
        }

        break;
      }
    }
  } catch (err) {
    warnings.push(
      `Could not read EventBridge rules: ${err instanceof Error ? err.message : String(err)}. Using default trigger config.`,
    );
  }

  // 5. Get fire-and-forget events
  const events: EventEmail[] = [];
  try {
    const rulesResult = await ebClient.send(
      new ListRulesCommand({
        EventBusName: config.eventBusName,
        NamePrefix: `${sequenceId}-`,
      }),
    );

    for (const rule of rulesResult.Rules ?? []) {
      const targetsResult = await ebClient.send(
        new ListTargetsByRuleCommand({
          Rule: rule.Name,
          EventBusName: config.eventBusName,
        }),
      );

      const lambdaTarget = (targetsResult.Targets ?? []).find(
        (t) => t.Arn?.includes(":function:") && !t.Arn?.includes(":stateMachine:"),
      );
      if (lambdaTarget) {
        // This is a fire-and-forget event rule
        const ruleDetail = await ebClient.send(
          new DescribeRuleCommand({
            Name: rule.Name,
            EventBusName: config.eventBusName,
          }),
        );

        const pattern = ruleDetail.EventPattern ? JSON.parse(ruleDetail.EventPattern) : {};
        const evtDetailType = pattern["detail-type"]?.[0];

        // Extract templateKey and subject from input transformer
        const inputTransformer = lambdaTarget.InputTransformer;
        let templateKey = "";
        let subject = "";

        if (inputTransformer?.InputTemplate) {
          const template = inputTransformer.InputTemplate;
          const templateKeyMatch = template.match(/"templateKey"\s*:\s*"([^"]+)"/);
          if (templateKeyMatch) templateKey = templateKeyMatch[1];
          const subjectMatch = template.match(/"subject"\s*:\s*"([^"]+)"/);
          if (subjectMatch) subject = subjectMatch[1];
        }

        if (evtDetailType && templateKey) {
          const evt: EventEmail = {
            detailType: evtDetailType,
            templateKey,
            subject,
          };

          // Parse subscriber mapping if different from sequence trigger
          if (inputTransformer) {
            const evtMapping = parseInputTransformer(
              inputTransformer.InputPathsMap,
              inputTransformer.InputTemplate,
            );
            if (
              evtMapping &&
              (evtMapping.email !== subscriberMapping.email ||
                evtMapping.firstName !== subscriberMapping.firstName ||
                evtMapping.attributes !== subscriberMapping.attributes)
            ) {
              evt.subscriberMapping = evtMapping;
            }
          }

          events.push(evt);
        }
      }
    }
  } catch (err) {
    warnings.push(
      `Could not read fire-and-forget event rules: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 6. Fetch templates from S3
  const templates: { key: string; html: string }[] = [];
  try {
    const templatesResult = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: config.templateBucketName,
        Prefix: `${sequenceId}/`,
      }),
    );

    for (const obj of templatesResult.Contents ?? []) {
      if (obj.Key?.endsWith(".html")) {
        const result = await s3Client.send(
          new GetObjectCommand({
            Bucket: config.templateBucketName,
            Key: obj.Key,
          }),
        );
        const html = (await result.Body?.transformToString()) ?? "";
        const key = obj.Key.replace(/\.html$/, "");
        templates.push({ key, html });
      }
    }
  } catch (err) {
    warnings.push(
      `Could not fetch templates from S3: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 7. Build the definition
  const definition: SequenceDefinition = {
    id: sequenceId,
    trigger: {
      detailType,
      subscriberMapping,
    },
    timeoutMinutes,
    steps,
  };

  if (events.length > 0) {
    definition.events = events;
  }

  // 8. Add warnings for HTML-only templates
  if (templates.length > 0) {
    warnings.push(
      "Templates are compiled HTML with Liquid placeholders (not React Email .tsx). " +
        "They work for deployment but cannot use `email dev` for preview. " +
        "You can manually convert them to React Email later.",
    );
  }

  return { definition, templates, warnings };
}

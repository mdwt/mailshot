import type * as models from "../../bindings/desktop";
import type { SequenceDefinition, SequenceStep } from "@/types/mailshot";

/** Builds the per-call AWS context from the project's .env. Null = no .env. */
export function awsCtxFor(project: models.ProjectInfo): models.AwsCtx | null {
  if (!project.hasEnv) return null;
  const env = project.env;
  if (!env || !env.TABLE_NAME || !env.EVENTS_TABLE_NAME) return null;
  return {
    profile: env.AWS_PROFILE ?? "",
    region: env.REGION ?? "",
    tableName: env.TABLE_NAME ?? "",
    eventsTableName: env.EVENTS_TABLE_NAME ?? "",
    stackName: env.STACK_NAME ?? "",
  };
}

/** Percentage of n over base, formatted; "—" when base is 0. */
export function pct(n: number, base: number): string {
  if (!base) return "—";
  return `${((n / base) * 100).toFixed(1)}%`;
}

/**
 * Human-friendly deploy state from a raw CloudFormation stack status, so the
 * UI never surfaces internal enums like `UPDATE_COMPLETE` / `ROLLBACK_COMPLETE`.
 */
export function deployState(status: string): { label: string; cls: string } {
  if (/FAILED|ROLLBACK/.test(status)) return { label: "Deploy failed", cls: "text-bad" };
  if (/IN_PROGRESS/.test(status)) return { label: "Deploying…", cls: "text-warn" };
  if (/COMPLETE/.test(status)) return { label: "Deployed", cls: "text-good" };
  return { label: "Unknown", cls: "text-warn" };
}

export function timeAgo(iso: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** All template keys referenced by a sequence (steps, variants, event emails). */
export function collectTemplateKeys(def: SequenceDefinition): string[] {
  const keys = new Set<string>();
  const walk = (steps: SequenceStep[]) => {
    for (const s of steps) {
      if (s.type === "send") {
        if (s.templateKey) keys.add(s.templateKey);
        s.variants?.forEach((v) => keys.add(v.templateKey));
      } else if (s.type === "condition") {
        walk(s.then);
        walk(s.else ?? []);
      } else if (s.type === "choice") {
        s.branches.forEach((b) => walk(b.steps));
        walk(s.default ?? []);
      }
    }
  };
  walk(def.steps);
  def.events?.forEach((e) => keys.add(e.templateKey));
  return [...keys];
}

/** Send steps in walk order (for the analytics funnel), with a display label. */
export interface FunnelStep {
  label: string;
  templateKeys: string[]; // >1 for A/B variants
}

export function collectFunnelSteps(def: SequenceDefinition): FunnelStep[] {
  const out: FunnelStep[] = [];
  const walk = (steps: SequenceStep[], prefix: string) => {
    for (const s of steps) {
      if (s.type === "send") {
        if (s.variants?.length) {
          out.push({
            label: `${prefix}${s.variants[0].templateKey.split("/").pop()?.replace(/-a$/, "")} (A/B)`,
            templateKeys: s.variants.map((v) => v.templateKey),
          });
        } else if (s.templateKey) {
          out.push({
            label: `${prefix}${s.templateKey.split("/").pop()}`,
            templateKeys: [s.templateKey],
          });
        }
      } else if (s.type === "condition") {
        walk(s.then, `${prefix}then · `);
        walk(s.else ?? [], `${prefix}else · `);
      } else if (s.type === "choice") {
        s.branches.forEach((b) => walk(b.steps, `${prefix}${b.value} · `));
        walk(s.default ?? [], `${prefix}default · `);
      }
    }
  };
  walk(def.steps, "");
  return out;
}

export type StatsMap = Record<string, models.Counters>;

export function statsMapFrom(stats: models.TemplateStat[]): StatsMap {
  const map: StatsMap = {};
  for (const s of stats) {
    if (!s.error) map[s.templateKey] = s.counters;
  }
  return map;
}

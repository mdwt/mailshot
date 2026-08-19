import { useEffect, useMemo, useState } from "react";
import {
  SequenceOverview,
  TemplateStats,
  SequenceSubscribers,
} from "../../bindings/desktop/dataservice";
import { ReadFileInProject } from "../../bindings/desktop/templateservice";
import type * as models from "../../bindings/desktop";
import type { SequenceDefinition } from "@/types/mailshot";
import { countSteps } from "@/types/mailshot";
import { collectTemplateKeys, statsMapFrom, timeAgo, type StatsMap } from "@/lib/aws";
import { FlowCanvas } from "@/components/FlowCanvas";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { SourceEditor } from "@/components/SourceEditor";

const STATS_WINDOW_DAYS = 90;

export function SequenceView({
  projectPath,
  entry,
  awsCtx,
  refreshKey,
}: {
  projectPath: string;
  entry: models.SequenceEntry;
  awsCtx: models.AwsCtx | null;
  refreshKey: number;
}) {
  const [tab, setTab] = useState<"flow" | "templates" | "analytics" | "subscribers" | "config">(
    "flow",
  );
  const [showStats, setShowStats] = useState(true);
  const [stats, setStats] = useState<StatsMap | null>(null);
  const [templateStats, setTemplateStats] = useState<models.TemplateStat[]>([]);
  const [runtime, setRuntime] = useState<models.SequenceRuntime | null>(null);
  const [subscribers, setSubscribers] = useState<models.SeqSubscriberRow[] | null>(null);
  const [configSrc, setConfigSrc] = useState<string | null>(null);

  const def = useMemo<SequenceDefinition | null>(() => {
    if (!entry.definition) return null;
    try {
      return JSON.parse(entry.definition) as SequenceDefinition;
    } catch {
      return null;
    }
  }, [entry.definition]);

  // Runtime data: per-template engagement + active execution count.
  useEffect(() => {
    if (!awsCtx || !def) return;
    let stale = false;
    TemplateStats(awsCtx, collectTemplateKeys(def), STATS_WINDOW_DAYS).then((list) => {
      if (stale) return;
      setTemplateStats(list ?? []);
      setStats(statsMapFrom(list ?? []));
    });
    SequenceOverview(awsCtx, [def.id]).then((list) => {
      if (!stale && list?.[0]) setRuntime(list[0]);
    });
    return () => {
      stale = true;
    };
  }, [awsCtx, def]);

  useEffect(() => {
    if (tab !== "subscribers" || !awsCtx || !def) return;
    SequenceSubscribers(awsCtx, def.id, 200)
      .then((rows) => setSubscribers(rows ?? []))
      .catch(() => setSubscribers([]));
  }, [tab, awsCtx, def]);

  useEffect(() => {
    setConfigSrc(null);
    if (tab !== "config") return;
    ReadFileInProject(projectPath, entry.configPath)
      .then(setConfigSrc)
      .catch((e) => setConfigSrc(`// failed to read config: ${e}`));
  }, [tab, projectPath, entry.configPath]);

  if (entry.error || !def) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">{entry.dir}</h2>
        <div className="mt-4 max-w-2xl rounded-lg border border-bad/40 bg-badsoft p-4">
          <p className="text-sm font-semibold text-bad">Config could not be evaluated</p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-muted">
            {entry.error || "definition did not parse"}
          </p>
          <p className="mt-3 text-xs text-faint">
            Fix it in an editor: <span className="font-mono select-text">{entry.configPath}</span>
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    ["flow", "Flow"],
    ["templates", "Templates"],
    ["analytics", "Analytics"],
    ["subscribers", runtime ? `Subscribers · ${runtime.activeExecutions}` : "Subscribers"],
    ["config", "Config"],
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex flex-none flex-wrap items-baseline gap-3 px-6 pt-5">
        <h2 className="text-lg font-semibold">{def.id}</h2>
        {def.transactional && (
          <span className="rounded-full bg-accentsoft px-2.5 py-0.5 text-[11px] font-medium text-accent">
            transactional
          </span>
        )}
        {def.sender.captureReplies && (
          <span className="rounded-full bg-surface2 px-2.5 py-0.5 text-[11px] font-medium text-muted">
            captures replies
          </span>
        )}
        <span className="text-xs text-faint">
          {def.sender.fromName} <span className="font-mono">&lt;{def.sender.fromEmail}&gt;</span> ·{" "}
          {countSteps(def.steps)} steps · timeout{" "}
          {def.timeoutMinutes >= 1440
            ? `${Math.round(def.timeoutMinutes / 1440)}d`
            : `${def.timeoutMinutes}m`}
          {runtime && !runtime.error && (
            <span className="text-muted"> · {runtime.activeExecutions} active</span>
          )}
        </span>
        {tab === "flow" && awsCtx && (
          <button
            onClick={() => setShowStats((s) => !s)}
            className={`ml-auto rounded-md border px-2.5 py-1 text-[11px] ${
              showStats && stats
                ? "border-accent bg-accentsoft text-accent"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            Stats overlay {showStats && stats ? "✓" : ""}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-3 flex flex-none gap-0.5 border-b border-line px-6">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[13px] ${
              tab === key
                ? "border-accent font-semibold text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === "flow" && (
          <FlowCanvas
            key={entry.dir + refreshKey + (showStats && stats ? "-stats" : "")}
            def={def}
            stats={showStats ? (stats ?? undefined) : undefined}
          />
        )}
        {tab === "templates" && (
          <TemplatesPanel
            projectPath={projectPath}
            seqDir={entry.dir}
            seqId={def.id}
            def={def}
            refreshKey={refreshKey}
          />
        )}
        {tab === "analytics" && (
          <AnalyticsPanel awsCtx={awsCtx} def={def} templateStats={templateStats} />
        )}
        {tab === "config" && (
          <div className="flex h-full min-h-0 flex-col gap-2 p-4">
            <div className="flex flex-none items-baseline gap-3">
              <span className="font-mono text-xs text-faint">{entry.configPath}</span>
              <span className="text-[11px] text-faint">read-only</span>
            </div>
            {configSrc === null ? (
              <p className="text-sm text-faint">Loading…</p>
            ) : (
              <SourceEditor
                path={entry.configPath}
                value={configSrc}
                onChange={() => {}}
                readOnly
              />
            )}
          </div>
        )}
        {tab === "subscribers" && (
          <div className="h-full min-h-0 overflow-y-auto p-6">
            {!awsCtx ? (
              <p className="text-sm text-faint">Configure .env to see who is in this sequence.</p>
            ) : subscribers === null ? (
              <p className="text-sm text-faint">Loading…</p>
            ) : subscribers.length === 0 ? (
              <p className="text-sm text-faint">No one is currently in this sequence.</p>
            ) : (
              <div className="max-w-2xl overflow-hidden rounded-lg border border-linesoft">
                {subscribers.map((s) => (
                  <div
                    key={s.email}
                    className="flex items-center gap-3 border-b border-linesoft px-4 py-2 text-[13px] last:border-b-0"
                  >
                    <span className="select-text font-mono text-[13px]">{s.email}</span>
                    {s.transactional && (
                      <span className="rounded-full bg-accentsoft px-2 py-0.5 text-[10px] font-medium text-accent">
                        txn
                      </span>
                    )}
                    <span className="ml-auto text-xs text-faint">
                      started {timeAgo(s.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

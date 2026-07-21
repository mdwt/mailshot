import { useEffect, useMemo, useState } from "react";
import {
  SequenceOverview,
  TemplateStats,
  SequenceSubscribers,
} from "../../wailsjs/go/main/DataService";
import type { main } from "../../wailsjs/go/models";
import type { SequenceDefinition } from "@/types/mailshot";
import { countSteps } from "@/types/mailshot";
import { collectTemplateKeys, statsMapFrom, timeAgo, type StatsMap } from "@/lib/aws";
import { FlowCanvas } from "@/components/FlowCanvas";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";

const STATS_WINDOW_DAYS = 90;

export function SequenceView({
  projectPath,
  entry,
  awsCtx,
  refreshKey,
}: {
  projectPath: string;
  entry: main.SequenceEntry;
  awsCtx: main.AwsCtx | null;
  refreshKey: number;
}) {
  const [tab, setTab] = useState<"flow" | "templates" | "analytics" | "subscribers">("flow");
  const [showStats, setShowStats] = useState(true);
  const [stats, setStats] = useState<StatsMap | null>(null);
  const [templateStats, setTemplateStats] = useState<main.TemplateStat[]>([]);
  const [runtime, setRuntime] = useState<main.SequenceRuntime | null>(null);
  const [subscribers, setSubscribers] = useState<main.SeqSubscriberRow[] | null>(null);

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

  if (entry.error || !def) {
    return (
      <div className="p-6">
        <h2 className="font-mono text-lg font-semibold">{entry.dir}</h2>
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
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex flex-none flex-wrap items-baseline gap-3 px-6 pt-5">
        <h2 className="font-mono text-lg font-semibold">{def.id}</h2>
        {def.transactional && (
          <span className="rounded-full bg-accentsoft px-2.5 py-0.5 font-mono text-[11px] text-accent">
            transactional
          </span>
        )}
        {def.sender.captureReplies && (
          <span className="rounded-full bg-surface2 px-2.5 py-0.5 font-mono text-[11px] text-muted">
            captures replies
          </span>
        )}
        <span className="font-mono text-xs text-faint">
          {def.sender.fromName} &lt;{def.sender.fromEmail}&gt; · {countSteps(def.steps)} steps ·
          timeout{" "}
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
            className={`ml-auto rounded-md border px-2.5 py-1 font-mono text-[11px] ${
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
        {tab === "subscribers" && (
          <div className="overflow-y-auto p-6">
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
                    <span className="select-text font-mono">{s.email}</span>
                    {s.transactional && (
                      <span className="rounded-full bg-accentsoft px-2 py-0.5 font-mono text-[10px] text-accent">
                        txn
                      </span>
                    )}
                    <span className="ml-auto font-mono text-xs text-faint">
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

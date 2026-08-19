import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FailedExecutions,
  RecentEvents,
  SequenceOverview,
  SesAccountHealth,
} from "../../bindings/desktop/dataservice";
import type * as models from "../../bindings/desktop";
import type { SequenceDefinition } from "@/types/mailshot";
import { countSteps } from "@/types/mailshot";
import { deployState, pct, timeAgo } from "@/lib/aws";

function parseDef(entry: models.SequenceEntry): SequenceDefinition | null {
  if (!entry.definition) return null;
  try {
    return JSON.parse(entry.definition) as SequenceDefinition;
  } catch {
    return null;
  }
}

const EVENT_COLOR: Record<string, string> = {
  open: "text-good",
  click: "text-accent",
  delivery: "text-muted",
  bounce: "text-bad",
  complaint: "text-bad",
  reply: "text-ink",
};

export function Dashboard({
  project,
  sequences,
  identity,
  stack,
  awsCtx,
  onOpenSequence,
}: {
  project: models.ProjectInfo;
  sequences: models.SequenceEntry[];
  identity: models.CallerIdentity | null;
  stack: models.StackInfo | null;
  awsCtx: models.AwsCtx | null;
  onOpenSequence: (dir: string) => void;
}) {
  const deploy = stack && !stack.error ? deployState(stack.status) : null;
  const seqIds = useMemo(() => sequences.map((s) => s.id).filter(Boolean), [sequences]);

  const [runtime, setRuntime] = useState<Record<string, models.SequenceRuntime>>({});
  const [ses, setSes] = useState<models.SesHealth | null>(null);
  const [failed, setFailed] = useState<models.FailedExec[] | null>(null);
  const [feed, setFeed] = useState<models.EventRow[] | null>(null);

  const loadRuntime = useCallback(() => {
    if (!awsCtx || seqIds.length === 0) return;
    SequenceOverview(awsCtx, seqIds).then((list) => {
      const m: Record<string, models.SequenceRuntime> = {};
      for (const r of list ?? []) m[r.sequenceId] = r;
      setRuntime(m);
    });
    SesAccountHealth(awsCtx).then(setSes);
    if (awsCtx.stackName) {
      FailedExecutions(awsCtx, 10)
        .then((f) => setFailed(f ?? []))
        .catch(() => setFailed([]));
    }
    RecentEvents(awsCtx, seqIds, 20)
      .then((rows) => setFeed(rows ?? []))
      .catch(() => setFeed([]));
  }, [awsCtx, seqIds]);

  useEffect(loadRuntime, [loadRuntime]);

  // Cross-sequence bounce/complaint rates from the denormalised counters.
  const totals = useMemo(() => {
    const t = { delivery: 0, bounce: 0, complaint: 0 };
    for (const r of Object.values(runtime)) {
      t.delivery += r.counters.delivery;
      t.bounce += r.counters.bounce;
      t.complaint += r.counters.complaint;
    }
    return t;
  }, [runtime]);

  const bounceRate = totals.delivery ? (totals.bounce / totals.delivery) * 100 : 0;
  const complaintRate = totals.delivery ? (totals.complaint / totals.delivery) * 100 : 0;

  return (
    <div className="h-full min-h-0 overflow-y-auto p-6">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <span className="select-text font-mono text-xs text-faint">{project.path}</span>
        <button
          onClick={loadRuntime}
          className="ml-auto rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink"
        >
          Refresh
        </button>
      </div>

      {(project.issues ?? []).length > 0 && (
        <div className="mt-4 space-y-2">
          {(project.issues ?? []).map((issue) => (
            <div
              key={issue}
              className="rounded-md border border-warn/40 bg-warnsoft px-3 py-2 text-xs text-warn"
            >
              {issue}
            </div>
          ))}
        </div>
      )}

      {/* Health strip */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 xl:grid-cols-6">
        <div className="rounded-lg border border-linesoft bg-surface2 px-4 py-3">
          <div className="text-[11px] font-medium text-faint">AWS identity</div>
          {identity === null ? (
            <div className="mt-1 text-sm text-faint">checking…</div>
          ) : identity.error ? (
            <div className="mt-1 text-xs text-bad">{identity.error}</div>
          ) : (
            <>
              <div className="mt-1 font-mono text-sm tabular-nums">{identity.account}</div>
              <div className="truncate text-xs text-faint">
                {identity.profile || "default"} · {identity.region}
              </div>
            </>
          )}
        </div>

        <div className="rounded-lg border border-linesoft bg-surface2 px-4 py-3">
          <div className="text-[11px] font-medium text-faint">
            Stack · {project.env?.STACK_NAME || "—"}
          </div>
          {stack === null ? (
            <div className="mt-1 text-sm text-faint">checking…</div>
          ) : stack.error ? (
            <div className="mt-1 text-xs text-bad">{stack.error}</div>
          ) : (
            <>
              <div className={`mt-1 text-sm ${deploy?.cls ?? "text-warn"}`}>{deploy?.label}</div>
              <div className="text-xs text-faint">
                {stack.lastUpdated && `updated ${timeAgo(stack.lastUpdated)}`}
              </div>
            </>
          )}
        </div>

        <div className="rounded-lg border border-linesoft bg-surface2 px-4 py-3">
          <div className="text-[11px] font-medium text-faint">SES quota (24h)</div>
          {!ses ? (
            <div className="mt-1 text-sm text-faint">—</div>
          ) : ses.error ? (
            <div className="mt-1 truncate text-xs text-bad">{ses.error}</div>
          ) : (
            <>
              <div className="mt-1 text-sm tabular-nums">
                {Math.round(ses.sentLast24Hours).toLocaleString()} /{" "}
                {Math.round(ses.max24HourSend).toLocaleString()}
              </div>
              <div className="text-xs text-faint">
                {ses.productionAccess ? "production" : "sandbox"} ·{" "}
                {ses.sendingEnabled ? "sending on" : "sending disabled"}
              </div>
            </>
          )}
        </div>

        <div className="rounded-lg border border-linesoft bg-surface2 px-4 py-3">
          <div className="text-[11px] font-medium text-faint">Bounce rate</div>
          <div
            className={`mt-1 text-sm tabular-nums ${bounceRate >= 5 ? "text-bad" : "text-good"}`}
          >
            {totals.delivery ? `${bounceRate.toFixed(2)}%` : "—"}
          </div>
          <div className="text-xs text-faint">threshold 5%</div>
        </div>

        <div className="rounded-lg border border-linesoft bg-surface2 px-4 py-3">
          <div className="text-[11px] font-medium text-faint">Complaint rate</div>
          <div
            className={`mt-1 text-sm tabular-nums ${complaintRate >= 0.1 ? "text-bad" : "text-good"}`}
          >
            {totals.delivery ? `${complaintRate.toFixed(3)}%` : "—"}
          </div>
          <div className="text-xs text-faint">threshold 0.1%</div>
        </div>

        <div className="rounded-lg border border-linesoft bg-surface2 px-4 py-3">
          <div className="text-[11px] font-medium text-faint">Failed executions</div>
          <div
            className={`mt-1 text-sm tabular-nums ${failed?.length ? "text-warn" : "text-good"}`}
          >
            {failed === null ? "—" : failed.length}
          </div>
          <div className="text-xs text-faint">recent, all sequences</div>
        </div>
      </div>

      {/* Sequence cards */}
      <div className="mt-6 text-[11px] font-medium text-faint">
        Sequences · {sequences.length} local
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sequences.map((entry) => {
          const def = parseDef(entry);
          const r = def ? runtime[def.id] : undefined;
          const c = r?.counters;
          return (
            <button
              key={entry.dir}
              onClick={() => onOpenSequence(entry.dir)}
              className="rounded-lg border border-line bg-surface p-4 text-left hover:border-accent/60"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{def?.id ?? entry.dir}</span>
                {def?.transactional && (
                  <span className="rounded-full bg-accentsoft px-2 py-0.5 text-[10px] font-medium text-accent">
                    transactional
                  </span>
                )}
                {entry.error && (
                  <span className="rounded-full bg-badsoft px-2 py-0.5 text-[10px] font-medium text-bad">
                    config error
                  </span>
                )}
              </div>
              {def ? (
                <div className="mt-1.5 text-xs text-faint">
                  {countSteps(def.steps)} steps · trigger{" "}
                  <span className="font-mono">{def.trigger.detailType}</span>
                </div>
              ) : (
                <div className="mt-1.5 truncate text-xs text-bad">{entry.error}</div>
              )}
              {c ? (
                <div className="mt-3 flex gap-5 tabular-nums">
                  <span>
                    <span className="block text-base">{r!.activeExecutions}</span>
                    <span className="text-[10px] text-faint">active</span>
                  </span>
                  <span>
                    <span className="block text-base">{c.delivery.toLocaleString()}</span>
                    <span className="text-[10px] text-faint">delivered</span>
                  </span>
                  <span>
                    <span className="block text-base text-good">{pct(c.open, c.delivery)}</span>
                    <span className="text-[10px] text-faint">open</span>
                  </span>
                  <span>
                    <span className="block text-base">{pct(c.click, c.delivery)}</span>
                    <span className="text-[10px] text-faint">click</span>
                  </span>
                </div>
              ) : (
                def && (
                  <div className="mt-2 truncate text-xs text-muted">
                    {def.sender.fromName} &lt;{def.sender.fromEmail}&gt;
                    {r?.error && <span className="ml-2 text-bad">stats unavailable</span>}
                  </div>
                )
              )}
            </button>
          );
        })}
        {sequences.length === 0 && (
          <div className="rounded-lg border border-dashed border-line p-6 text-sm text-faint">
            No sequences yet. Create one with the /create-sequence skill in Claude Code — it will
            appear here automatically.
          </div>
        )}
      </div>

      {/* Recent engagement + failures */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="text-[11px] font-medium text-faint">Recent engagement</div>
          <div className="mt-2 overflow-hidden rounded-lg border border-linesoft">
            {feed === null ? (
              <p className="px-4 py-3 text-xs text-faint">
                {awsCtx ? "Loading…" : "Configure .env to see live engagement."}
              </p>
            ) : feed.length === 0 ? (
              <p className="px-4 py-3 text-xs text-faint">No events yet.</p>
            ) : (
              feed.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-linesoft px-4 py-1.5 text-[13px] last:border-b-0"
                >
                  <span
                    className={`w-[74px] flex-none text-[11px] font-medium ${EVENT_COLOR[e.eventType] ?? "text-muted"}`}
                  >
                    {e.eventType}
                  </span>
                  <span className="select-text truncate font-mono text-xs">{e.email}</span>
                  <span className="truncate font-mono text-xs text-muted">{e.templateKey}</span>
                  <span className="ml-auto flex-none text-xs tabular-nums text-faint">
                    {timeAgo(e.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium text-faint">Failed executions</div>
          <div className="mt-2 overflow-hidden rounded-lg border border-linesoft">
            {failed === null || failed.length === 0 ? (
              <p className="px-4 py-3 text-xs text-faint">
                {failed === null ? "—" : "None — all clear."}
              </p>
            ) : (
              failed.map((f, i) => (
                <div key={i} className="border-b border-linesoft px-4 py-2 last:border-b-0">
                  <div className="truncate font-mono text-xs text-bad">{f.name}</div>
                  <div className="mt-0.5 flex gap-2 font-mono text-[11px] text-faint">
                    <span className="truncate">{f.stateMachine}</span>
                    <span className="ml-auto flex-none">{timeAgo(f.stopDate || f.startDate)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

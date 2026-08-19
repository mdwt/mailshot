import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SequenceTimeSeries } from "../../bindings/desktop/dataservice";
import type * as models from "../../bindings/desktop";
import type { SequenceDefinition } from "@/types/mailshot";
import { collectFunnelSteps, pct } from "@/lib/aws";

const SERIES = [
  { key: "delivery", color: "#6b7885" },
  { key: "open", color: "#4cc38a" },
  { key: "click", color: "#f2a33c" },
  { key: "bounce", color: "#e5484d" },
] as const;

export function AnalyticsPanel({
  awsCtx,
  def,
  templateStats,
}: {
  awsCtx: models.AwsCtx | null;
  def: SequenceDefinition;
  templateStats: models.TemplateStat[];
}) {
  const [series, setSeries] = useState<models.DayCounts[] | null>(null);
  const [seriesError, setSeriesError] = useState("");

  useEffect(() => {
    if (!awsCtx) return;
    SequenceTimeSeries(awsCtx, def.id, 30)
      .then((rows) => setSeries(rows ?? []))
      .catch((e) => setSeriesError(String(e)));
  }, [awsCtx, def.id]);

  const byKey = useMemo(() => {
    const m: Record<string, models.TemplateStat> = {};
    for (const s of templateStats) m[s.templateKey] = s;
    return m;
  }, [templateStats]);

  const funnel = useMemo(() => collectFunnelSteps(def), [def]);
  const funnelRows = funnel.map((step) => {
    const agg = { delivery: 0, open: 0, click: 0 };
    for (const key of step.templateKeys) {
      const c = byKey[key]?.counters;
      if (c) {
        agg.delivery += c.delivery;
        agg.open += c.open;
        agg.click += c.click;
      }
    }
    return { ...step, ...agg };
  });
  const maxDelivery = Math.max(1, ...funnelRows.map((r) => r.delivery));

  const abSteps = funnel.filter((f) => f.templateKeys.length > 1);
  const truncated = templateStats.some((s) => s.truncated);

  if (!awsCtx) {
    return (
      <p className="p-6 text-sm text-faint">
        Configure .env (AWS profile, table names) to see engagement analytics.
      </p>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-6">
      {truncated && (
        <div className="mb-4 max-w-2xl rounded-md border border-warn/40 bg-warnsoft px-3 py-2 text-xs text-warn">
          Some template stats hit the query page cap — counts below may be under-reported.
        </div>
      )}

      {/* Step funnel */}
      <div className="text-[11px] font-medium text-faint">Step funnel · last 90 days</div>
      <div className="mt-2 max-w-3xl space-y-2">
        {funnelRows.length === 0 && <p className="text-sm text-faint">No send steps.</p>}
        {funnelRows.map((row, i) => (
          <div key={i} className="rounded-lg border border-linesoft bg-surface2 px-4 py-2.5">
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-medium text-ink">{row.label}</span>
              <span className="ml-auto text-[11px] tabular-nums text-faint">
                {row.delivery.toLocaleString()} delivered ·{" "}
                <span className="text-good">{pct(row.open, row.delivery)} open</span> ·{" "}
                {pct(row.click, row.delivery)} click
              </span>
            </div>
            <div className="mt-1.5 flex h-1.5 gap-px overflow-hidden rounded-full bg-ground">
              <div
                className="bg-faint"
                style={{ width: `${(row.delivery / maxDelivery) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex h-1.5 gap-px overflow-hidden rounded-full bg-ground">
              <div className="bg-good" style={{ width: `${(row.open / maxDelivery) * 100}%` }} />
              <div className="bg-accent" style={{ width: `${(row.click / maxDelivery) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* A/B variant comparison */}
      {abSteps.length > 0 && (
        <>
          <div className="mt-7 text-[11px] font-medium text-faint">A/B variants</div>
          {abSteps.map((step) => {
            const rows = step.templateKeys.map((k) => ({ key: k, c: byKey[k]?.counters }));
            const leader = rows.reduce(
              (best, r, i) =>
                r.c && r.c.delivery > 0 && r.c.open / r.c.delivery > best.rate
                  ? { i, rate: r.c.open / r.c.delivery }
                  : best,
              { i: -1, rate: 0 },
            );
            return (
              <div
                key={step.label}
                className="mt-2 max-w-3xl overflow-x-auto rounded-lg border border-linesoft"
              >
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-linesoft text-[10px] font-medium text-faint">
                      <th className="px-4 py-2">variant</th>
                      <th className="px-4 py-2 text-right">delivered</th>
                      <th className="px-4 py-2 text-right">open</th>
                      <th className="px-4 py-2 text-right">click</th>
                      <th className="px-4 py-2 text-right">bounce</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {rows.map((r, i) => (
                      <tr
                        key={r.key}
                        className={`border-b border-linesoft last:border-b-0 ${leader.i === i ? "bg-goodsoft" : ""}`}
                      >
                        <td className="px-4 py-2">
                          <span className="font-mono">{r.key.split("/").pop()}</span>
                          {leader.i === i && <span className="ml-2 text-good">▲ leading</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {r.c?.delivery.toLocaleString() ?? "—"}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${leader.i === i ? "font-semibold text-good" : ""}`}
                        >
                          {r.c ? pct(r.c.open, r.c.delivery) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {r.c ? pct(r.c.click, r.c.delivery) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">{r.c?.bounce ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}

      {/* Time series */}
      <div className="mt-7 text-[11px] font-medium text-faint">Events per day · last 30 days</div>
      <div className="mt-2 h-56 max-w-3xl rounded-lg border border-linesoft bg-surface2 p-3">
        {seriesError ? (
          <p className="text-xs text-bad">{seriesError}</p>
        ) : series === null ? (
          <p className="text-xs text-faint">Loading…</p>
        ) : series.length === 0 ? (
          <p className="text-xs text-faint">No events recorded in the last 30 days.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#222a33" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7885", fontSize: 10, fontFamily: "monospace" }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={{ stroke: "#28313b" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7885", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#1d242c",
                  border: "1px solid #28313b",
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
                labelStyle={{ color: "#9aa6b2" }}
              />
              {SERIES.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.12}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-2 flex gap-4 text-[10.5px] text-faint">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-sm" style={{ background: s.color }} />
            {s.key}
          </span>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ListBroadcasts } from "../../wailsjs/go/main/DataService";
import type { main } from "../../wailsjs/go/models";
import { pct, timeAgo } from "@/lib/aws";

export function BroadcastsView({ awsCtx }: { awsCtx: main.AwsCtx | null }) {
  const [rows, setRows] = useState<main.BroadcastRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!awsCtx) return;
    ListBroadcasts(awsCtx, 50)
      .then((r) => setRows(r ?? []))
      .catch((e) => setError(String(e)));
  }, [awsCtx]);

  if (!awsCtx) {
    return (
      <p className="p-6 text-sm text-faint">
        Configure .env (AWS profile, table names) to see broadcasts.
      </p>
    );
  }

  return (
    <div className="overflow-y-auto p-6">
      <h2 className="text-lg font-semibold">Broadcasts</h2>
      <p className="mt-1 text-xs text-faint">
        One-off sends with live engagement counters. audience = subscribers resolved at send time,
        not a delivery count. Sending new broadcasts comes in a later phase — use /send-broadcast in
        Claude Code for now.
      </p>

      {error && (
        <div className="mt-3 max-w-3xl rounded-md border border-bad/40 bg-badsoft px-3 py-2 text-xs text-bad">
          {error}
        </div>
      )}

      <div className="mt-4 max-w-5xl overflow-x-auto rounded-lg border border-linesoft">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-linesoft font-mono text-[10px] uppercase tracking-wide text-faint">
              <th className="px-4 py-2">broadcast</th>
              <th className="px-4 py-2">subject</th>
              <th className="px-4 py-2 text-right">audience</th>
              <th className="px-4 py-2 text-right">delivered</th>
              <th className="px-4 py-2 text-right">open</th>
              <th className="px-4 py-2 text-right">click</th>
              <th className="px-4 py-2 text-right">bounce</th>
              <th className="px-4 py-2 text-right">sent</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs tabular-nums">
            {rows === null ? (
              <tr>
                <td colSpan={8} className="px-4 py-3 text-faint">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-3 text-faint">
                  No broadcasts sent yet.
                </td>
              </tr>
            ) : (
              rows.map((b) => (
                <tr
                  key={b.broadcastId + b.sentAt}
                  className="border-b border-linesoft last:border-b-0"
                >
                  <td className="max-w-44 truncate px-4 py-2 text-ink">{b.broadcastId}</td>
                  <td className="max-w-56 truncate px-4 py-2 text-muted">{b.subject}</td>
                  <td className="px-4 py-2 text-right">{b.audienceSize.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{b.counters.delivery.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-good">
                    {pct(b.counters.open, b.counters.delivery)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {pct(b.counters.click, b.counters.delivery)}
                  </td>
                  <td className={`px-4 py-2 text-right ${b.counters.bounce ? "text-bad" : ""}`}>
                    {b.counters.bounce}
                  </td>
                  <td className="px-4 py-2 text-right text-faint">{timeAgo(b.sentAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

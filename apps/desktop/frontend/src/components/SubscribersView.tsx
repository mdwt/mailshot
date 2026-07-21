import { useState } from "react";
import {
  GetSubscriber,
  SubscriberEvents,
  SubscribersByTag,
} from "../../wailsjs/go/main/DataService";
import type { main } from "../../wailsjs/go/models";
import { timeAgo } from "@/lib/aws";

// Mirrors extractAttributes() in handlers/lib/dynamo-client: these system
// columns are fixed, everything else on PROFILE is a custom attribute.
const SYSTEM_COLUMNS = new Set([
  "PK",
  "SK",
  "email",
  "firstName",
  "unsubscribed",
  "suppressed",
  "createdAt",
  "updatedAt",
]);

const EVENT_COLOR: Record<string, string> = {
  open: "text-good",
  click: "text-accent",
  delivery: "text-muted",
  bounce: "text-bad",
  complaint: "text-bad",
  reply: "text-ink",
};

export function SubscribersView({ awsCtx }: { awsCtx: main.AwsCtx | null }) {
  const [email, setEmail] = useState("");
  const [tag, setTag] = useState("");
  const [detail, setDetail] = useState<main.SubscriberDetail | null>(null);
  const [events, setEvents] = useState<main.EventRow[]>([]);
  const [tagRows, setTagRows] = useState<main.TagRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lookup = async (target: string) => {
    if (!awsCtx || !target.trim()) return;
    setBusy(true);
    setError("");
    setTagRows(null);
    setEmail(target);
    try {
      const [d, ev] = await Promise.all([
        GetSubscriber(awsCtx, target.trim()),
        SubscriberEvents(awsCtx, target.trim(), 50).catch(() => []),
      ]);
      setDetail(d);
      setEvents(ev ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const browseTag = async () => {
    if (!awsCtx || !tag.trim()) return;
    setBusy(true);
    setError("");
    setDetail(null);
    try {
      setTagRows((await SubscribersByTag(awsCtx, tag.trim(), 200)) ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!awsCtx) {
    return (
      <p className="p-6 text-sm text-faint">
        Configure .env (AWS profile, table names) to look up subscribers.
      </p>
    );
  }

  const profile: Record<string, unknown> = detail?.profileJson
    ? JSON.parse(detail.profileJson)
    : {};
  const attributes = Object.entries(profile).filter(([k]) => !SYSTEM_COLUMNS.has(k));

  return (
    <div className="overflow-y-auto p-6">
      <h2 className="text-lg font-semibold">Subscribers</h2>
      <p className="mt-1 text-xs text-faint">
        Lookup is by exact email or tag — the table has no full listing by design (no scans).
      </p>

      <div className="mt-4 flex max-w-3xl flex-wrap gap-2">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            lookup(email);
          }}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="subscriber@example.com"
            spellCheck={false}
            className="min-w-52 flex-1 rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-[13px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-[#14100a] hover:opacity-90 disabled:opacity-50"
          >
            Look up
          </button>
        </form>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            browseTag();
          }}
        >
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="tag"
            spellCheck={false}
            className="w-36 rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-[13px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-line px-4 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-50"
          >
            Browse tag
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-3 max-w-3xl rounded-md border border-bad/40 bg-badsoft px-3 py-2 text-xs text-bad">
          {error}
        </div>
      )}

      {tagRows !== null && (
        <div className="mt-4 max-w-3xl overflow-hidden rounded-lg border border-linesoft">
          {tagRows.length === 0 ? (
            <p className="px-4 py-3 text-xs text-faint">No subscribers with this tag.</p>
          ) : (
            tagRows.map((r) => (
              <button
                key={r.email}
                onClick={() => lookup(r.email)}
                className="flex w-full items-center gap-3 border-b border-linesoft px-4 py-2 text-left text-[13px] last:border-b-0 hover:bg-surface2"
              >
                <span className="font-mono">{r.email}</span>
                <span className="ml-auto font-mono text-xs text-faint">
                  tagged {timeAgo(r.taggedAt)}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {detail && !detail.found && !detail.error && (
        <p className="mt-4 text-sm text-faint">No subscriber found for that email.</p>
      )}
      {detail?.error && (
        <div className="mt-3 max-w-3xl rounded-md border border-bad/40 bg-badsoft px-3 py-2 text-xs text-bad">
          {detail.error}
        </div>
      )}

      {detail?.found && (
        <div className="mt-5 grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Profile */}
          <div className="rounded-lg border border-linesoft bg-surface2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="select-text font-mono text-sm font-semibold">
                {String(profile.email ?? "")}
              </span>
              {profile.unsubscribed === true && (
                <span className="rounded-full bg-warnsoft px-2 py-0.5 font-mono text-[10px] text-warn">
                  unsubscribed
                </span>
              )}
              {(profile.suppressed === true || detail.suppression) && (
                <span className="rounded-full bg-badsoft px-2 py-0.5 font-mono text-[10px] text-bad">
                  suppressed{detail.suppression ? ` · ${detail.suppression}` : ""}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-faint">
              {String(profile.firstName ?? "")} · created {timeAgo(String(profile.createdAt ?? ""))}
            </div>

            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              Attributes
            </div>
            {attributes.length === 0 ? (
              <p className="mt-1 text-xs text-faint">none</p>
            ) : (
              <div className="mt-1 space-y-0.5 font-mono text-xs">
                {attributes.map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <span className="text-faint">{k}</span>
                    <span className="select-text truncate text-ink">{JSON.stringify(v)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              Active sequences
            </div>
            {(detail.executions ?? []).length === 0 ? (
              <p className="mt-1 text-xs text-faint">none</p>
            ) : (
              <div className="mt-1 space-y-0.5 font-mono text-xs">
                {detail.executions.map((e) => (
                  <div key={e.sequenceId} className="flex gap-2">
                    <span className="text-ink">{e.sequenceId}</span>
                    {e.transactional && <span className="text-accent">txn</span>}
                    <span className="ml-auto text-faint">started {timeAgo(e.startedAt)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              Send log · last {Math.min(detail.sendLog?.length ?? 0, 50)}
            </div>
            <div className="mt-1 max-h-44 space-y-0.5 overflow-y-auto font-mono text-xs">
              {(detail.sendLog ?? []).map((s, i) => (
                <div key={i} className="flex gap-2">
                  <span className="truncate text-ink">{s.templateKey}</span>
                  <span className="ml-auto flex-none text-faint">{timeAgo(s.sentAt)}</span>
                </div>
              ))}
              {(detail.sendLog ?? []).length === 0 && <p className="text-faint">no sends yet</p>}
            </div>
          </div>

          {/* Engagement timeline */}
          <div className="rounded-lg border border-linesoft p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              Engagement timeline
            </div>
            <div className="mt-2 max-h-[420px] space-y-1 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-xs text-faint">No engagement events.</p>
              ) : (
                events.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 text-[12.5px]">
                    <span
                      className={`w-[70px] flex-none font-mono text-[11px] ${EVENT_COLOR[e.eventType] ?? "text-muted"}`}
                    >
                      {e.eventType}
                    </span>
                    <span className="truncate font-mono text-xs text-muted">{e.templateKey}</span>
                    <span className="ml-auto flex-none font-mono text-[11px] tabular-nums text-faint">
                      {timeAgo(e.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

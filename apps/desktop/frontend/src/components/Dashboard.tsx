import type { main } from "../../wailsjs/go/models";
import type { SequenceDefinition } from "@/types/mailshot";
import { countSteps } from "@/types/mailshot";

function parseDef(entry: main.SequenceEntry): SequenceDefinition | null {
  if (!entry.definition) return null;
  try {
    return JSON.parse(entry.definition) as SequenceDefinition;
  } catch {
    return null;
  }
}

export function Dashboard({
  project,
  sequences,
  identity,
  stack,
  onOpenSequence,
}: {
  project: main.ProjectInfo;
  sequences: main.SequenceEntry[];
  identity: main.CallerIdentity | null;
  stack: main.StackInfo | null;
  onOpenSequence: (dir: string) => void;
}) {
  const stackOk = stack && !stack.error && stack.status.endsWith("_COMPLETE");

  return (
    <div className="overflow-y-auto p-6">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <span className="font-mono text-xs text-faint select-text">{project.path}</span>
      </div>

      {project.issues?.length > 0 && (
        <div className="mt-4 space-y-2">
          {project.issues.map((issue) => (
            <div
              key={issue}
              className="rounded-md border border-warn/40 bg-warnsoft px-3 py-2 text-xs text-warn"
            >
              {issue}
            </div>
          ))}
        </div>
      )}

      {/* AWS strip */}
      <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-linesoft bg-surface2 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            AWS identity
          </div>
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
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            Stack · {project.env.STACK_NAME || "—"}
          </div>
          {stack === null ? (
            <div className="mt-1 text-sm text-faint">checking…</div>
          ) : stack.error ? (
            <div className="mt-1 text-xs text-bad">{stack.error}</div>
          ) : (
            <>
              <div className={`mt-1 font-mono text-sm ${stackOk ? "text-good" : "text-warn"}`}>
                {stack.status}
              </div>
              <div className="text-xs text-faint">
                {stack.lastUpdated && `updated ${new Date(stack.lastUpdated).toLocaleString()}`}
              </div>
            </>
          )}
        </div>

        <div className="rounded-lg border border-linesoft bg-surface2 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Project</div>
          <div className="mt-1 font-mono text-sm tabular-nums">
            {sequences.length} sequence{sequences.length === 1 ? "" : "s"}
          </div>
          <div className="text-xs text-faint">
            {project.hasEnv ? `bus ${project.env.EVENT_BUS_NAME || "?"}` : "no .env"}
          </div>
        </div>
      </div>

      {/* Sequence cards */}
      <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.13em] text-faint">
        Sequences · {sequences.length} local
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sequences.map((entry) => {
          const def = parseDef(entry);
          return (
            <button
              key={entry.dir}
              onClick={() => onOpenSequence(entry.dir)}
              className="rounded-lg border border-line bg-surface p-4 text-left hover:border-accent/60"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{def?.id ?? entry.dir}</span>
                {def?.transactional && (
                  <span className="rounded-full bg-accentsoft px-2 py-0.5 font-mono text-[10px] text-accent">
                    transactional
                  </span>
                )}
                {entry.error && (
                  <span className="rounded-full bg-badsoft px-2 py-0.5 font-mono text-[10px] text-bad">
                    config error
                  </span>
                )}
              </div>
              {def ? (
                <div className="mt-1.5 font-mono text-xs text-faint">
                  {countSteps(def.steps)} steps · trigger {def.trigger.detailType}
                </div>
              ) : (
                <div className="mt-1.5 truncate text-xs text-bad">{entry.error}</div>
              )}
              {def && (
                <div className="mt-2 truncate text-xs text-muted">
                  {def.sender.fromName} &lt;{def.sender.fromEmail}&gt;
                </div>
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
    </div>
  );
}

import { useMemo, useState } from "react";
import type { main } from "../../wailsjs/go/models";
import type { SequenceDefinition } from "@/types/mailshot";
import { countSteps } from "@/types/mailshot";
import { FlowCanvas } from "@/components/FlowCanvas";
import { TemplatesPanel } from "@/components/TemplatesPanel";

export function SequenceView({
  projectPath,
  entry,
  refreshKey,
}: {
  projectPath: string;
  entry: main.SequenceEntry;
  refreshKey: number;
}) {
  const [tab, setTab] = useState<"flow" | "templates">("flow");

  const def = useMemo<SequenceDefinition | null>(() => {
    if (!entry.definition) return null;
    try {
      return JSON.parse(entry.definition) as SequenceDefinition;
    } catch {
      return null;
    }
  }, [entry.definition]);

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
        </span>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex flex-none gap-0.5 border-b border-line px-6">
        {(
          [
            ["flow", "Flow"],
            ["templates", "Templates"],
          ] as const
        ).map(([key, label]) => (
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
        {tab === "flow" ? (
          <FlowCanvas key={entry.dir + refreshKey} def={def} />
        ) : (
          <TemplatesPanel
            projectPath={projectPath}
            seqDir={entry.dir}
            seqId={def.id}
            def={def}
            refreshKey={refreshKey}
          />
        )}
      </div>
    </div>
  );
}

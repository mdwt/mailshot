import { useCallback, useEffect, useState } from "react";
import "@/index.css";
import { EventsOn } from "../wailsjs/runtime/runtime";
import { RefreshProject } from "../wailsjs/go/main/ProjectService";
import { ListSequences } from "../wailsjs/go/main/SequenceService";
import { StackStatus, Whoami } from "../wailsjs/go/main/AwsService";
import type { main } from "../wailsjs/go/models";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Dashboard } from "@/components/Dashboard";
import { SequenceView } from "@/components/SequenceView";
import { SubscribersView } from "@/components/SubscribersView";
import { BroadcastsView } from "@/components/BroadcastsView";
import { awsCtxFor } from "@/lib/aws";

type View =
  | { kind: "dashboard" }
  | { kind: "sequence"; dir: string }
  | { kind: "subscribers" }
  | { kind: "broadcasts" };

function App() {
  const [project, setProject] = useState<main.ProjectInfo | null>(null);
  const [sequences, setSequences] = useState<main.SequenceEntry[]>([]);
  const [identity, setIdentity] = useState<main.CallerIdentity | null>(null);
  const [stack, setStack] = useState<main.StackInfo | null>(null);
  const [view, setView] = useState<View>({ kind: "dashboard" });
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSequences = useCallback((path: string) => {
    ListSequences(path)
      .then((list) => setSequences(list ?? []))
      .catch(() => setSequences([]));
  }, []);

  const loadAws = useCallback((p: main.ProjectInfo) => {
    if (!p.hasEnv) {
      setIdentity(null);
      setStack(null);
      return;
    }
    const profile = p.env.AWS_PROFILE ?? "";
    const region = p.env.REGION ?? "";
    Whoami(profile, region).then(setIdentity);
    StackStatus(profile, region, p.env.STACK_NAME ?? "").then(setStack);
  }, []);

  const openProject = useCallback(
    (p: main.ProjectInfo) => {
      setProject(p);
      setView({ kind: "dashboard" });
      setIdentity(null);
      setStack(null);
      loadSequences(p.path);
      loadAws(p);
    },
    [loadSequences, loadAws],
  );

  // File watcher: re-read the project + sequences whenever Claude Code or an
  // editor touches the project. AWS state is left alone (poll-on-demand).
  useEffect(() => {
    if (!project) return;
    const off = EventsOn("project:changed", () => {
      RefreshProject(project.path)
        .then((p) => {
          setProject(p);
          loadSequences(p.path);
          setRefreshKey((k) => k + 1);
        })
        .catch(() => undefined);
    });
    return off;
  }, [project?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) {
    return <ProjectPicker onOpen={openProject} />;
  }

  const awsCtx = awsCtxFor(project);
  const currentEntry =
    view.kind === "sequence" ? sequences.find((s) => s.dir === view.dir) : undefined;
  const navBtn = (active: boolean) =>
    `rounded-md px-2.5 py-1.5 text-left text-[13px] ${
      active ? "bg-accentsoft text-ink" : "text-muted hover:text-ink"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[196px_1fr]">
        {/* Sidebar */}
        <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-line bg-surface2 px-2.5 py-3">
          <div className="px-2.5 pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            {project.name}
          </div>
          <button
            onClick={() => setView({ kind: "dashboard" })}
            className={navBtn(view.kind === "dashboard")}
          >
            Dashboard
          </button>
          <button
            onClick={() => setView({ kind: "broadcasts" })}
            className={navBtn(view.kind === "broadcasts")}
          >
            Broadcasts
          </button>
          <button
            onClick={() => setView({ kind: "subscribers" })}
            className={navBtn(view.kind === "subscribers")}
          >
            Subscribers
          </button>
          <div className="mt-3 px-2.5 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            Sequences · {sequences.length}
          </div>
          {sequences.map((s) => (
            <button
              key={s.dir}
              onClick={() => setView({ kind: "sequence", dir: s.dir })}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-mono text-[12.5px] ${
                view.kind === "sequence" && view.dir === s.dir
                  ? "bg-accentsoft text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span className="truncate">{s.id || s.dir}</span>
              {s.error && <span className="ml-auto text-[10px] text-bad">✗</span>}
            </button>
          ))}
          <button
            onClick={() => {
              setProject(null);
              setSequences([]);
            }}
            className="mt-auto rounded-md px-2.5 py-1.5 text-left text-xs text-faint hover:text-ink"
          >
            ← Switch project
          </button>
        </aside>

        {/* Main pane */}
        <main className="min-h-0 min-w-0 overflow-hidden">
          {view.kind === "dashboard" ? (
            <Dashboard
              project={project}
              sequences={sequences}
              identity={identity}
              stack={stack}
              awsCtx={awsCtx}
              onOpenSequence={(dir) => setView({ kind: "sequence", dir })}
            />
          ) : view.kind === "subscribers" ? (
            <SubscribersView awsCtx={awsCtx} />
          ) : view.kind === "broadcasts" ? (
            <BroadcastsView awsCtx={awsCtx} />
          ) : currentEntry ? (
            <SequenceView
              projectPath={project.path}
              entry={currentEntry}
              awsCtx={awsCtx}
              refreshKey={refreshKey}
            />
          ) : (
            <div className="p-6 text-sm text-faint">Sequence not found.</div>
          )}
        </main>
      </div>

      {/* Status bar */}
      <footer className="flex flex-none items-center gap-3 border-t border-line bg-surface2 px-4 py-1.5 font-mono text-[11px] text-faint">
        <span className="truncate">{project.path}</span>
        <span className="ml-auto flex flex-none items-center gap-3">
          {identity && !identity.error && (
            <>
              <span>{identity.profile || "default"}</span>
              <span className="tabular-nums">{identity.account}</span>
              <span>{identity.region}</span>
            </>
          )}
          {identity?.error && <span className="text-bad">aws: not connected</span>}
          {stack && !stack.error && (
            <span className={stack.status.endsWith("_COMPLETE") ? "text-good" : "text-warn"}>
              {stack.status}
            </span>
          )}
        </span>
      </footer>
    </div>
  );
}

export default App;

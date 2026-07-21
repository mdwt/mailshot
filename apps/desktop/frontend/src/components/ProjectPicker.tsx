import { useEffect, useState } from "react";
import {
  OpenProject,
  PickProjectFolder,
  RecentProjects,
} from "../../wailsjs/go/main/ProjectService";
import type { main } from "../../wailsjs/go/models";

export function ProjectPicker({ onOpen }: { onOpen: (project: main.ProjectInfo) => void }) {
  const [recents, setRecents] = useState<main.RecentProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    RecentProjects().then((r) => setRecents(r ?? []));
  }, []);

  const open = async (path: string) => {
    setBusy(true);
    setError("");
    try {
      onOpen(await OpenProject(path));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const browse = async () => {
    setError("");
    const path = await PickProjectFolder();
    if (path) await open(path);
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-md px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
          mailshot desktop
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Open a project</h1>
        <p className="mt-2 text-sm text-muted">
          Point at a bootstrapped mailshot project — a folder with a{" "}
          <span className="font-mono text-xs">sequences/</span> directory, created with{" "}
          <span className="font-mono text-xs">npx create-mailshot</span>.
        </p>

        <button
          onClick={browse}
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-[#14100a] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Opening…" : "Open folder…"}
        </button>

        {error && (
          <div className="mt-3 rounded-md border border-bad/40 bg-badsoft px-3 py-2 text-xs text-bad">
            {error}
          </div>
        )}

        {recents.length > 0 && (
          <>
            <div className="mt-7 font-mono text-[10.5px] uppercase tracking-[0.13em] text-faint">
              Recent
            </div>
            <div className="mt-2 space-y-1.5">
              {recents.map((r) => (
                <button
                  key={r.path}
                  onClick={() => open(r.path)}
                  disabled={busy}
                  className="flex w-full items-baseline gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-left hover:border-accent/60 disabled:opacity-50"
                >
                  <span className="font-mono text-sm font-semibold">{r.name}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-faint">{r.path}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

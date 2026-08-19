import { useEffect, useState } from "react";
import {
  OpenProject,
  PickProjectFolder,
  RecentProjects,
} from "../../bindings/desktop/projectservice";
import type * as models from "../../bindings/desktop";

export function ProjectPicker({ onOpen }: { onOpen: (project: models.ProjectInfo) => void }) {
  const [recents, setRecents] = useState<models.RecentProject[]>([]);
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
        <p className="text-[13px] font-semibold text-accent">Mailshot Desktop</p>
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
            <div className="mt-7 text-[11px] font-medium text-faint">Recent</div>
            <div className="mt-2 space-y-1.5">
              {recents.map((r) => (
                <button
                  key={r.path}
                  onClick={() => open(r.path)}
                  disabled={busy}
                  className="flex w-full items-baseline gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-left hover:border-accent/60 disabled:opacity-50"
                >
                  <span className="text-sm font-semibold">{r.name}</span>
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

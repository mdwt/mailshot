import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ListTemplates,
  OpenInSystemEditor,
  ReadFileInProject,
  RenderPreview,
  RunRender,
  WriteFileInProject,
} from "../../bindings/desktop/templateservice";
import type * as models from "../../bindings/desktop";
import type { SequenceDefinition } from "@/types/mailshot";
import { SourceEditor } from "@/components/SourceEditor";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  rendered: { label: "✓", cls: "text-good" },
  stale: { label: "⚠ stale", cls: "text-warn" },
  missing: { label: "✗ no build", cls: "text-bad" },
  orphan: { label: "built only", cls: "text-faint" },
};

function defaultSampleData(def: SequenceDefinition | null): string {
  return JSON.stringify(
    {
      firstName: "Sam",
      email: "sam@example.com",
      ...(def?.trigger.subscriberMapping.attributes ? { platform: "shopify" } : {}),
    },
    null,
    2,
  );
}

export function TemplatesPanel({
  projectPath,
  seqDir,
  seqId,
  def,
  refreshKey,
}: {
  projectPath: string;
  seqDir: string;
  seqId: string;
  def: SequenceDefinition | null;
  refreshKey: number;
}) {
  const [templates, setTemplates] = useState<models.TemplateEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"preview" | "source">("preview");
  const [width, setWidth] = useState<375 | 640>(640);
  const [sampleData, setSampleData] = useState(() => defaultSampleData(def));
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [savedSource, setSavedSource] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [rendering, setRendering] = useState(false);
  const [renderOutput, setRenderOutput] = useState<models.RenderResult | null>(null);

  const dirty = source !== savedSource;

  useEffect(() => {
    ListTemplates(projectPath, seqDir, seqId)
      .then((list) => {
        setTemplates(list ?? []);
        setSelected((cur) => cur ?? list?.[0]?.name ?? null);
      })
      .catch((e) => setError(String(e)));
  }, [projectPath, seqDir, seqId, refreshKey]);

  const template = useMemo(
    () => templates.find((t) => t.name === selected) ?? null,
    [templates, selected],
  );

  const renderPreview = useCallback(() => {
    if (!template) return;
    setError("");
    if (!template.builtPath) {
      setPreviewHtml("");
      return;
    }
    RenderPreview(projectPath, template.builtPath, sampleData)
      .then(setPreviewHtml)
      .catch((e) => {
        setPreviewHtml("");
        setError(String(e));
      });
  }, [projectPath, template, sampleData]);

  useEffect(() => {
    renderPreview();
  }, [template, refreshKey]);

  // Load source when the selected template changes. Deliberately NOT keyed on
  // refreshKey — an external file change must not clobber unsaved edits.
  const sourcePath = template ? template.sourcePath || template.builtPath : "";
  useEffect(() => {
    if (!sourcePath) {
      setSource("");
      setSavedSource("");
      return;
    }
    ReadFileInProject(projectPath, sourcePath)
      .then((s) => {
        setSource(s);
        setSavedSource(s);
      })
      .catch((e) => {
        setSource(`// failed to read: ${e}`);
        setSavedSource(`// failed to read: ${e}`);
      });
  }, [projectPath, sourcePath]);

  const runRender = useCallback(async () => {
    setRendering(true);
    setRenderOutput(null);
    try {
      const res = await RunRender(projectPath, seqId);
      setRenderOutput(res);
      // The build/ watcher refreshes list + preview; do it directly too so the
      // loop works even if the watcher misses.
      const list = await ListTemplates(projectPath, seqDir, seqId);
      setTemplates(list ?? []);
    } finally {
      setRendering(false);
    }
  }, [projectPath, seqDir, seqId]);

  const saveAndRender = useCallback(async () => {
    if (!template?.sourcePath || !dirty) return;
    setError("");
    try {
      await WriteFileInProject(projectPath, template.sourcePath, source);
      setSavedSource(source);
      await runRender();
    } catch (e) {
      setError(String(e));
    }
  }, [projectPath, template, source, dirty, runRender]);

  const editable = view === "source" && !!template?.sourcePath;

  const usedBy = useMemo(() => {
    if (!def || !template) return "";
    const key = template.templateKey;
    const hits: string[] = [];
    const walk = (steps: SequenceDefinition["steps"], path: string) => {
      steps.forEach((s, i) => {
        const at = `${path}${i + 1}`;
        if (s.type === "send") {
          if (s.templateKey === key) hits.push(`step ${at}`);
          s.variants?.forEach((v, vi) => {
            if (v.templateKey === key)
              hits.push(`step ${at} · variant ${String.fromCharCode(65 + vi)}`);
          });
        } else if (s.type === "condition") {
          walk(s.then, `${at}.then.`);
          walk(s.else ?? [], `${at}.else.`);
        } else if (s.type === "choice") {
          s.branches.forEach((b) => walk(b.steps, `${at}[${b.value}].`));
          walk(s.default ?? [], `${at}[default].`);
        }
      });
    };
    walk(def.steps, "");
    def.events?.forEach((e) => {
      if (e.templateKey === key) hits.push(`event ${e.detailType}`);
    });
    return hits.join(", ");
  }, [def, template]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_1fr_240px]">
      {/* Template list */}
      <div className="overflow-y-auto border-r border-line bg-surface2 p-2">
        {templates.length === 0 && (
          <p className="p-3 text-xs text-faint">
            No templates found in src/emails/ or build/{seqId}/templates/.
          </p>
        )}
        {templates.map((t) => {
          const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.orphan;
          return (
            <button
              key={t.name}
              onClick={() => setSelected(t.name)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-mono text-xs ${
                t.name === selected ? "bg-accentsoft text-ink" : "text-muted hover:text-ink"
              }`}
            >
              <span className="truncate">{t.name}</span>
              <span className={`ml-auto text-[11px] ${st.cls}`}>{st.label}</span>
            </button>
          );
        })}
      </div>

      {/* Preview / source */}
      <div className="flex min-h-0 flex-col overflow-hidden p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-md border border-line text-xs">
            {(["preview", "source"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 ${view === v ? "bg-surface2 font-semibold text-ink" : "text-muted"}`}
              >
                {v === "preview" ? "Preview" : `Source${dirty ? " ●" : ""}`}
              </button>
            ))}
          </div>
          {view === "preview" && (
            <div className="flex gap-1 text-[11px] tabular-nums text-faint">
              {([375, 640] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setWidth(w)}
                  className={`rounded px-2 py-0.5 ${width === w ? "bg-surface2 text-ink" : ""}`}
                >
                  {w}
                </button>
              ))}
            </div>
          )}
          {editable && (
            <>
              <button
                onClick={saveAndRender}
                disabled={!dirty || rendering}
                className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-[#14100a] hover:opacity-90 disabled:opacity-40"
                title="Ctrl+S"
              >
                {rendering ? "Rendering…" : "Save + render"}
              </button>
              <button
                onClick={() =>
                  template?.sourcePath &&
                  OpenInSystemEditor(projectPath, template.sourcePath).catch((e) =>
                    setError(String(e)),
                  )
                }
                className="rounded-md border border-line px-3 py-1 text-xs text-muted hover:text-ink"
              >
                Open in editor
              </button>
            </>
          )}
          <button
            onClick={runRender}
            disabled={rendering}
            className="rounded-md border border-line px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-40"
          >
            {rendering ? "Rendering…" : "Render all"}
          </button>
          {template && usedBy && (
            <span className="ml-auto truncate text-[11px] text-faint">used by {usedBy}</span>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-bad/40 bg-badsoft px-3 py-2 text-xs text-bad">
            {error}
          </div>
        )}
        {renderOutput && (
          <div
            className={`mb-3 max-h-32 overflow-auto rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap ${
              renderOutput.ok
                ? "border-linesoft bg-surface2 text-muted"
                : "border-bad/40 bg-badsoft text-bad"
            }`}
          >
            {renderOutput.ok ? "render ✓\n" : "render failed\n"}
            {renderOutput.output.trim()}
          </div>
        )}

        {view === "preview" ? (
          template?.builtPath && previewHtml ? (
            <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded-lg border border-line bg-surface2 p-5">
              <iframe
                sandbox=""
                title="template preview"
                srcDoc={previewHtml}
                style={{ width }}
                className="h-full min-h-[400px] shrink-0 rounded-md border-0 bg-white shadow-lg"
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line text-sm text-faint">
              {template
                ? `Not rendered yet — run: pnpm --filter ${seqId} render`
                : "Select a template"}
            </div>
          )
        ) : template?.sourcePath || template?.builtPath ? (
          <SourceEditor
            path={sourcePath}
            value={source}
            onChange={setSource}
            onSave={saveAndRender}
            readOnly={!template?.sourcePath}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line text-sm text-faint">
            No source file.
          </div>
        )}
      </div>

      {/* Sample data */}
      <div className="flex flex-col gap-2 overflow-y-auto border-l border-line bg-surface2 p-3">
        <h4 className="text-[11px] font-medium text-faint">Sample data (Liquid variables)</h4>
        <textarea
          value={sampleData}
          onChange={(e) => setSampleData(e.target.value)}
          spellCheck={false}
          className="min-h-[180px] flex-none resize-y rounded-md border border-line bg-surface p-2.5 font-mono text-[11.5px] leading-relaxed text-ink outline-none focus:border-accent"
        />
        <button
          onClick={renderPreview}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-[#14100a] hover:opacity-90"
        >
          Apply to preview
        </button>
        <p className="text-[11px] leading-relaxed text-faint">
          unsubscribeUrl gets a placeholder automatically. The preview renders the built HTML —
          byte-for-byte what deploys to S3. Save + render runs this sequence's own render script.
        </p>
      </div>
    </div>
  );
}

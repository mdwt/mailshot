import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";

/**
 * Framework-agnostic source editor: TSX/JSX/TS/JS/HTML/MJML all get syntax
 * support from their extension alone — the app never assumes a template
 * framework (BYO-template).
 */
export function SourceEditor({
  path,
  value,
  onChange,
  onSave,
  readOnly = false,
}: {
  path: string;
  value: string;
  onChange: (v: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
}) {
  const extensions = useMemo(() => {
    const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
    if (ext === "tsx" || ext === "jsx") return [javascript({ jsx: true, typescript: true })];
    if (ext === "ts" || ext === "js") return [javascript({ typescript: ext === "ts" })];
    return [html()];
  }, [path]);

  return (
    <div
      className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line [&_.cm-editor]:h-full [&_.cm-editor]:text-[12.5px]"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          onSave?.();
        }
      }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={oneDark}
        readOnly={readOnly}
        height="100%"
        style={{ height: "100%" }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          autocompletion: false,
        }}
      />
    </div>
  );
}

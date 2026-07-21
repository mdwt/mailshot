package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestListTemplatesAndPreview(t *testing.T) {
	projectDir := t.TempDir()
	srcDir := filepath.Join(projectDir, "sequences", "onboarding", "src", "emails")
	builtDir := filepath.Join(projectDir, "build", "onboarding", "templates")
	for _, d := range []string{srcDir, builtDir} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			t.Fatal(err)
		}
	}

	// welcome: source + fresh build → rendered
	writeFile(t, filepath.Join(srcDir, "welcome.tsx"), "export default null")
	writeFile(t, filepath.Join(builtDir, "welcome.html"),
		`<h1>Hey {{ firstName }}</h1><a href="{{ unsubscribeUrl }}">bye</a>`)
	// day-3: source newer than build → stale
	writeFile(t, filepath.Join(builtDir, "day-3.html"), "<p>old</p>")
	old := time.Now().Add(-time.Hour)
	if err := os.Chtimes(filepath.Join(builtDir, "day-3.html"), old, old); err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(srcDir, "day-3.tsx"), "export default null")
	// draft: source only → missing
	writeFile(t, filepath.Join(srcDir, "draft.tsx"), "export default null")

	svc := NewTemplateService()
	list, err := svc.ListTemplates(projectDir, "onboarding", "onboarding")
	if err != nil {
		t.Fatal(err)
	}
	statuses := map[string]string{}
	for _, e := range list {
		statuses[e.Name] = e.Status
	}
	want := map[string]string{"welcome": "rendered", "day-3": "stale", "draft": "missing"}
	for name, status := range want {
		if statuses[name] != status {
			t.Errorf("%s status = %q, want %q", name, statuses[name], status)
		}
	}

	out, err := svc.RenderPreview(projectDir, filepath.Join(builtDir, "welcome.html"),
		`{"firstName":"Nadia"}`)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "Hey Nadia") || !strings.Contains(out, "unsubscribe?preview=1") {
		t.Errorf("preview did not render Liquid variables: %s", out)
	}

	// Path traversal must be rejected.
	if _, err := svc.ReadFileInProject(projectDir, filepath.Join(projectDir, "..", "outside.txt")); err == nil {
		t.Error("expected error for path outside project")
	}
}

func writeFile(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatal(err)
	}
}

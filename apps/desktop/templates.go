package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"sort"
	"strings"
	"time"

	"github.com/osteele/liquid"
)

// TemplateEntry pairs a template source file (src/emails/*) with its rendered
// output (build/<id>/templates/*.html), matched by basename.
type TemplateEntry struct {
	Name        string `json:"name"`        // basename without extension
	TemplateKey string `json:"templateKey"` // <sequenceId>/<name>
	SourcePath  string `json:"sourcePath"`  // "" when only a built file exists
	BuiltPath   string `json:"builtPath"`   // "" when not rendered yet
	Status      string `json:"status"`      // rendered | stale | missing | orphan
}

type TemplateService struct{}

func NewTemplateService() *TemplateService {
	return &TemplateService{}
}

var sourceExts = map[string]bool{".tsx": true, ".jsx": true, ".html": true, ".mjml": true}

// ListTemplates scans sources and build output for one sequence. seqDir is the
// folder name under sequences/; seqID is the config's id (build paths derive
// from the id, not the folder).
func (s *TemplateService) ListTemplates(projectPath, seqDir, seqID string) ([]TemplateEntry, error) {
	srcDir := filepath.Join(projectPath, "sequences", seqDir, "src", "emails")
	builtDir := filepath.Join(projectPath, "build", seqID, "templates")

	byName := map[string]*TemplateEntry{}

	if entries, err := os.ReadDir(srcDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !sourceExts[filepath.Ext(e.Name())] {
				continue
			}
			name := strings.TrimSuffix(e.Name(), filepath.Ext(e.Name()))
			byName[name] = &TemplateEntry{
				Name:        name,
				TemplateKey: seqID + "/" + name,
				SourcePath:  filepath.Join(srcDir, e.Name()),
				Status:      "missing",
			}
		}
	}

	if entries, err := os.ReadDir(builtDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || filepath.Ext(e.Name()) != ".html" {
				continue
			}
			name := strings.TrimSuffix(e.Name(), ".html")
			builtPath := filepath.Join(builtDir, e.Name())
			t, ok := byName[name]
			if !ok {
				byName[name] = &TemplateEntry{
					Name:        name,
					TemplateKey: seqID + "/" + name,
					BuiltPath:   builtPath,
					Status:      "orphan",
				}
				continue
			}
			t.BuiltPath = builtPath
			t.Status = "rendered"
			srcInfo, serr := os.Stat(t.SourcePath)
			builtInfo, berr := os.Stat(builtPath)
			if serr == nil && berr == nil && srcInfo.ModTime().After(builtInfo.ModTime()) {
				t.Status = "stale"
			}
		}
	}

	list := make([]TemplateEntry, 0, len(byName))
	for _, t := range byName {
		list = append(list, *t)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })
	return list, nil
}

// ReadFileInProject returns the contents of a file, restricted to paths inside
// the project directory.
func (s *TemplateService) ReadFileInProject(projectPath, filePath string) (string, error) {
	if err := ensureInside(projectPath, filePath); err != nil {
		return "", err
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// RenderPreview renders a built template's Liquid variables with sample data.
// dataJSON is a flat JSON object of subscriber variables; unsubscribeUrl gets
// a placeholder when absent. Rendering uses a Go Liquid engine — parity note:
// send-time rendering is LiquidJS, which agrees on standard syntax.
func (s *TemplateService) RenderPreview(projectPath, builtPath, dataJSON string) (string, error) {
	if err := ensureInside(projectPath, builtPath); err != nil {
		return "", err
	}
	data, err := os.ReadFile(builtPath)
	if err != nil {
		return "", fmt.Errorf("template not rendered yet: %w", err)
	}

	bindings := map[string]any{}
	if strings.TrimSpace(dataJSON) != "" {
		if err := json.Unmarshal([]byte(dataJSON), &bindings); err != nil {
			return "", fmt.Errorf("sample data is not valid JSON: %w", err)
		}
	}
	if _, ok := bindings["unsubscribeUrl"]; !ok {
		bindings["unsubscribeUrl"] = "https://example.invalid/unsubscribe?preview=1"
	}
	if _, ok := bindings["firstName"]; !ok {
		bindings["firstName"] = "Sam"
	}

	engine := liquid.NewEngine()
	out, err := engine.ParseAndRenderString(string(data), bindings)
	if err != nil {
		return "", fmt.Errorf("liquid render failed: %w", err)
	}
	return out, nil
}

// WriteFileInProject saves edited template/config source. Writes are
// restricted to the sequences/ subtree — the app never writes build output
// (that's the render script's job) or anything outside the project.
func (s *TemplateService) WriteFileInProject(projectPath, filePath, content string) error {
	if err := ensureInside(projectPath, filePath); err != nil {
		return err
	}
	if err := ensureInside(filepath.Join(projectPath, "sequences"), filePath); err != nil {
		return fmt.Errorf("only files under sequences/ can be edited in the app: %s", filePath)
	}
	if _, err := os.Stat(filePath); err != nil {
		return fmt.Errorf("refusing to create new file: %w", err)
	}
	return os.WriteFile(filePath, []byte(content), 0o644)
}

type RenderResult struct {
	Ok     bool   `json:"ok"`
	Output string `json:"output"`
}

// RunRender executes the sequence's own render script (`pnpm --filter <id>
// render`) in the project directory — the framework-agnostic way to turn
// whatever source format the project uses into built HTML.
func (s *TemplateService) RunRender(projectPath, seqID string) RenderResult {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if goruntime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "cmd", "/C", "pnpm", "--filter", seqID, "render")
	} else {
		cmd = exec.CommandContext(ctx, "pnpm", "--filter", seqID, "render")
	}
	cmd.Dir = projectPath
	out, err := cmd.CombinedOutput()
	res := RenderResult{Ok: err == nil, Output: string(out)}
	if err != nil && len(out) == 0 {
		res.Output = err.Error()
	}
	return res
}

// OpenInSystemEditor opens a project file in the user's editor: the `code`
// CLI when available, otherwise the OS default handler for the file type.
func (s *TemplateService) OpenInSystemEditor(projectPath, filePath string) error {
	if err := ensureInside(projectPath, filePath); err != nil {
		return err
	}
	if codePath, err := exec.LookPath("code"); err == nil {
		return exec.Command(codePath, filePath).Start()
	}
	if goruntime.GOOS == "windows" {
		return exec.Command("cmd", "/C", "start", "", filePath).Start()
	}
	if goruntime.GOOS == "darwin" {
		return exec.Command("open", filePath).Start()
	}
	return exec.Command("xdg-open", filePath).Start()
}

func ensureInside(projectPath, filePath string) error {
	absRoot, err := filepath.Abs(projectPath)
	if err != nil {
		return err
	}
	absFile, err := filepath.Abs(filePath)
	if err != nil {
		return err
	}
	rel, err := filepath.Rel(absRoot, absFile)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return fmt.Errorf("path is outside the project: %s", filePath)
	}
	return nil
}

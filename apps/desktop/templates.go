package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

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

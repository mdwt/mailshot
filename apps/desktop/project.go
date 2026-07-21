package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ProjectInfo describes an opened mailshot project. The project folder is the
// source of truth — this DTO is derived entirely from files on disk.
type ProjectInfo struct {
	Path          string            `json:"path"`
	Name          string            `json:"name"`
	HasEnv        bool              `json:"hasEnv"`
	Env           map[string]string `json:"env"`
	Issues        []string          `json:"issues"`
	SequenceCount int               `json:"sequenceCount"`
}

type RecentProject struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	LastOpened string `json:"lastOpened"`
}

type ProjectService struct {
	app *App
}

func NewProjectService(app *App) *ProjectService {
	return &ProjectService{app: app}
}

// PickProjectFolder opens the native directory picker and returns the chosen
// path ("" when cancelled).
func (s *ProjectService) PickProjectFolder() (string, error) {
	return runtime.OpenDirectoryDialog(s.app.ctx, runtime.OpenDialogOptions{
		Title: "Open mailshot project",
	})
}

// OpenProject validates the folder, loads .env, records it in the recent list
// and starts the file watcher that emits "project:changed" events.
func (s *ProjectService) OpenProject(path string) (ProjectInfo, error) {
	info, err := loadProject(path)
	if err != nil {
		return ProjectInfo{}, err
	}
	s.recordRecent(info)
	s.app.watchProject(path)
	return info, nil
}

// RefreshProject re-reads the project without touching recents or the watcher.
func (s *ProjectService) RefreshProject(path string) (ProjectInfo, error) {
	return loadProject(path)
}

func (s *ProjectService) RecentProjects() []RecentProject {
	recents := readRecents()
	// Drop entries whose folder no longer exists.
	kept := recents[:0]
	for _, r := range recents {
		if st, err := os.Stat(r.Path); err == nil && st.IsDir() {
			kept = append(kept, r)
		}
	}
	return kept
}

func loadProject(path string) (ProjectInfo, error) {
	st, err := os.Stat(path)
	if err != nil || !st.IsDir() {
		return ProjectInfo{}, fmt.Errorf("not a directory: %s", path)
	}

	seqDir := filepath.Join(path, "sequences")
	if st, err := os.Stat(seqDir); err != nil || !st.IsDir() {
		return ProjectInfo{}, fmt.Errorf("not a mailshot project: no sequences/ directory in %s", path)
	}

	info := ProjectInfo{
		Path: path,
		Name: filepath.Base(path),
		Env:  map[string]string{},
	}

	envPath := filepath.Join(path, ".env")
	if _, err := os.Stat(envPath); err == nil {
		info.HasEnv = true
		info.Env = parseEnvFile(envPath)
	} else if _, err := os.Stat(filepath.Join(path, ".env.example")); err == nil {
		info.Issues = append(info.Issues, "No .env file — copy .env.example and fill in your AWS details (or run /setup-env in Claude Code).")
	} else {
		info.Issues = append(info.Issues, "No .env file found — AWS features are disabled until one exists.")
	}

	if _, err := os.Stat(filepath.Join(path, "node_modules")); err != nil {
		info.Issues = append(info.Issues, "Dependencies not installed — run pnpm install. Config parsing may still work for simple configs.")
	}

	entries, _ := os.ReadDir(seqDir)
	for _, e := range entries {
		if e.IsDir() {
			if _, err := os.Stat(filepath.Join(seqDir, e.Name(), "sequence.config.ts")); err == nil {
				info.SequenceCount++
			}
		}
	}

	return info, nil
}

// parseEnvFile mirrors the parsing rules of the MCP server's config loader:
// skip blanks and #-comments, split on the first "=".
func parseEnvFile(path string) map[string]string {
	env := map[string]string{}
	data, err := os.ReadFile(path)
	if err != nil {
		return env
	}
	for _, line := range strings.Split(string(data), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		idx := strings.Index(trimmed, "=")
		if idx == -1 {
			continue
		}
		env[trimmed[:idx]] = trimmed[idx+1:]
	}
	return env
}

// ── Recent projects (the only app-owned state, in the OS config dir) ────────

func recentsPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "mailshot-desktop", "recent.json")
}

func readRecents() []RecentProject {
	p := recentsPath()
	if p == "" {
		return nil
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return nil
	}
	var recents []RecentProject
	if err := json.Unmarshal(data, &recents); err != nil {
		return nil
	}
	return recents
}

func (s *ProjectService) recordRecent(info ProjectInfo) {
	recents := readRecents()
	filtered := []RecentProject{{
		Path:       info.Path,
		Name:       info.Name,
		LastOpened: time.Now().UTC().Format(time.RFC3339),
	}}
	for _, r := range recents {
		if !strings.EqualFold(r.Path, info.Path) {
			filtered = append(filtered, r)
		}
	}
	sort.SliceStable(filtered[1:], func(i, j int) bool {
		return filtered[1:][i].LastOpened > filtered[1:][j].LastOpened
	})
	if len(filtered) > 10 {
		filtered = filtered[:10]
	}
	p := recentsPath()
	if p == "" {
		return
	}
	_ = os.MkdirAll(filepath.Dir(p), 0o755)
	if data, err := json.MarshalIndent(filtered, "", "  "); err == nil {
		_ = os.WriteFile(p, data, 0o644)
	}
}

// ── File watcher ────────────────────────────────────────────────────────────

// watchProject watches .env and the sequence tree, emitting a debounced
// "project:changed" event so views refresh while Claude Code or an editor
// works on the same project.
func (a *App) watchProject(projectPath string) {
	a.watchMu.Lock()
	defer a.watchMu.Unlock()

	if a.watcher != nil {
		a.watcher.Close()
		a.watcher = nil
	}

	w, err := fsnotify.NewWatcher()
	if err != nil {
		return
	}
	a.watcher = w

	addDirs(w, projectPath)

	go func() {
		var timer *time.Timer
		fire := func() {
			runtime.EventsEmit(a.ctx, "project:changed", projectPath)
		}
		for {
			select {
			case ev, ok := <-w.Events:
				if !ok {
					return
				}
				if !relevantChange(ev.Name) {
					continue
				}
				// New directories need to be watched too.
				if ev.Op.Has(fsnotify.Create) {
					if st, err := os.Stat(ev.Name); err == nil && st.IsDir() {
						addDirs(w, ev.Name)
					}
				}
				if timer != nil {
					timer.Stop()
				}
				timer = time.AfterFunc(300*time.Millisecond, fire)
			case _, ok := <-w.Errors:
				if !ok {
					return
				}
			}
		}
	}()
}

// addDirs watches root plus the sequence tree (fsnotify is not recursive).
func addDirs(w *fsnotify.Watcher, root string) {
	_ = w.Add(root)
	seqDir := filepath.Join(root, "sequences")
	if filepath.Base(root) != "sequences" {
		if st, err := os.Stat(seqDir); err != nil || !st.IsDir() {
			return
		}
	} else {
		seqDir = root
	}
	_ = filepath.WalkDir(seqDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			if d.Name() == "node_modules" || d.Name() == "dist" || strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			_ = w.Add(path)
		}
		return nil
	})
}

func relevantChange(path string) bool {
	base := filepath.Base(path)
	if base == ".env" {
		return true
	}
	if strings.Contains(filepath.ToSlash(path), "/sequences/") {
		ext := filepath.Ext(base)
		return ext == ".ts" || ext == ".tsx" || ext == ".html" || ext == ".json" || ext == ""
	}
	return false
}

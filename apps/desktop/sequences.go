package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/dop251/goja"
	"github.com/evanw/esbuild/pkg/api"
)

// SequenceEntry is one sequences/<dir>/sequence.config.ts, evaluated to JSON.
// Definition is the JSON-serialized SequenceDefinition (frontend parses it —
// the recursive step type is modeled in TypeScript, not Go). A per-sequence
// evaluation failure lands in Error so one broken config never hides the rest.
type SequenceEntry struct {
	Dir        string `json:"dir"`
	ConfigPath string `json:"configPath"`
	ID         string `json:"id"`
	Definition string `json:"definition"`
	Error      string `json:"error"`
}

type SequenceService struct{}

func NewSequenceService() *SequenceService {
	return &SequenceService{}
}

func (s *SequenceService) ListSequences(projectPath string) ([]SequenceEntry, error) {
	seqRoot := filepath.Join(projectPath, "sequences")
	dirs, err := os.ReadDir(seqRoot)
	if err != nil {
		return nil, fmt.Errorf("cannot read sequences directory: %w", err)
	}

	var entries []SequenceEntry
	for _, d := range dirs {
		if !d.IsDir() {
			continue
		}
		configPath := filepath.Join(seqRoot, d.Name(), "sequence.config.ts")
		if _, err := os.Stat(configPath); err != nil {
			continue
		}
		entry := SequenceEntry{Dir: d.Name(), ConfigPath: configPath}
		defJSON, id, err := evaluateSequenceConfig(configPath)
		if err != nil {
			entry.Error = err.Error()
		} else {
			entry.Definition = defJSON
			entry.ID = id
		}
		entries = append(entries, entry)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Dir < entries[j].Dir })
	return entries, nil
}

func (s *SequenceService) GetSequence(projectPath, dir string) (SequenceEntry, error) {
	configPath := filepath.Join(projectPath, "sequences", dir, "sequence.config.ts")
	if _, err := os.Stat(configPath); err != nil {
		return SequenceEntry{}, fmt.Errorf("no sequence.config.ts in sequences/%s", dir)
	}
	entry := SequenceEntry{Dir: dir, ConfigPath: configPath}
	defJSON, id, err := evaluateSequenceConfig(configPath)
	if err != nil {
		entry.Error = err.Error()
		return entry, nil
	}
	entry.Definition = defJSON
	entry.ID = id
	return entry, nil
}

// evaluateSequenceConfig bundles the TypeScript config with esbuild's Go API
// (type-only imports of @mailshot/shared are erased; value imports resolve
// through the project's node_modules) and evaluates the CommonJS output in
// goja. No Node round-trip — works even before pnpm install for configs with
// type-only imports.
func evaluateSequenceConfig(configPath string) (defJSON string, id string, err error) {
	result := api.Build(api.BuildOptions{
		EntryPoints: []string{configPath},
		Bundle:      true,
		Write:       false,
		Format:      api.FormatCommonJS,
		Platform:    api.PlatformNode,
		Target:      api.ES2017,
		LogLevel:    api.LogLevelSilent,
	})
	if len(result.Errors) > 0 {
		msgs := make([]string, 0, len(result.Errors))
		for _, m := range result.Errors {
			loc := ""
			if m.Location != nil {
				loc = fmt.Sprintf(" (%s:%d)", filepath.Base(m.Location.File), m.Location.Line)
			}
			msgs = append(msgs, m.Text+loc)
		}
		return "", "", fmt.Errorf("build failed: %s", strings.Join(msgs, "; "))
	}
	if len(result.OutputFiles) == 0 {
		return "", "", fmt.Errorf("build produced no output")
	}
	code := string(result.OutputFiles[0].Contents)

	vm := goja.New()
	vm.SetMaxCallStackSize(64 * 1024)

	module := vm.NewObject()
	exports := vm.NewObject()
	_ = module.Set("exports", exports)
	_ = vm.Set("module", module)
	_ = vm.Set("exports", exports)
	_ = vm.Set("__filename", configPath)
	_ = vm.Set("__dirname", filepath.Dir(configPath))
	_ = vm.Set("require", func(call goja.FunctionCall) goja.Value {
		name := call.Argument(0).String()
		panic(vm.ToValue(fmt.Sprintf("require(%q) is not available — sequence configs must be data-only", name)))
	})
	// Minimal process shim; configs occasionally read process.env.
	process := vm.NewObject()
	_ = process.Set("env", vm.NewObject())
	_ = vm.Set("process", process)

	done := make(chan struct{})
	timer := time.AfterFunc(5*time.Second, func() { vm.Interrupt("config evaluation timed out") })
	defer func() {
		timer.Stop()
		close(done)
	}()

	if _, err := vm.RunString(code); err != nil {
		return "", "", fmt.Errorf("config evaluation failed: %s", gojaErr(err))
	}

	v, err := vm.RunString(`(function () {
		var m = module.exports;
		var d = (m && m.default !== undefined) ? m.default : m;
		if (d === undefined || d === null) throw new Error("config has no default export");
		return JSON.stringify(d);
	})()`)
	if err != nil {
		return "", "", fmt.Errorf("config export failed: %s", gojaErr(err))
	}
	defJSON = v.String()

	idv, err := vm.RunString(`(function () {
		var m = module.exports;
		var d = (m && m.default !== undefined) ? m.default : m;
		return typeof d.id === "string" ? d.id : "";
	})()`)
	if err == nil {
		id = idv.String()
	}
	if id == "" {
		return "", "", fmt.Errorf("config default export has no string id field")
	}
	return defJSON, id, nil
}

func gojaErr(err error) string {
	if ex, ok := err.(*goja.Exception); ok {
		return ex.Value().String()
	}
	return err.Error()
}

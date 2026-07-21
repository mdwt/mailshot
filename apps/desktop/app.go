package main

import (
	"context"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// App owns the Wails context and the project file watcher. Feature surface
// lives in the bound services (ProjectService, SequenceService,
// TemplateService, AwsService).
type App struct {
	ctx     context.Context
	watchMu sync.Mutex
	watcher *fsnotify.Watcher
}

func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(ctx context.Context) {
	a.watchMu.Lock()
	defer a.watchMu.Unlock()
	if a.watcher != nil {
		a.watcher.Close()
		a.watcher = nil
	}
}

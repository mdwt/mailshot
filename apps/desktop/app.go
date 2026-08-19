package main

import (
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// App owns the Wails application handle and the project file watcher. Feature
// surface lives in the bound services (ProjectService, SequenceService,
// TemplateService, AwsService).
type App struct {
	wails   *application.App
	watchMu sync.Mutex
	watcher *fsnotify.Watcher
}

func NewApp() *App {
	return &App{}
}

func (a *App) shutdown() {
	a.watchMu.Lock()
	defer a.watchMu.Unlock()
	if a.watcher != nil {
		a.watcher.Close()
		a.watcher = nil
	}
}

package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	projectSvc := NewProjectService(app)
	sequenceSvc := NewSequenceService()
	templateSvc := NewTemplateService()
	awsSvc := NewAwsService()

	err := wails.Run(&options.App{
		Title:     "mailshot",
		Width:     1280,
		Height:    820,
		MinWidth:  960,
		MinHeight: 640,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 13, G: 17, B: 22, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			projectSvc,
			sequenceSvc,
			templateSvc,
			awsSvc,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

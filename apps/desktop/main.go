package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	projectSvc := NewProjectService(app)
	sequenceSvc := NewSequenceService()
	templateSvc := NewTemplateService()
	awsSvc := NewAwsService()
	dataSvc := NewDataService()

	wailsApp := application.New(application.Options{
		Name: "mailshot",
		Services: []application.Service{
			application.NewService(projectSvc),
			application.NewService(sequenceSvc),
			application.NewService(templateSvc),
			application.NewService(awsSvc),
			application.NewService(dataSvc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		OnShutdown: app.shutdown,
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	app.wails = wailsApp

	wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "mailshot",
		Width:            1280,
		Height:           820,
		MinWidth:         960,
		MinHeight:        640,
		BackgroundColour: application.NewRGB(13, 17, 22),
		URL:              "/",
	})

	if err := wailsApp.Run(); err != nil {
		log.Fatal(err)
	}
}

# Next Steps

Congratulations! Your Wails project has been created. 🎉

## Get Started

1. **Install frontend dependencies:**

   ```bash
   cd {{.ProjectDir}}/frontend
   npm install
   ```

2. **Run in development mode:**

   ```bash
   cd {{.ProjectDir}}
   wails dev
   ```

   Your app will launch with hot reload enabled. The frontend dev server runs on http://localhost:5173

## What's Included

✅ **Wails v2.11.0** - Desktop app framework  
✅ **React 18.3** - Modern UI library  
✅ **TypeScript 5.7** - Type safety  
✅ **Vite 5.4** - Fast development server  
✅ **Tailwind CSS v4** - Utility-first CSS with new Vite plugin  
✅ **shadcn/ui** - Beautiful, accessible components (Button, Input, Label, Card)  
✅ **ESLint 9** - Code quality tools

## Customize Your App

### Add More shadcn/ui Components

```bash
cd frontend
npx shadcn@latest add [component-name]
```

Browse components: https://ui.shadcn.com/

### Modify the Greeting Function

Edit `app.go`:

```go
func (a *App) Greet(name string) string {
    return fmt.Sprintf("Hello %s!", name)
}
```

### Update the UI

Edit `frontend/src/App.tsx` to customize your interface.

## Build for Production

```bash
# Build for current platform
wails build

# Or use build scripts
./scripts/build-windows.sh      # Windows
./scripts/build-linux.sh         # Linux
./scripts/build-macos-arm.sh     # macOS Apple Silicon
./scripts/build-all.sh           # All platforms
```

Your executable will be in `build/bin/`

## Project Structure

```
{{.ProjectName}}/
├── app.go                   # Application logic
├── main.go                  # Entry point
├── wails.json              # Project configuration
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Main React component
│   │   ├── components/ui/  # shadcn/ui components
│   │   └── lib/utils.ts    # Utilities
│   ├── wailsjs/            # Generated Go bindings
│   ├── vite.config.ts      # Vite config
│   └── package.json        # Dependencies
└── build/                  # Build resources (icons, etc.)
```

## Learn More

- **Wails Docs:** https://wails.io/docs/introduction
- **React Docs:** https://react.dev/
- **Tailwind CSS v4:** https://tailwindcss.com/
- **shadcn/ui:** https://ui.shadcn.com/
- **Vite:** https://vitejs.dev/

## Need Help?

- Wails Discord: https://discord.gg/BrRSWTaxVK
- GitHub Issues: https://github.com/wailsapp/wails/issues

Happy coding! 🚀

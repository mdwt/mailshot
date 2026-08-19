# Wails + Vite + React + Tailwind CSS v4 + shadcn/ui + TypeScript

A modern Wails template featuring the latest technologies for building beautiful desktop applications.

## 🚀 Features

- **[Wails v3](https://v3.wails.io/)** - Build desktop apps using Go & Web Technologies
- **[React 18.3](https://react.dev/)** - Modern React with hooks
- **[TypeScript 5.7](https://www.typescriptlang.org/)** - Type safety and better DX
- **[Vite 5.4](https://vitejs.dev/)** - Lightning-fast HMR and build tool
- **[Tailwind CSS v4](https://tailwindcss.com/)** - Latest Tailwind with new Vite plugin
- **[shadcn/ui](https://ui.shadcn.com/)** - Beautiful, accessible component library
- **[ESLint 9](https://eslint.org/)** - Code quality with flat config
- **Cross-platform build scripts** - Easy builds for Windows, macOS, and Linux

## 🛠️ Development

Run the app in development mode with hot reload:

```bash
wails3 task dev
```

The frontend dev server runs on http://localhost:9245 with Vite's fast HMR.

## 🏗️ Building

### Current Platform

```bash
wails3 task build
# or
./scripts/build.sh
```

### Cross-Platform Builds

```bash
# Build for all platforms
./scripts/build-all.sh

# Individual platforms
./scripts/build-windows.sh      # Windows AMD64
./scripts/build-linux.sh         # Linux AMD64
./scripts/build-macos-arm.sh     # macOS Apple Silicon
./scripts/build-macos-intel.sh   # macOS Intel
./scripts/build-macos-universal.sh  # macOS Universal Binary
```

Built applications will be in `bin/`. Cross-platform builds need the Docker
cross image (`wails3 task setup:docker`).

## 🎨 shadcn/ui Components

This template includes pre-configured shadcn/ui components:

- Button
- Input
- Label
- Card

Add more components:

```bash
npx shadcn@latest add [component-name]
```

Browse components at [ui.shadcn.com](https://ui.shadcn.com/)

## 📁 Project Structure

```
.
├── app.tmpl.go              # Main application logic
├── main.tmpl.go             # Entry point
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main React component
│   │   ├── components/ui/   # shadcn/ui components
│   │   └── lib/utils.ts     # Utility functions
│   ├── vite.config.ts       # Vite configuration
│   └── package.json         # Frontend dependencies
└── scripts/                 # Build scripts
```

## 🔧 Configuration

Project configuration is in `build/config.yml` and `Taskfile.yml`. Frontend
bindings are generated into `frontend/bindings/` with `wails3 generate bindings -ts`.

## 📚 Learn More

- [Wails v3 Documentation](https://v3.wails.io/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

## 📝 License

This template is available as open source under the terms of the MIT License.

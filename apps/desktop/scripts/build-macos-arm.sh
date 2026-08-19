#!/bin/bash
# Build for macOS (Apple Silicon - ARM64)

echo "Building for macOS (arm64 - Apple Silicon)..."
wails3 task darwin:build ARCH=arm64
echo "Build complete! Check bin/"

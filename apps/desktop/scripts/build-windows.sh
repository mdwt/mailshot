#!/bin/bash
# Build for Windows (amd64). Cross-compiling from macOS/Linux requires the
# Docker cross image: wails3 task setup:docker

echo "Building for Windows (amd64)..."
wails3 task windows:build ARCH=amd64
echo "Build complete! Check bin/"

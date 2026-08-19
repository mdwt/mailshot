#!/bin/bash
# Build for Linux (amd64). Cross-compiling from macOS/Windows requires the
# Docker cross image: wails3 task setup:docker

echo "Building for Linux (amd64)..."
wails3 task linux:build ARCH=amd64
echo "Build complete! Check bin/"

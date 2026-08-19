#!/bin/bash
# Build for macOS (Intel - AMD64)

echo "Building for macOS (amd64 - Intel)..."
wails3 task darwin:build ARCH=amd64
echo "Build complete! Check bin/"

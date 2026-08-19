#!/bin/bash
# Build universal macOS binary (arm64 + amd64)

echo "Building universal macOS binary..."
wails3 task darwin:build:universal
echo "Build complete! Check bin/"

#!/bin/bash
# Build script for all platforms. Non-native targets need the Docker cross
# image: wails3 task setup:docker

echo "Building for all platforms..."
echo "================================"

echo "Building for Windows (amd64)..."
wails3 task windows:build ARCH=amd64

echo "Building for Linux (amd64)..."
wails3 task linux:build ARCH=amd64

echo "Building for macOS (arm64)..."
wails3 task darwin:build ARCH=arm64

echo "Building for macOS (amd64)..."
wails3 task darwin:build ARCH=amd64

echo "================================"
echo "Build complete! Check bin/ directory"

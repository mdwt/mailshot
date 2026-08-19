#!/bin/bash
# Simple production build for current platform

echo "Building for production..."
wails3 task build
echo "Build complete! Check bin/"

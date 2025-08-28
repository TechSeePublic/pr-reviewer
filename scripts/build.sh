#!/bin/bash

# Build script for Cursor AI PR Reviewer
set -e

echo "🔨 Building Cursor AI PR Reviewer..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# TypeScript compilation
echo "🔧 Compiling TypeScript..."
npx tsc

# Package with ncc (bundles all dependencies)
echo "📦 Packaging with ncc..."
npx ncc build dist/main.js -o dist-bundle --source-map --license licenses.txt

# Replace main.js with the bundled version
echo "🔄 Replacing main.js with bundled version..."
mv dist-bundle/index.js dist/main.js
mv dist-bundle/index.js.map dist/main.js.map
cp dist-bundle/sourcemap-register.js dist/sourcemap-register.js
cp dist-bundle/licenses.txt dist/licenses.txt

# Clean up temporary bundle directory
rm -rf dist-bundle

# Create build info
echo "📋 Creating build info..."
cat > dist/build-info.json << EOF
{
  "version": "$(node -p "require('./package.json').version")",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "nodeVersion": "$(node --version)"
}
EOF

echo "✅ Build completed successfully!"
echo "📁 Output: dist/main.js"

# Display build size
if command -v du &> /dev/null; then
    echo "📏 Bundle size: $(du -h dist/main.js | cut -f1)"
fi

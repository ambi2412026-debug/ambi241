#!/bin/bash
# QW2 – JavaScript & CSS Minification Setup Script
# 
# This script minifies the core AMBI241 files using Terser and cssnano
# 
# Requirements:
#   - Node.js 14+ installed
#   - npm available
#   - Run from repository root: bash QW2_MINIFICATION_SETUP.sh
#
# Output files:
#   - core-app.min.js, main-app.min.js, firebase-core.min.js
#   - style.min.css
#

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════════════"
echo "  QW2 – AMBI241 Minification Setup"
echo "═══════════════════════════════════════════════════════════════"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14+ first."
    echo "   https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js $(node --version) detected"
echo "✓ npm $(npm --version) detected"
echo ""

# Install dependencies
echo "📦 Installing minification tools..."
npm install --save-dev terser@latest cssnano@latest postcss@latest cssnano-cli@latest || true

echo ""
echo "🔧 Minifying JavaScript files..."
echo ""

# Minify JavaScript
echo "  → Minifying core-app.js (1.1 MB)..."
npx terser core-app.js -o core-app.min.js -c -m --source-map || echo "⚠️  Warning: core-app.js minification had issues"

echo "  → Minifying main-app.js (1.6 MB)..."
npx terser main-app.js -o main-app.min.js -c -m --source-map || echo "⚠️  Warning: main-app.js minification had issues"

echo "  → Minifying firebase-core.js (34 KB)..."
npx terser firebase-core.js -o firebase-core.min.js -c -m || echo "⚠️  Warning: firebase-core.js minification had issues"

echo ""
echo "🎨 Minifying CSS..."
echo ""

# Minify CSS (using cssnano via PostCSS)
echo "  → Minifying style.css (509 KB)..."
if command -v npx &> /dev/null; then
    # Use PostCSS with cssnano
    cat > .cssnanorc <<EOF
{
  "plugins": [["cssnano", {}]]
}
EOF
    echo "input { @import 'style.css'; }" | npx postcss --config .cssnanorc -o style.min.css || \
    npx cssnano style.css -o style.min.css 2>/dev/null || \
    echo "⚠️  CSS minification skipped (can minify manually)"
fi

echo ""
echo "📊 Size Comparison"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "JavaScript Files:"
echo ""
if [ -f core-app.js ]; then
    size_orig=$(stat -c%s core-app.js 2>/dev/null || stat -f%z core-app.js 2>/dev/null || echo "unknown")
    if [ -f core-app.min.js ]; then
        size_min=$(stat -c%s core-app.min.js 2>/dev/null || stat -f%z core-app.min.js 2>/dev/null || echo "unknown")
        echo "  core-app.js:     $size_orig bytes"
        echo "  core-app.min.js: $size_min bytes (minified)"
    fi
fi

if [ -f main-app.js ]; then
    size_orig=$(stat -c%s main-app.js 2>/dev/null || stat -f%z main-app.js 2>/dev/null || echo "unknown")
    if [ -f main-app.min.js ]; then
        size_min=$(stat -c%s main-app.min.js 2>/dev/null || stat -f%z main-app.min.js 2>/dev/null || echo "unknown")
        echo "  main-app.js:     $size_orig bytes"
        echo "  main-app.min.js: $size_min bytes (minified)"
    fi
fi

if [ -f firebase-core.js ]; then
    size_orig=$(stat -c%s firebase-core.js 2>/dev/null || stat -f%z firebase-core.js 2>/dev/null || echo "unknown")
    if [ -f firebase-core.min.js ]; then
        size_min=$(stat -c%s firebase-core.min.js 2>/dev/null || stat -f%z firebase-core.min.js 2>/dev/null || echo "unknown")
        echo "  firebase-core.js:     $size_orig bytes"
        echo "  firebase-core.min.js: $size_min bytes (minified)"
    fi
fi

echo ""
echo "CSS Files:"
echo ""
if [ -f style.css ]; then
    size_orig=$(stat -c%s style.css 2>/dev/null || stat -f%z style.css 2>/dev/null || echo "unknown")
    if [ -f style.min.css ]; then
        size_min=$(stat -c%s style.min.css 2>/dev/null || stat -f%z style.min.css 2>/dev/null || echo "unknown")
        echo "  style.css:     $size_orig bytes"
        echo "  style.min.css: $size_min bytes (minified)"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Minification Complete!"
echo ""
echo "Next steps:"
echo "  1. Update index.html to reference .min.js and .min.css files"
echo "  2. Test the application in browser"
echo "  3. Check DevTools Network tab to verify minified files load"
echo "  4. Commit: 'QW2: Add minified JavaScript and CSS files'"
echo ""

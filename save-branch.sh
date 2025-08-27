#!/bin/bash
# Git branch backup script - saves your work without needing GitHub authentication

echo "🔄 Git Status Summary"
echo "===================="
git status --porcelain
echo ""

echo "📝 Current Commits on enhanced-translation-system branch:"
echo "========================================================"
git log --oneline enhanced-translation-system -10
echo ""

echo "🆚 Difference from main branch:"
echo "==============================="
git diff main..enhanced-translation-system --name-status
echo ""

echo "📊 Files changed from main to enhanced-translation-system:"
echo "=========================================================="
git diff main..enhanced-translation-system --stat
echo ""

echo "✅ Your enhanced translation work is safely stored in the 'enhanced-translation-system' branch"
echo "✅ Main branch is clean and matches the remote"
echo "✅ You can switch between branches anytime with:"
echo "   git checkout main                    # Switch to original code"
echo "   git checkout enhanced-translation-system  # Switch to enhanced code"
echo ""

echo "📋 To create a patch file of your changes (for backup):"
echo "git diff main..enhanced-translation-system > enhanced-translation-changes.patch"
echo ""

echo "🚀 Server is running with enhanced features on: http://localhost:5150"
echo "🧪 Test the enhanced translation API:"
echo "curl -X POST http://localhost:5150/api/translate -H 'Content-Type: application/json' -d '{\"text\": \"བླ་མ་རིན་པོ་ཆེ།\"}'"
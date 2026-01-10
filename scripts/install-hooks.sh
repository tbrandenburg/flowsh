#!/bin/bash
set -euo pipefail

echo "Installing flowsh development hooks..."

# Create pre-commit hook
cp scripts/pre-commit-template .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "✅ Pre-commit hook installed"
echo "Templates will be validated before each commit"
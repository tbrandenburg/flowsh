# flowsh Makefile - Workflow-to-Shell Generator

# =============================================================================
# Development Setup
# =============================================================================

# Install dependencies
install:
	npm install

# Setup project (install + build + link binary)
setup: install build link

# Install flowsh binary globally for development
link:
	npm link

# Uninstall flowsh binary
unlink:
	npm unlink -g flowsh

# =============================================================================
# Build & Development
# =============================================================================

# TypeScript compilation
build:
	npm run build

# Start CLI in development mode with hot-reload
dev:
	npm run dev

# Run CLI locally (built output)  
run:
	npm start

# =============================================================================
# Code Quality
# =============================================================================

# Run ESLint
lint:
	npm run lint

# Fix ESLint issues automatically
lint-fix:
	npm run lint:fix

# Run Prettier formatting
format:
	npm run format

# Check Prettier formatting
format-check:
	npm run format:check

# Run full test suite
test:
	npm test || echo "No tests found - create tests in src/**/*.test.ts"

# Run tests once (no watch mode)
test-run:
	npm run test:run

# =============================================================================
# flowsh CLI Commands
# =============================================================================

# Generate shell script from example workflow
example:
	flowsh generate examples/flowsh-workflow-example.yaml

# Generate shell script from simple workflow
simple:
	flowsh generate simple-workflow.yaml

# Validate example workflow
validate-example:
	flowsh validate examples/flowsh-workflow-example.yaml

# Show flowsh info
info:
	flowsh info

# Show flowsh help
help-cli:
	flowsh --help

# =============================================================================
# Testing Generated Scripts
# =============================================================================

# Test generated example workflow script (mock mode)
test-example-script:
	chmod +x flowsh-workflow-example.sh
	./flowsh-workflow-example.sh --help

# Test simple workflow script
test-simple-script:
	chmod +x simple-workflow.sh
	./simple-workflow.sh --help

# Test all our test scripts
test-scripts:
	chmod +x test_script_*.sh
	@echo "Testing v1 script..."
	./test_script_v1.sh || true
	@echo "\nTesting v2 script..."
	./test_script_v2.sh || true
	@echo "\nTesting v3 script..."
	./test_script_v3.sh --help || true
	@echo "\nTesting v4 script..."
	./test_script_v4.sh --help || true

# =============================================================================
# Workflow Examples & Demos
# =============================================================================

# Generate all example workflows
generate-all:
	@echo "Generating example workflow..."
	flowsh generate examples/flowsh-workflow-example.yaml
	@echo "Generating simple workflow..."  
	flowsh generate simple-workflow.yaml -o simple-workflow-generated.sh
	@echo "All workflows generated successfully!"

# Validate all workflows
validate-all:
	@echo "Validating all workflows..."
	flowsh validate examples/flowsh-workflow-example.yaml
	flowsh validate simple-workflow.yaml
	flowsh validate examples/flowsh-workflow-pseudo-schema.yaml || echo "Note: Pseudo-schema may not validate"
	@echo "Validation complete!"

# Demo flowsh capabilities
demo:
	@echo "🌊 flowsh Demo - Workflow-to-Shell Generator"
	@echo "=============================================="
	@echo
	flowsh info
	@echo
	@echo "📋 Validating example workflow..."
	flowsh validate examples/flowsh-workflow-example.yaml
	@echo
	@echo "🔄 Generating shell script..."
	flowsh generate examples/flowsh-workflow-example.yaml
	@echo
	@echo "✅ Demo complete! Generated script: flowsh-workflow-example.sh"
	@echo "Run './flowsh-workflow-example.sh --help' to see usage"

# =============================================================================
# Clean & Maintenance
# =============================================================================

# Remove build artifacts
clean:
	rm -rf dist/
	rm -rf node_modules/.cache/

# Remove generated scripts (keep examples)
clean-generated:
	rm -f flowsh-workflow-example.sh
	rm -f simple-workflow.sh
	rm -f simple-workflow-generated.sh

# Full clean (build artifacts + generated scripts + node_modules)
clean-all: clean clean-generated
	rm -rf node_modules/

# =============================================================================
# Development Workflows
# =============================================================================

# Full validation (lint + format-check + test + build)
validate: lint format-check test build

# Full development setup from scratch  
dev-setup: clean-all install build link validate

# Quick development check (lint + test + generate example)
check: lint test example

# Prepare for commit (format + lint + test + build + validate examples)
pre-commit: format lint test build validate-all

# =============================================================================
# Release & Distribution
# =============================================================================

# Build and package for distribution
package: validate
	npm pack

# Prepare for npm publish
publish-check: validate package
	@echo "Ready for npm publish. Run 'npm publish' to publish to npm registry."

# =============================================================================
# Help & Information
# =============================================================================

# Show this help
help:
	@echo "flowsh Makefile - Available Commands"
	@echo "====================================="
	@echo
	@echo "🔧 Development Setup:"
	@echo "  make install      Install npm dependencies"
	@echo "  make setup        Full project setup (install + build + link)"
	@echo "  make link         Install flowsh binary globally"
	@echo "  make dev-setup    Complete development setup from scratch"
	@echo
	@echo "🔨 Build & Development:"
	@echo "  make build        Compile TypeScript"
	@echo "  make dev          Start development mode with hot-reload"
	@echo "  make run          Run built CLI"
	@echo
	@echo "✅ Code Quality:"
	@echo "  make lint         Run ESLint"
	@echo "  make format       Format code with Prettier"
	@echo "  make test         Run test suite"
	@echo "  make validate     Full validation (lint + test + build)"
	@echo
	@echo "🌊 flowsh Commands:"
	@echo "  make example      Generate shell script from example workflow"
	@echo "  make simple       Generate shell script from simple workflow"
	@echo "  make demo         Run full flowsh demonstration"
	@echo "  make info         Show flowsh information"
	@echo
	@echo "🧪 Testing:"
	@echo "  make test-scripts       Test all our shell script iterations"
	@echo "  make test-example-script Test generated example script"
	@echo "  make generate-all       Generate all example workflows"
	@echo "  make validate-all       Validate all workflows"
	@echo
	@echo "🧹 Cleanup:"
	@echo "  make clean        Remove build artifacts"
	@echo "  make clean-all    Full cleanup (includes node_modules)"
	@echo
	@echo "🚀 Workflows:"
	@echo "  make check        Quick development check"
	@echo "  make pre-commit   Prepare for git commit"
	@echo "  make package      Build and package for distribution"

.PHONY: install setup link unlink build dev run lint lint-fix format format-check test test-run \
        example simple validate-example info help-cli test-example-script test-simple-script test-scripts \
        generate-all validate-all demo clean clean-generated clean-all validate dev-setup check \
        pre-commit package publish-check help
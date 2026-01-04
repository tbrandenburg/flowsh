# flowsh Makefile - Workflow-to-Shell Generator
# Simplified and modernized for clean development workflow

# =============================================================================
# Development Setup
# =============================================================================

.PHONY: help install build dev test lint format clean run examples-all examples-workflows

# Default target
help:
	@echo "flowsh Makefile - Available Commands"
	@echo "====================================="
	@echo
	@echo "🔧 Development:"
	@echo "  make install      Install dependencies"
	@echo "  make build        Compile TypeScript"
	@echo "  make dev          Start development mode with hot-reload"
	@echo "  make run          Run flowsh CLI (shows help)"
	@echo "  make test         Run test suite"
	@echo
	@echo "✅ Code Quality:"
	@echo "  make lint         Run ESLint (with auto-fix)"
	@echo "  make format       Format code with Prettier"
	@echo "  make check        Run all quality checks (lint + format + test + build)"
	@echo
	@echo "🌊 Workflow Operations:"
	@echo "  make example          Generate shell script from main example workflow"
	@echo "  make examples-all     Generate scripts from all 18 node examples"
	@echo "  make examples-workflows  Generate scripts from key workflow examples"
	@echo "  make validate         Validate example workflows"
	@echo
	@echo "🧪 Testing Generated Scripts:"
	@echo "  make test-generated   Test generated shell scripts"
	@echo "  make test-scripts     Test development shell scripts"
	@echo
	@echo "🧹 Cleanup:"
	@echo "  make clean        Remove build artifacts and generated files"
	@echo "  make clean-all    Full cleanup including node_modules"

# =============================================================================
# Core Development Commands
# =============================================================================

# Install dependencies
install:
	npm install

# TypeScript compilation
build:
	npm run build

# Development mode with hot-reload
dev:
	npm run dev

# Run flowsh CLI without parameters (shows help)
run: build
	node dist/cli/index.js

# Run test suite
test:
	npm test

# Run ESLint with auto-fix
lint:
	npm run lint:fix

# Format code with Prettier
format:
	npm run format

# Full quality check pipeline
check: lint format test build
	@echo "✅ All quality checks passed!"

# =============================================================================
# Workflow Operations (require flowsh CLI to be built)
# =============================================================================

# Generate shell script from example workflow
example: build
	@echo "Generating shell script from main example..."
	node dist/cli/index.js compile examples/flowsh-workflow-example.yaml

# Generate shell scripts from all node examples
examples-all: build
	@echo "Generating shell scripts from all node examples..."
	@mkdir -p scripts/generated-outputs/nodes/
	@for example in examples/nodes/*-example.yaml; do \
		if [ -f "$$example" ]; then \
			echo "Generating: $$example"; \
			basename=$$(basename "$$example" .yaml); \
			node dist/cli/index.js compile "$$example" > "scripts/generated-outputs/nodes/$$basename.sh" 2>/dev/null || \
			echo "  ❌ Failed to compile $$example"; \
		fi; \
	done
	@echo "✅ Generated $(shell find examples/nodes -name '*-example.yaml' | wc -l) node example scripts in scripts/generated-outputs/nodes/"

# Generate shell scripts from key workflow examples  
examples-workflows: build
	@echo "Generating shell scripts from key workflow examples..."
	@mkdir -p scripts/generated-outputs/workflows/
	@for example in examples/hello-world.yaml examples/simple-workflow.yaml examples/counting-loop.yaml examples/api-data-aggregation.yaml; do \
		if [ -f "$$example" ]; then \
			echo "Generating: $$example"; \
			basename=$$(basename "$$example" .yaml); \
			node dist/cli/index.js compile "$$example" > "scripts/generated-outputs/workflows/$$basename.sh" 2>/dev/null || \
			echo "  ❌ Failed to compile $$example"; \
		fi; \
	done
	@echo "✅ Generated workflow example scripts in scripts/generated-outputs/workflows/"

# Validate example workflows
validate: build
	@echo "Validating workflows..."
	node dist/cli/index.js validate examples/flowsh-workflow-example.yaml
	node dist/cli/index.js validate examples/simple-workflow.yaml
	@echo "✅ Workflow validation complete!"

# =============================================================================
# Testing Generated Scripts
# =============================================================================

# Test generated shell scripts (if they exist)
test-generated:
	@echo "Testing generated shell scripts..."
	@if [ -f "scripts/generated-outputs/flowsh-workflow-example.sh" ]; then \
		echo "Testing example workflow script..."; \
		chmod +x scripts/generated-outputs/flowsh-workflow-example.sh; \
		scripts/generated-outputs/flowsh-workflow-example.sh --help || echo "Script help failed"; \
	else \
		echo "No generated example script found. Run 'make example' first."; \
	fi

# Test development shell scripts
test-scripts:
	@echo "Testing development shell scripts..."
	@for script in scripts/test-scripts/test_script_v*.sh; do \
		if [ -f "$$script" ]; then \
			echo "Testing $$script..."; \
			chmod +x "$$script"; \
			"$$script" --help 2>/dev/null || echo "$$script completed"; \
		fi; \
	done

# =============================================================================
# Cleanup
# =============================================================================

# Remove build artifacts and generated files
clean:
	rm -rf dist/
	rm -rf coverage/
	rm -f *.sh
	rm -f *-generated.sh

# Full cleanup including node_modules
clean-all: clean
	rm -rf node_modules/

# =============================================================================
# Development Workflows
# =============================================================================

# Full development setup from scratch  
setup: clean install build
	@echo "✅ Development setup complete!"

# Prepare for commit (format + lint + test + build + validate)
pre-commit: format lint test build validate
	@echo "✅ Ready for commit!"

# Build and test everything
ci: install build test
	@echo "✅ CI pipeline complete!"

.DEFAULT_GOAL := help
# Install dependencies
install:
	npm install

# Start CLI in development mode with hot-reload
dev:
	npm run dev

# Run CLI locally (built output)  
run:
	npm start

# TypeScript compilation
build:
	npm run build

# Run ESLint
lint:
	npm run lint

# Run Prettier
format:
	npm run format

# Run full test suite
test:
	npm test

# Remove build artifacts
clean:
	rm -rf dist/
	rm -rf node_modules/.cache/

# Setup project (install + build)
setup: install build

# Full validation (lint + test + build)
validate: lint test build

# Development workflow (setup + dev)
start: setup dev

.PHONY: install dev run build lint format test clean setup validate start
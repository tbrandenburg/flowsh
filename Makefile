.PHONY: help install publish lint test build qa clean hygiene

help:
	@printf '%s\n' \
		'flowsh - minimal workflow-to-harness generator' \
		'' \
		'Commands:' \
		'  make install  Install flowsh into the user PATH with uv tool' \
		'  make lint     Run Ruff and compile-check Python files' \
		'  make test     Run tests' \
		'  make build    Build source and wheel distributions' \
		'  make publish  Build and publish to PyPI' \
		'  make qa       Run lint, tests, and package build' \
		'  make clean    Remove local test/build artifacts' \
		'  make hygiene  Show tracked, untracked, and ignored files'

install:
	uv tool install --force .

publish:
	uv build && uv publish

lint:
	uv run --locked ruff check .
	uv run --locked ruff format --check .
	uv run --locked python -m py_compile src/flowsh/*.py scripts/workflow_to_harness.py tests/test_workflow_to_harness.py

test:
	uv run --locked pytest

build:
	uv build

qa: lint test build
	@printf '%s\n' 'QA passed'

hygiene:
	git status --short --ignored

clean:
	rm -rf .pytest_cache .ruff_cache .harness .flowsh src/flowsh/__pycache__ scripts/__pycache__ tests/__pycache__ dist build

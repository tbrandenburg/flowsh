.PHONY: help install lint test qa clean

help:
	@printf '%s\n' \
		'flowsh - minimal workflow-to-harness generator' \
		'' \
		'Commands:' \
		'  make install  Install flowsh into the user PATH with uv tool' \
		'  make lint     Run Ruff and compile-check Python files' \
		'  make test     Run tests' \
		'  make qa       Run lint and tests' \
		'  make clean    Remove local test/build artifacts'

install:
	uv tool install --force .

lint:
	uv run ruff check .
	uv run ruff format --check .
	uv run python -m py_compile src/flowsh/*.py scripts/workflow_to_harness.py tests/test_workflow_to_harness.py

test:
	uv run pytest

qa: lint test
	@printf '%s\n' 'QA passed'

clean:
	rm -rf .pytest_cache .ruff_cache .harness .flowsh src/flowsh/__pycache__ scripts/__pycache__ tests/__pycache__ dist build

.PHONY: help install lint test qa clean

help:
	@printf '%s\n' \
		'flowsh - minimal workflow-to-harness generator' \
		'' \
		'Commands:' \
		'  make install  Create/update the uv environment' \
		'  make lint     Compile-check Python files' \
		'  make test     Run tests' \
		'  make qa       Run lint and tests' \
		'  make clean    Remove local test/build artifacts'

install:
	uv sync

lint:
	uv run python -m py_compile scripts/workflow_to_harness.py tests/test_workflow_to_harness.py

test:
	uv run pytest

qa: lint test
	@printf '%s\n' 'QA passed'

clean:
	rm -rf .pytest_cache .harness scripts/__pycache__ tests/__pycache__ dist build

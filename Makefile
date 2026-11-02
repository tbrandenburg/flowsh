.PHONY: help install publish lint test security build qa clean hygiene bump-patch bump-minor bump-major

help:
	@printf '%s\n' \
		'flowsh-cli - minimal workflow-to-harness generator' \
		'' \
		'Commands:' \
		'  make install   Install flowsh-cli into the user PATH with uv tool' \
		'  make lint      Run Ruff and compile-check Python files' \
		'  make test      Run tests' \
		'  make security  Audit locked dependencies for known vulnerabilities' \
		'  make build     Build source and wheel distributions' \
		'  make publish   Build and publish to PyPI' \
		'  make qa        Run lint, tests, security audit, and package build' \
		'  make clean     Remove local test/build artifacts' \
		'  make hygiene   Show tracked, untracked, and ignored files' \
		'  make bump-patch|minor|major  Bump version in pyproject.toml, build, publish'

install:
	uv tool install --force ".[cli]"

publish:
	@branch="$$(git rev-parse --abbrev-ref HEAD)"; \
	if [ "$$branch" != "main" ]; then \
		printf '%s\n' "ERROR: publish requires branch main (current: $$branch)" >&2; \
		exit 1; \
	fi
	rm -rf dist
	uv build && uv publish

bump-patch bump-minor bump-major:
	$(eval PART := $(@:bump-%=%))
	python3 scripts/bump_version.py $(PART)
	uv lock
	$(MAKE) qa
	$(MAKE) publish

lint:
	uv run --locked ruff check .
	uv run --locked ruff format --check .
	uv run --locked python -m py_compile src/flowsh_cli/*.py scripts/*.py tests/test_workflow_to_harness.py

test:
	uv run --locked pytest

security:
	@set -eu; requirements="$$(mktemp)"; trap 'rm -f "$$requirements"' EXIT; \
	uv export --locked --all-extras --all-groups --no-emit-project --output-file "$$requirements" >/dev/null; \
	uv run --locked pip-audit --disable-pip --require-hashes -r "$$requirements"

build:
	uv build

qa: lint test security build
	@printf '%s\n' 'QA passed'

hygiene:
	git status --short --ignored

clean:
	rm -rf .pytest_cache .ruff_cache .flowsh src/flowsh_cli/__pycache__ scripts/__pycache__ tests/__pycache__ dist build

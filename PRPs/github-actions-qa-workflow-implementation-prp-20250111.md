# PRP: GitHub Actions QA Workflow Implementation

**Created:** 2025-01-11  
**Status:** Ready for Implementation  
**Priority:** High  
**Estimated Complexity:** Medium

## FEATURE:

Implement a GitHub Actions workflow that executes "make qa" as a comprehensive quality assurance pipeline for the flowsh repository. The workflow should run on multiple triggers (push to main, pull requests, commits, manual dispatch) and rely entirely on the existing "make qa" command for validation logic.

**Core Requirements:**

- Execute "make qa" in GitHub Actions environment with ubuntu-latest runner
- Support multiple trigger events: push to main, pull requests, manual dispatch
- Install OpenCode following the pattern from nodejs-frontend-preview.yml example
- Use repository secrets TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (already configured)
- Fail the workflow if "make qa" exits with non-zero status
- Output exactly what "make qa" outputs (no additional processing)
- Use GitHub CLI "gh" during implementation for validation loop testing

**Integration Points:**

- Leverages existing Makefile QA pipeline that validates:
  - TypeScript compilation and testing (80% coverage requirement)
  - All 35 production templates (basic, enhanced, advanced)
  - All 19+ node examples with execution validation
  - Linting, formatting, and build processes
- Must work with Node.js 18+ environment and npm dependencies
- Should complete within reasonable CI/CD time limits

## EXAMPLES:

**Reference Implementation:**

```yaml
# Based on: https://github.com/tbrandenburg/made/blob/main/.github/workflows/nodejs-frontend-preview.yml
name: QA Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  qa:
    runs-on: ubuntu-latest
    env:
      TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
      TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install OpenCode
        run: npm install -g @anomalyco/opencode
      - name: Install Dependencies
        run: npm ci
      - name: Run QA Pipeline
        run: make qa
```

**Existing QA Pipeline (from Makefile):**

```bash
# Comprehensive quality assurance pipeline
# Runs all checks: linting, formatting, unit tests, build, examples, and templates
qa: check examples-all templates-all
	@echo "🎉 All QA checks passed successfully!"

# Where:
# - check: lint format test build
# - examples-all: Generate and execute all 19+ node examples
# - templates-all: Generate and execute all 35 production templates
```

**GitHub CLI Validation Commands:**

```bash
# Watch workflow runs during validation
gh run list --workflow=qa-pipeline.yml
gh run watch <run-id>
gh run view <run-id> --log
```

## DOCUMENTATION:

**GitHub Actions References:**

- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Node.js Setup Action](https://github.com/actions/setup-node)
- [Checkout Action v4](https://github.com/actions/checkout)

**Project Context:**

- Current Makefile QA pipeline: `/home/tom/workspace/ai/made/workspace/flowsh/Makefile` (lines 54-56)
- Reference workflow: https://github.com/tbrandenburg/made/blob/main/.github/workflows/nodejs-frontend-preview.yml
- Repository secrets already configured: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

**OpenCode Installation:**

- Package: `@anomalyco/opencode` (npm global install)
- Required for template execution and validation processes

**Flowsh QA Requirements:**

- Node.js 18+ (specified in package.json engines)
- TypeScript compilation with strict mode
- 80% test coverage threshold (vitest.config.ts)
- All 35 templates must compile and validate successfully
- All 19+ node examples must execute without errors

## OTHER CONSIDERATIONS:

**Critical Implementation Requirements:**

1. **No Additional Logic:** Workflow should NOT implement validation logic on top of "make qa" - it should simply execute it and respect its exit code
2. **Exit Code Handling:** "make qa" must exit with status 1 on failure (verify current implementation)
3. **Environment Setup:** Ubuntu-latest runner with Node.js 18 and npm caching for performance
4. **Secret Availability:** TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be available as environment variables during execution

**Potential Issues:**

1. **Makefile Exit Codes:** Verify that "make qa" properly exits with non-zero status on any failure
2. **Template Execution Time:** 35 template executions may take significant time - ensure workflow timeout is appropriate
3. **Environment Variables:** Some templates may require additional environment setup beyond Telegram secrets
4. **OpenCode Installation:** Ensure OpenCode installation works in GitHub Actions environment

**Validation Loop Strategy:**

During PRP execution, use GitHub CLI to:

1. Create and push the workflow file
2. Trigger manual workflow dispatch: `gh workflow run qa-pipeline.yml`
3. Monitor execution: `gh run watch`
4. Verify all trigger types work (push, PR, manual)
5. Confirm failure scenarios work correctly
6. Validate output matches local "make qa" execution

**Files to Create/Modify:**

1. **Create:** `.github/workflows/qa-pipeline.yml` - Main workflow file
2. **Verify/Update:** `Makefile` - Ensure "make qa" exits properly on failure
3. **Test:** Workflow triggers and execution via GitHub CLI

**Success Criteria:**

✅ Workflow triggers correctly on push to main, pull requests, and manual dispatch  
✅ "make qa" executes successfully in GitHub Actions environment  
✅ Workflow fails when "make qa" fails (exit code 1)  
✅ Workflow output matches local "make qa" output  
✅ All 35 templates validate successfully in CI environment  
✅ All 19+ node examples execute successfully in CI environment  
✅ TypeScript tests pass with 80% coverage requirement  
✅ GitHub CLI validation confirms successful workflow execution  
✅ Workflow completes within reasonable time limits (< 10 minutes)

**Performance Considerations:**

- Use npm caching to reduce dependency installation time
- Consider parallel execution if "make qa" supports it
- Monitor workflow execution time and optimize if needed
- Ensure timeout settings allow for complete template validation

**Security Notes:**

- Repository secrets (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID) are properly configured
- No additional secret exposure in workflow logs
- OpenCode installation from official npm package only

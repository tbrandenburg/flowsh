## FEATURE:

Add `--output/-o` option to the FlowSH CLI compile command to write generated shell scripts directly to a file instead of stdout.

### Current Behavior:

```bash
flowsh compile workflow.yaml > script.sh
```

### Desired Behavior:

```bash
flowsh compile workflow.yaml -o script.sh
flowsh compile workflow.yaml --output script.sh
flowsh compile workflow.yaml  # Still outputs to stdout when no -o specified
```

### Requirements:

- Add `-o, --output <file>` option to the compile command
- Create directories automatically if they don't exist
- Overwrite existing files without prompting
- Continue outputting to stdout when no output option is specified
- Simple error handling (basic file write errors)

## EXAMPLES:

```bash
# Basic usage
flowsh compile examples/hello-world.yaml -o scripts/hello-world.sh

# With full path
flowsh compile workflow.yaml --output /tmp/generated/script.sh

# Directory creation
flowsh compile workflow.yaml -o new-folder/subfolder/script.sh

# Still works without output option
flowsh compile workflow.yaml > manual-redirect.sh
```

## DOCUMENTATION:

- Current CLI implementation: `src/cli/index.ts` (lines 24-81, 128-135)
- Commander.js documentation: https://github.com/tj/commander.js#options
- Node.js fs module: https://nodejs.org/api/fs.html#fswritefilesyncfile-data-options

## OTHER CONSIDERATIONS:

- Use Node.js built-in `fs` module and `path` module
- Add the option to the existing compile command definition around line 132
- Modify `compileCommand` function to accept output parameter
- Use `fs.mkdirSync(path.dirname(outputFile), { recursive: true })` for directory creation
- Use `fs.writeFileSync(outputFile, script)` for file writing
- Keep the existing `console.log(generateResult.script)` when no output file specified

### Success Criteria:

- Can generate files with `-o` and `--output`
- Creates directories automatically
- Stdout behavior unchanged when no output option used
- Basic error handling for file write failures

/**
 * Tests for CLI functionality including output option
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('CLI Output Option', () => {
  let tempDir: string;
  let testOutputFile: string;

  beforeEach(() => {
    // Create a temporary directory for test outputs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowsh-test-'));
    testOutputFile = path.join(tempDir, 'test-output.sh');
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should write to file when -o option is provided', () => {
    const command = `node dist/cli/index.js compile examples/hello-world.yaml -o ${testOutputFile}`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    expect(fs.existsSync(testOutputFile)).toBe(true);

    const fileContent = fs.readFileSync(testOutputFile, 'utf8');
    expect(fileContent).toContain('#!/bin/bash');
    expect(fileContent).toContain('Hello World');
  });

  it('should write to file when --output option is provided', () => {
    const command = `node dist/cli/index.js compile examples/hello-world.yaml --output ${testOutputFile}`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    expect(fs.existsSync(testOutputFile)).toBe(true);
  });

  it('should create directories when they do not exist', () => {
    const nestedOutputFile = path.join(tempDir, 'nested', 'deep', 'output.sh');
    const command = `node dist/cli/index.js compile examples/hello-world.yaml -o ${nestedOutputFile}`;

    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    expect(fs.existsSync(nestedOutputFile)).toBe(true);
    expect(fs.existsSync(path.dirname(nestedOutputFile))).toBe(true);
  });

  it('should still output to stdout when no output option is provided', () => {
    const command = `node dist/cli/index.js compile examples/hello-world.yaml`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('#!/bin/bash');
    expect(output).toContain('Hello World');
    expect(output).not.toContain('Generated script saved to:');
  });

  it('should handle file write errors gracefully', () => {
    const protectedFile = '/root/protected.sh';
    const command = `node dist/cli/index.js compile examples/hello-world.yaml -o ${protectedFile}`;

    try {
      execSync(command, { encoding: 'utf8' });
      // Should not reach here
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.stderr || error.stdout).toContain('Permission denied writing to:');
    }
  });

  it('should overwrite existing files', () => {
    // Create a file first
    fs.writeFileSync(testOutputFile, 'original content');
    expect(fs.readFileSync(testOutputFile, 'utf8')).toBe('original content');

    // Overwrite with flowsh output
    const command = `node dist/cli/index.js compile examples/hello-world.yaml -o ${testOutputFile}`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    const newContent = fs.readFileSync(testOutputFile, 'utf8');
    expect(newContent).not.toBe('original content');
    expect(newContent).toContain('#!/bin/bash');
  });

  it('should work with different workflow files', () => {
    const command = `node dist/cli/index.js compile examples/counting-loop.yaml -o ${testOutputFile}`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    expect(fs.existsSync(testOutputFile)).toBe(true);

    const fileContent = fs.readFileSync(testOutputFile, 'utf8');
    expect(fileContent).toContain('#!/bin/bash');
    expect(fileContent).toContain('Counting Loop Test');
  });
});

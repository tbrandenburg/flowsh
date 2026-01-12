/**
 * Tests for CLI functionality including output option and DSL command
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
    const command = `node dist/cli/index.js compile dev/test-workflows/hello-world-test.yaml -o ${testOutputFile}`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    expect(fs.existsSync(testOutputFile)).toBe(true);

    const fileContent = fs.readFileSync(testOutputFile, 'utf8');
    expect(fileContent).toContain('#!/bin/bash');
    expect(fileContent).toContain('Hello World');
  });

  it('should write to file when --output option is provided', () => {
    const command = `node dist/cli/index.js compile dev/test-workflows/hello-world-test.yaml --output ${testOutputFile}`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    expect(fs.existsSync(testOutputFile)).toBe(true);
  });

  it('should create directories when they do not exist', () => {
    const nestedOutputFile = path.join(tempDir, 'nested', 'deep', 'output.sh');
    const command = `node dist/cli/index.js compile dev/test-workflows/hello-world-test.yaml -o ${nestedOutputFile}`;

    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    expect(fs.existsSync(nestedOutputFile)).toBe(true);
    expect(fs.existsSync(path.dirname(nestedOutputFile))).toBe(true);
  });

  it('should still output to stdout when no output option is provided', () => {
    const command = `node dist/cli/index.js compile dev/test-workflows/hello-world-test.yaml`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('#!/bin/bash');
    expect(output).toContain('Hello World');
    expect(output).not.toContain('Generated script saved to:');
  });

  it('should handle file write errors gracefully', () => {
    const protectedFile = '/root/protected.sh';
    const command = `node dist/cli/index.js compile dev/test-workflows/hello-world-test.yaml -o ${protectedFile}`;

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
    const command = `node dist/cli/index.js compile dev/test-workflows/hello-world-test.yaml -o ${testOutputFile}`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    const newContent = fs.readFileSync(testOutputFile, 'utf8');
    expect(newContent).not.toBe('original content');
    expect(newContent).toContain('#!/bin/bash');
  });

  it('should work with different workflow files', () => {
    const command = `node dist/cli/index.js compile dev/test-workflows/counting-loop-test.yaml -o ${testOutputFile}`;
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Generated script saved to:');
    expect(fs.existsSync(testOutputFile)).toBe(true);

    const fileContent = fs.readFileSync(testOutputFile, 'utf8');
    expect(fileContent).toContain('#!/bin/bash');
    expect(fileContent).toContain('Counting Loop Test');
  });
});

describe('CLI DSL Command', () => {
  it('should execute dsl command and show DSL structure', () => {
    const command = 'node dist/cli/index.js dsl';
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('flowsh DSL Reference - Complete Schema Overview');
    expect(output).toContain('ROOT STRUCTURE:');
    expect(output).toContain('GRAPH COMPONENTS:');
    expect(output).toContain('EDGE PROPERTIES:');
    expect(output).toContain('VARIABLE TYPES');
    expect(output).toContain('NODE TYPES');
    expect(output).toContain('SUPPORTING TYPES:');
  });

  it('should show all expected node types', () => {
    const command = 'node dist/cli/index.js dsl';
    const output = execSync(command, { encoding: 'utf8' });

    // Check for some key node types
    expect(output).toContain('start');
    expect(output).toContain('end');
    expect(output).toContain('llm');
    expect(output).toContain('if-else');
    expect(output).toContain('variable-assignment');
    expect(output).toContain('telegram');
    expect(output).toContain('circuit-breaker');
  });

  it('should output valid JSON when --format json is used', () => {
    const command = 'node dist/cli/index.js dsl --format json';
    const output = execSync(command, { encoding: 'utf8' });

    expect(() => JSON.parse(output)).not.toThrow();

    const parsed = JSON.parse(output);
    expect(parsed.version).toBe('2.0.0-complete');
    expect(parsed.dsl_structure).toBeDefined();
    expect(parsed.supported_formats).toEqual(['text', 'json']);
  });

  it('should include all DSL structure components in JSON output', () => {
    const command = 'node dist/cli/index.js dsl --format json';
    const output = execSync(command, { encoding: 'utf8' });
    const parsed = JSON.parse(output);

    expect(parsed.dsl_structure.root_entities).toBeDefined();
    expect(parsed.dsl_structure.graph_components).toBeDefined();
    expect(parsed.dsl_structure.edge_properties).toBeDefined();
    expect(parsed.dsl_structure.variable_types).toBeDefined();
    expect(parsed.dsl_structure.node_types).toBeDefined();
    expect(parsed.dsl_structure.supporting_types).toBeDefined();
    expect(parsed.dsl_structure.totals).toBeDefined();
  });

  it('should show help for dsl command', () => {
    const command = 'node dist/cli/index.js dsl --help';
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('Explore flowsh DSL node types and properties');
    expect(output).toContain('--format <format>');
    expect(output).toContain('Output format: text | json');
  });

  it('should be listed in main help', () => {
    const command = 'node dist/cli/index.js --help';
    const output = execSync(command, { encoding: 'utf8' });

    expect(output).toContain('dsl [options]');
    expect(output).toContain('Explore flowsh DSL node types and');
  });

  it('should be included in unknown command error', () => {
    const command = 'node dist/cli/index.js invalid-command';

    try {
      execSync(command, { encoding: 'utf8' });
      // Should not reach here
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.stderr || error.stdout).toContain('compile, validate, init, dsl');
    }
  });

  it('should handle invalid format option gracefully', () => {
    const command = 'node dist/cli/index.js dsl --format invalid';
    const output = execSync(command, { encoding: 'utf8' });

    // Should still work, just treat as text format
    expect(output).toContain('flowsh DSL Reference');
  });
});

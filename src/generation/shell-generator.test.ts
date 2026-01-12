import { describe, expect, it } from 'vitest';

import { FlowshWorkflow } from '../dsl/types.js';
import { generateShellScript } from './shell-generator.js';

const createWorkflow = (command: string, environmentVariables: string[] = []): FlowshWorkflow => {
  return {
    metadata: { name: 'Test Workflow' },
    environment_variables: environmentVariables.map(variable => ({ variable })),
    graph: {
      nodes: [
        { id: 'start', type: 'start', data: { title: 'Start' } },
        { id: 'code', type: 'code', data: { command } },
        { id: 'end', type: 'end', data: { title: 'End' } },
      ],
      edges: [
        { id: 'start-to-code', source: 'start', target: 'code' },
        { id: 'code-to-end', source: 'code', target: 'end' },
      ],
    },
  };
};

describe('generateShellScript', () => {
  it('warns about potentially unbound variables referenced in the script', () => {
    const workflow = createWorkflow('echo "$UNBOUND_VAR"');
    const result = generateShellScript(workflow);

    expect(result.success).toBe(true);
    expect(result.warnings).toContain(
      "Potentially unbound variable 'UNBOUND_VAR' referenced in generated script"
    );
  });

  it('does not warn when variables are declared in environment_variables', () => {
    const workflow = createWorkflow('echo "$KNOWN_VAR"', ['KNOWN_VAR']);
    const result = generateShellScript(workflow);

    expect(result.success).toBe(true);
    expect(result.warnings.some(warning => warning.includes('KNOWN_VAR'))).toBe(false);
  });

  it('does not warn for known shell variables', () => {
    const workflow = createWorkflow('echo "$BASH_VERSION"');
    const result = generateShellScript(workflow);

    expect(result.success).toBe(true);
    expect(result.warnings.some(warning => warning.includes('BASH_VERSION'))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { FlowshWorkflow } from './types.js';
import { validateWorkflow } from './validation.js';

function createWorkflow(command: string, envVars?: Array<{ variable: string }>): FlowshWorkflow {
  return {
    workflow: {
      name: 'Test Workflow',
    },
    environment_variables: envVars?.map(variable => ({
      variable: variable.variable,
      name: variable.variable,
      type: 'text',
    })),
    graph: {
      nodes: [
        { id: 'start', type: 'start', data: {} },
        { id: 'code', type: 'code', data: { command } },
        { id: 'end', type: 'end', data: {} },
      ],
      edges: [
        { id: 'edge-start-code', source: 'start', target: 'code' },
        { id: 'edge-code-end', source: 'code', target: 'end' },
      ],
    },
  };
}

describe('validateWorkflow', () => {
  it('warns when bash variables are referenced without environment declarations', () => {
    const workflow = createWorkflow('echo $MISSING_VAR');
    const result = validateWorkflow(workflow);
    const warningCodes = result.warnings.map(warning => warning.code);

    expect(warningCodes).toContain('POTENTIAL_UNBOUND_VARIABLE');
  });

  it('does not warn when variables are declared in environment_variables', () => {
    const workflow = createWorkflow('curl "$API_URL"', [{ variable: 'API_URL' }]);
    const result = validateWorkflow(workflow);
    const warningCodes = result.warnings.map(warning => warning.code);

    expect(warningCodes).not.toContain('POTENTIAL_UNBOUND_VARIABLE');
  });
});

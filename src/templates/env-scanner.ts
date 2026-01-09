/**
 * Simple environment variable scanner for basic validation warnings
 */

import { FlowshWorkflow, WorkflowNode } from '../dsl/types.js';

/**
 * Common environment variables that workflows often require
 */
const COMMON_ENV_VARS = new Set([
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'HUGGINGFACE_API_KEY',
  'GITHUB_TOKEN',
  'GITLAB_TOKEN',
  'SLACK_TOKEN',
  'DISCORD_TOKEN',
]);

/**
 * Scan workflow for environment variable usage and return missing ones
 */
export function scanMissingEnvironmentVariables(workflow: FlowshWorkflow): string[] {
  const usedEnvVars = new Set<string>();

  // Scan nodes for environment variable patterns
  if (workflow.graph?.nodes) {
    for (const node of workflow.graph.nodes) {
      const nodeEnvVars = extractEnvVarsFromNode(node);
      nodeEnvVars.forEach(varName => usedEnvVars.add(varName));
    }
  }

  // Check which common env vars are used but not set
  const missingVars: string[] = [];
  for (const varName of usedEnvVars) {
    if (COMMON_ENV_VARS.has(varName) && !process.env[varName]) {
      missingVars.push(varName);
    }
  }

  return missingVars.sort();
}

/**
 * Extract environment variables referenced in a node
 */
function extractEnvVarsFromNode(node: WorkflowNode): string[] {
  const envVars: string[] = [];

  try {
    // Convert node data to string for scanning
    const nodeStr = JSON.stringify(node.data);

    // Look for ${VAR} patterns (shell environment variables)
    const shellEnvMatches = nodeStr.match(/\$\{([A-Z_][A-Z0-9_]*)[^}]*\}/g) || [];
    shellEnvMatches.forEach(match => {
      const varName = match.match(/\$\{([A-Z_][A-Z0-9_]*)/)?.[1];
      if (varName && COMMON_ENV_VARS.has(varName)) {
        envVars.push(varName);
      }
    });

    // Look for specific node types that commonly use env vars
    if (node.type === 'telegram') {
      // Telegram nodes typically need these
      if (!nodeStr.includes('bot_token') && !nodeStr.includes('TELEGRAM_BOT_TOKEN')) {
        envVars.push('TELEGRAM_BOT_TOKEN');
      }
      if (!nodeStr.includes('chat_id') && !nodeStr.includes('TELEGRAM_CHAT_ID')) {
        envVars.push('TELEGRAM_CHAT_ID');
      }
    }

    if (node.type === 'llm') {
      // LLM nodes typically need API keys
      if (!nodeStr.includes('api_key') && !nodeStr.includes('OPENAI_API_KEY')) {
        envVars.push('OPENAI_API_KEY');
      }
    }
  } catch {
    // Ignore JSON parsing errors and continue
  }

  return [...new Set(envVars)];
}

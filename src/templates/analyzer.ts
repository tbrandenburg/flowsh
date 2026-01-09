/**
 * Template analyzer for extracting metadata and complexity information
 * from flowsh workflow templates
 */

import { TemplateMetadata } from './types.js';

/**
 * Extract placeholder variables from template content
 */
export function extractPlaceholders(content: string): string[] {
  const placeholderPattern = /\{\{([^}]+)\}\}/g;
  const placeholders = new Set<string>();

  let match;
  while ((match = placeholderPattern.exec(content)) !== null) {
    if (match[1]) {
      placeholders.add(match[1]);
    }
  }

  return Array.from(placeholders).sort();
}

/**
 * Highlight placeholder variables in template content for display
 */
export function highlightPlaceholders(content: string): string {
  return content.replace(/\{\{([^}]+)\}\}/g, '{{$1}} # ← Placeholder variable');
}

/**
 * Analyzes templates to extract metadata, complexity, and requirements
 */
export class TemplateAnalyzer {
  /**
   * Analyze a parsed template YAML to extract metadata
   */
  analyzeTemplate(templateData: any): TemplateMetadata {
    const nodes = templateData?.graph?.nodes || [];
    const edges = templateData?.graph?.edges || [];

    // Extract node types
    const nodeTypes = [
      ...new Set(
        nodes
          .map((node: any) => node.type)
          .filter((type: any) => Boolean(type) && typeof type === 'string')
      ),
    ] as string[];

    // Calculate complexity based on node count and types
    const complexity = this.calculateComplexity(nodes.length, nodeTypes);

    // Estimate script length (rough approximation)
    const estimatedScriptLines = this.estimateScriptLength(nodes);

    // Extract required environment variables
    const requiredEnvironmentVars = this.extractEnvironmentVariables(templateData);

    return {
      complexity,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes,
      estimatedScriptLines,
      requiredEnvironmentVars,
    };
  }

  /**
   * Extract required variables from template data
   */
  extractRequiredVariables(templateData: any): string[] {
    const variables: Set<string> = new Set();

    // Extract from environment variables section if present
    const envVars = this.extractEnvironmentVariables(templateData);
    envVars.forEach(envVar => variables.add(envVar));

    // Extract from node configurations
    const nodes = templateData?.graph?.nodes || [];
    nodes.forEach((node: any) => {
      this.extractVariablesFromNode(node, variables);
    });

    return Array.from(variables);
  }

  /**
   * Calculate complexity level based on node count and types
   */
  private calculateComplexity(nodeCount: number, nodeTypes: string[]): 'low' | 'medium' | 'high' {
    const complexNodeTypes = [
      'llm',
      'parallel-iteration',
      'sub-workflow',
      'circuit-breaker',
      'retry',
    ];
    const hasComplexNodes = nodeTypes.some(type => complexNodeTypes.includes(type));

    if (nodeCount <= 5 && !hasComplexNodes) {
      return 'low';
    } else if (nodeCount <= 10 || hasComplexNodes) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Estimate generated script length based on template characteristics
   */
  private estimateScriptLength(nodes: any[]): number {
    // Base script overhead (header, error handling, etc.)
    let lines = 25;

    // Per-node estimate
    nodes.forEach((node: any) => {
      switch (node.type) {
        case 'start':
        case 'end':
          lines += 2;
          break;
        case 'code':
          lines += 5;
          break;
        case 'llm':
        case 'http-request':
          lines += 8;
          break;
        case 'if-else':
          lines += 6;
          break;
        case 'loop':
        case 'iteration':
          lines += 10;
          break;
        case 'parallel-iteration':
          lines += 15;
          break;
        case 'retry':
        case 'circuit-breaker':
          lines += 12;
          break;
        default:
          lines += 4;
      }
    });

    return lines;
  }

  /**
   * Extract environment variables from template data
   */
  private extractEnvironmentVariables(templateData: any): string[] {
    const envVars: Set<string> = new Set();

    // Common environment variable patterns
    const envPatterns = [
      'OPENAI_API_KEY',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID',
      'ANTHROPIC_API_KEY',
      'COHERE_API_KEY',
      'DATABASE_URL',
      'WEBHOOK_URL',
      'API_KEY',
      'SECRET_KEY',
    ];

    // Search for environment variables in template content
    const templateStr = JSON.stringify(templateData);
    envPatterns.forEach(pattern => {
      if (templateStr.includes(pattern)) {
        envVars.add(pattern);
      }
    });

    // Extract from node data configurations
    const nodes = templateData?.graph?.nodes || [];
    nodes.forEach((node: any) => {
      this.extractEnvVarsFromNode(node, envVars);
    });

    return Array.from(envVars);
  }

  /**
   * Extract environment variables from a single node
   */
  private extractEnvVarsFromNode(node: any, envVars: Set<string>): void {
    const nodeStr = JSON.stringify(node);

    // Look for environment variable patterns in node data
    const envVarRegex = /[A-Z][A-Z0-9_]*_(?:KEY|TOKEN|URL|SECRET|ID|API)/g;
    const matches = nodeStr.match(envVarRegex);

    if (matches) {
      matches.forEach(match => envVars.add(match));
    }
  }

  /**
   * Extract variables from node configurations (including placeholders)
   */
  private extractVariablesFromNode(node: any, variables: Set<string>): void {
    // This is a simplified implementation
    // In a real implementation, you might want to traverse the node data more thoroughly
    const nodeStr = JSON.stringify(node);

    // Look for environment variables
    const envVarRegex = /[A-Z][A-Z0-9_]*(?:_KEY|_TOKEN|_URL|_SECRET|_ID|_API)/g;
    const envMatches = nodeStr.match(envVarRegex);

    if (envMatches) {
      envMatches.forEach(match => variables.add(match));
    }
  }
}

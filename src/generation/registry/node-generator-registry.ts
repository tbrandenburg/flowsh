/**
 * Node Generator Registry
 *
 * Central registry for managing node generators in an extensible way
 */

import { NodeGenerator, GenerationContext, RegistryError, NodeGeneratorError } from './types.js';
import { WorkflowNode } from '../../dsl/types.js';

/**
 * Registry for managing node generators with extensible architecture
 */
export class NodeGeneratorRegistry {
  private generators = new Map<string, NodeGenerator>();

  /**
   * Register a new node generator
   * @param generator - The generator to register
   * @throws {RegistryError} If generator is invalid or nodeType already registered
   */
  register(generator: NodeGenerator): void {
    if (!generator.nodeType) {
      throw new RegistryError('Generator must have a valid nodeType');
    }

    if (this.generators.has(generator.nodeType)) {
      throw new RegistryError(
        `Generator for node type '${generator.nodeType}' is already registered`
      );
    }

    this.generators.set(generator.nodeType, generator);
  }

  /**
   * Override an existing generator (for plugins or customization)
   * @param generator - The generator to register as override
   */
  override(generator: NodeGenerator): void {
    if (!generator.nodeType) {
      throw new RegistryError('Generator must have a valid nodeType');
    }

    this.generators.set(generator.nodeType, generator);
  }

  /**
   * Get generator for a specific node type
   * @param nodeType - The node type to get generator for
   * @returns The generator if found, undefined otherwise
   */
  get(nodeType: string): NodeGenerator | undefined {
    return this.generators.get(nodeType);
  }

  /**
   * Get generator for a specific node type, throwing if not found
   * @param nodeType - The node type to get generator for
   * @returns The generator
   * @throws {NodeGeneratorError} If no generator found for node type
   */
  getRequired(nodeType: string): NodeGenerator {
    const generator = this.generators.get(nodeType);
    if (!generator) {
      throw new NodeGeneratorError(`No generator registered for node type '${nodeType}'`, nodeType);
    }
    return generator;
  }

  /**
   * Check if a generator exists for the given node type
   * @param nodeType - The node type to check
   * @returns True if generator exists
   */
  has(nodeType: string): boolean {
    return this.generators.has(nodeType);
  }

  /**
   * Get all supported node types
   * @returns Array of supported node types
   */
  getSupportedTypes(): string[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Generate code for a node using registered generator
   * @param node - The node to generate code for
   * @param context - Generation context
   * @returns Generated shell script code
   * @throws {NodeGeneratorError} If no generator found or generation fails
   */
  generateNodeCode(node: WorkflowNode, context: GenerationContext): string {
    const generator = this.getRequired(node.type);

    try {
      return generator.generate(node, context);
    } catch (error) {
      throw new NodeGeneratorError(
        `Failed to generate code for node '${node.id}': ${error instanceof Error ? error.message : String(error)}`,
        node.type,
        node.id
      );
    }
  }

  /**
   * Validate a node using its registered generator (if validation is supported)
   * @param node - The node to validate
   * @returns Validation result, or undefined if generator doesn't support validation
   */
  validateNode(node: WorkflowNode) {
    const generator = this.get(node.type);
    if (!generator || !generator.validate) {
      return undefined;
    }

    try {
      return generator.validate(node);
    } catch (error) {
      // If validation throws, convert to validation result
      return {
        valid: false,
        errors: [
          {
            type: 'error' as const,
            code: 'GENERATOR_VALIDATION_ERROR',
            message: `Validation failed for node '${node.id}': ${error instanceof Error ? error.message : String(error)}`,
            nodeId: node.id,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Get variables used by a node (if generator supports it)
   * @param node - The node to analyze
   * @returns Array of variable names, empty if generator doesn't support variable analysis
   */
  getNodeVariables(node: WorkflowNode): string[] {
    const generator = this.get(node.type);
    if (!generator || !generator.getVariables) {
      return [];
    }

    try {
      return generator.getVariables(node);
    } catch (error) {
      // If variable extraction fails, return empty array and let validation catch it
      return [];
    }
  }

  /**
   * Clear all registered generators (mainly for testing)
   */
  clear(): void {
    this.generators.clear();
  }

  /**
   * Get count of registered generators
   */
  size(): number {
    return this.generators.size;
  }
}

// Default global registry instance
export const defaultRegistry = new NodeGeneratorRegistry();

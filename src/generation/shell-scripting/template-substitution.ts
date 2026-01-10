/**
 * Template Substitution Engine for flowsh
 *
 * This module handles substitution of {{variable}} syntax in workflow content
 * with resolved variable values. Keeps substitution simple and focused.
 */

import { ResolvedVariable } from '../../variables/types.js';

export interface SubstitutionContext {
  variables: Map<string, string>;
  preserveUnmatched?: boolean; // Keep unmatched {{vars}} as-is
  logUnmatched?: boolean; // Log warnings for unmatched variables
}

export class TemplateSubstitution {
  /**
   * Create substitution context from resolved variables
   */
  static createContext(
    resolvedVars: ResolvedVariable[],
    options: { preserveUnmatched?: boolean; logUnmatched?: boolean } = {}
  ): SubstitutionContext {
    const variables = new Map<string, string>();

    // Add resolved variables to context
    resolvedVars.forEach(variable => {
      if (variable.source !== 'required-missing') {
        variables.set(variable.name, variable.value);
        // Also add uppercase version for flexibility
        variables.set(variable.uppercase_name, variable.value);
      }
    });

    return {
      variables,
      preserveUnmatched: options.preserveUnmatched ?? false,
      logUnmatched: options.logUnmatched ?? true,
    };
  }

  /**
   * Substitute {{variable}} patterns in a string
   */
  static substitute(template: string, context: SubstitutionContext): string {
    if (!template || typeof template !== 'string') {
      return template || '';
    }

    // Match {{variable_name}} patterns (simple variables only, no complex logic)
    const variableRegex = /\{\{(\w+)\}\}/g;
    const unmatchedVars = new Set<string>();

    const result = template.replace(variableRegex, (match, variableName) => {
      const value = context.variables.get(variableName);

      if (value !== undefined) {
        return value;
      } else {
        unmatchedVars.add(variableName);
        if (context.preserveUnmatched) {
          return match; // Keep original {{variable}} syntax
        } else {
          return ''; // Replace with empty string
        }
      }
    });

    // Log unmatched variables if requested
    if (context.logUnmatched && unmatchedVars.size > 0) {
      const unmatchedList = Array.from(unmatchedVars).join(', ');
      console.warn(`Template substitution: Unmatched variables: ${unmatchedList}`);
    }

    return result;
  }

  /**
   * Substitute variables in multiple strings
   */
  static substituteMultiple(templates: string[], context: SubstitutionContext): string[] {
    return templates.map(template => this.substitute(template, context));
  }

  /**
   * Substitute variables in an object (recursively handles string values)
   */
  static substituteObject(obj: any, context: SubstitutionContext): any {
    if (typeof obj === 'string') {
      return this.substitute(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.substituteObject(item, context));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteObject(value, context);
      }
      return result;
    }

    return obj;
  }

  /**
   * Check if a string contains template variables
   */
  static hasTemplateVariables(str: string): boolean {
    if (!str || typeof str !== 'string') {
      return false;
    }
    return /\{\{\w+\}\}/.test(str);
  }

  /**
   * Extract template variable names from a string
   */
  static extractVariableNames(str: string): string[] {
    if (!str || typeof str !== 'string') {
      return [];
    }

    const matches = str.match(/\{\{(\w+)\}\}/g);
    if (!matches) {
      return [];
    }

    return matches
      .map(match => match.replace(/\{\{|\}\}/g, ''))
      .filter((name, index, array) => array.indexOf(name) === index); // Remove duplicates
  }

  /**
   * Validate that all template variables in a string can be resolved
   */
  static validateTemplate(
    template: string,
    availableVariables: string[]
  ): { valid: boolean; missing: string[] } {
    const required = this.extractVariableNames(template);
    const missing = required.filter(
      varName =>
        !availableVariables.includes(varName) && !availableVariables.includes(varName.toUpperCase())
    );

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Add node output variables to context (for workflow node outputs)
   */
  static addNodeOutputs(
    context: SubstitutionContext,
    nodeOutputs: Map<string, any>
  ): SubstitutionContext {
    const newContext = { ...context };
    const newVariables = new Map(context.variables);

    // Add node outputs with dot notation (node.output format)
    nodeOutputs.forEach((value, key) => {
      if (typeof value === 'string') {
        newVariables.set(key, value);
      } else if (value && typeof value === 'object') {
        // Flatten object properties
        Object.entries(value).forEach(([prop, propValue]) => {
          if (typeof propValue === 'string') {
            newVariables.set(`${key}.${prop}`, propValue);
          }
        });
      }
    });

    newContext.variables = newVariables;
    return newContext;
  }
}

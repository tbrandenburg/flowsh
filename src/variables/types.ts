/**
 * Variable Resolution Types for flowsh
 *
 * This module defines types for resolving conversation variables
 * from multiple sources (environment, defaults, CLI args).
 */

export interface ResolvedVariable {
  name: string;
  value: string;
  source: 'environment' | 'default' | 'cli-arg' | 'required-missing';
  uppercase_name: string; // USER_TOPIC for bash
}

export interface VariableResolutionConfig {
  use_defaults: boolean;
  fail_on_missing_required: boolean;
  variable_sources: VariableSource[];
}

export type VariableSource =
  | { type: 'environment' }
  | { type: 'defaults' }
  | { type: 'cli-args'; args: Record<string, string> };

export interface VariableResolutionError {
  variable: string;
  error: 'missing-required' | 'invalid-type' | 'validation-failed';
  message: string;
}

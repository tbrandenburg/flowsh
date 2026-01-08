/**
 * Template preview functionality for the flowsh init --preview feature
 *
 * Provides non-destructive template exploration by displaying template content
 * and metadata without creating files or directories.
 */

import { TemplateAnalyzer, TemplateMetadata } from './analyzer.js';
import { TemplateInfo } from './types.js';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

/**
 * Interface for template preview data
 */
export interface TemplatePreview {
  /** Template identifier */
  templateId: string;

  /** Template category (enhanced/advanced) */
  category: string;

  /** Template description from metadata */
  description: string;

  /** Raw template content */
  content: string;

  /** Template metadata and statistics */
  metadata: TemplateMetadata;

  /** List of placeholder variables found in template */
  placeholders: string[];

  /** Required environment variables */
  requiredVariables: string[];
}

/**
 * Generate a preview of a template with metadata and analysis
 */
export async function previewTemplate(templateInfo: TemplateInfo): Promise<TemplatePreview> {
  try {
    // Read template content
    const content = fs.readFileSync(templateInfo.filePath, 'utf8');

    // Parse YAML to extract metadata
    const templateData = yaml.load(content) as any;

    // Analyze template
    const analyzer = new TemplateAnalyzer();
    const metadata = analyzer.analyzeTemplate(templateData);

    // Extract placeholders (variables in {{}} format)
    const placeholders = extractPlaceholders(content);

    // Get required variables from template
    const requiredVariables = analyzer.extractRequiredVariables(templateData);

    return {
      templateId: templateInfo.displayName,
      category:
        templateInfo.category + (templateInfo.subcategory ? `/${templateInfo.subcategory}` : ''),
      description: templateInfo.description || 'No description available',
      content,
      metadata,
      placeholders,
      requiredVariables,
    };
  } catch (error: any) {
    throw new Error(`Failed to preview template ${templateInfo.name}: ${error.message}`);
  }
}

/**
 * Display template preview in a formatted, readable way
 */
export function displayTemplatePreview(preview: TemplatePreview): void {
  console.log(`# Template: ${preview.templateId}`);
  console.log(`# Category: ${preview.category}`);
  console.log(`# Description: ${preview.description}`);
  console.log(
    `# Complexity: ${capitalizeFirst(preview.metadata.complexity)} (${preview.metadata.nodeCount} nodes, ${preview.metadata.edgeCount} edges)`
  );

  if (preview.requiredVariables.length > 0) {
    console.log(`# Required Variables: ${preview.requiredVariables.join(', ')}`);
  }

  console.log(`# Estimated Script Length: ~${preview.metadata.estimatedScriptLines} lines`);

  if (preview.metadata.nodeTypes.length > 0) {
    console.log(`# Node Types: ${preview.metadata.nodeTypes.join(', ')}`);
  }

  console.log('');
  console.log(highlightPlaceholders(preview.content, preview.placeholders));
}

/**
 * Extract placeholder variables from template content ({{variable}} and ${variable} formats)
 */
function extractPlaceholders(content: string): string[] {
  const placeholders: Set<string> = new Set();

  // Extract {{variable}} format
  const doubleBraceRegex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = doubleBraceRegex.exec(content)) !== null) {
    if (match[1]) {
      placeholders.add(match[1].trim());
    }
  }

  // Extract ${variable} format
  const dollarBraceRegex = /\$\{([^}]+)\}/g;
  while ((match = dollarBraceRegex.exec(content)) !== null) {
    if (match[1]) {
      placeholders.add(match[1].trim());
    }
  }

  return Array.from(placeholders);
}

/**
 * Highlight placeholder variables in template content for preview display
 */
function highlightPlaceholders(content: string, placeholders: string[]): string {
  let highlighted = content;

  // Add comments to highlight placeholders - handle both {{}} and ${} formats
  placeholders.forEach(placeholder => {
    // Handle {{placeholder}} format
    const doubleBraceRegex = new RegExp(`\\{\\{${escapeRegex(placeholder)}\\}\\}`, 'g');
    highlighted = highlighted.replace(
      doubleBraceRegex,
      `{{${placeholder}}} # ← Placeholder variable`
    );

    // Handle ${placeholder} format
    const dollarBraceRegex = new RegExp(`\\$\\{${escapeRegex(placeholder)}\\}`, 'g');
    highlighted = highlighted.replace(
      dollarBraceRegex,
      `\${${placeholder}} # ← Placeholder variable`
    );
  });

  return highlighted;
}

/**
 * Escape regex special characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

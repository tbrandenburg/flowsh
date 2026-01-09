/**
 * Template preview functionality for the flowsh init --preview feature
 *
 * Provides non-destructive template exploration by displaying template content
 * and metadata without creating files or directories.
 */

import { TemplateAnalyzer, extractPlaceholders, highlightPlaceholders } from './analyzer.js';
import { TemplateInfo, TemplatePreview } from './types.js';
import { TemplateDiscovery } from './discovery.js';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import * as fs from 'fs';

/**
 * Preview a template by its ID
 */
export async function previewTemplateById(templateId: string): Promise<TemplatePreview> {
  const discovery = new TemplateDiscovery();
  await discovery.scanTemplates();

  // Find the template by display name
  const template = discovery.getTemplateByName(templateId);
  if (!template) {
    const available = discovery.getAvailableTemplateNames();
    throw new Error(
      `Template '${templateId}' not found. Available templates: ${available.join(', ')}`
    );
  }

  return previewTemplate(template);
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
      category: templateInfo.category,
      ...(templateInfo.subcategory && { subcategory: templateInfo.subcategory }),
      description:
        templateInfo.description ||
        templateData?.workflow?.description ||
        'No description available',
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
 * Format template preview as human-readable text
 */
export function formatPreviewAsText(preview: TemplatePreview): string {
  const lines: string[] = [];

  // Header
  lines.push(chalk.cyan(`# Template: ${preview.templateId}`));
  lines.push(
    chalk.gray(
      `# Category: ${preview.category}${preview.subcategory ? ` > ${preview.subcategory}` : ''}`
    )
  );
  lines.push(chalk.gray(`# Description: ${preview.description}`));

  // Metadata
  lines.push(
    chalk.gray(
      `# Complexity: ${preview.metadata.complexity.toUpperCase()} (${preview.metadata.nodeCount} nodes, ${preview.metadata.edgeCount} edges)`
    )
  );

  if (preview.metadata.nodeTypes.length > 0) {
    lines.push(chalk.gray(`# Node Types: ${preview.metadata.nodeTypes.join(', ')}`));
  }

  if (preview.requiredVariables.length > 0) {
    lines.push(chalk.gray(`# Required Variables: ${preview.requiredVariables.join(', ')}`));
  }

  lines.push(
    chalk.gray(`# Estimated Script Length: ~${preview.metadata.estimatedScriptLines} lines`)
  );
  lines.push('');

  // Content with highlighted placeholders
  const highlighted = highlightPlaceholders(preview.content);
  lines.push(highlighted);

  return lines.join('\n');
}

/**
 * Format template preview as JSON
 */
export function formatPreviewAsJSON(preview: TemplatePreview): string {
  const jsonData = {
    templateId: preview.templateId,
    category: preview.category,
    subcategory: preview.subcategory,
    description: preview.description,
    metadata: preview.metadata,
    placeholders: preview.placeholders,
    requiredVariables: preview.requiredVariables,
    contentLength: preview.content.length,
    // Note: we don't include full content in JSON mode to keep output manageable
    // Users can use text mode to see full content
  };

  return JSON.stringify(jsonData, null, 2);
}

/**
 * Display template preview in a formatted, readable way (legacy function)
 */
export function displayTemplatePreview(preview: TemplatePreview): void {
  console.log(formatPreviewAsText(preview));
}

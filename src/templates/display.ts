import type { HierarchicalTemplates, TemplateInfo } from './types.js';

/**
 * Template display system that formats templates for CLI output
 * in a hierarchical, user-friendly format
 */
export class TemplateDisplay {
  /**
   * Display the main help message with usage and available templates
   */
  static displayHelp(templates: HierarchicalTemplates): void {
    console.log('Usage:');
    console.log('  flowsh init [TEMPLATE] [TARGET_FILE]');
    console.log('');
    console.log('Available templates:');

    this.displayHierarchicalTemplates(templates);
  }

  /**
   * Display templates in hierarchical format
   */
  private static displayHierarchicalTemplates(templates: HierarchicalTemplates): void {
    // Display enhanced templates
    if (templates.enhanced.length > 0) {
      console.log('  enhanced:');
      for (const template of templates.enhanced) {
        this.displayTemplate(template, '    ');
      }
      console.log('');
    }

    // Display advanced templates by subcategory
    if (Object.keys(templates.advanced).length > 0) {
      console.log('  advanced:');

      const subcategories = Object.keys(templates.advanced).sort();
      for (const subcategory of subcategories) {
        const templateList = templates.advanced[subcategory];
        if (templateList && templateList.length > 0) {
          console.log(`    ${subcategory}:`);
          for (const template of templateList) {
            this.displayTemplate(template, '      ');
          }
        }
      }
    }
  }

  /**
   * Display a single template with optional description
   */
  private static displayTemplate(template: TemplateInfo, indent: string): void {
    let output = `${indent}- ${template.displayName}`;

    if (template.description) {
      // Truncate description if too long for terminal display
      const maxDescLength = 60;
      let desc = template.description;
      if (desc.length > maxDescLength) {
        desc = desc.substring(0, maxDescLength - 3) + '...';
      }
      output += ` (${desc})`;
    }

    console.log(output);
  }

  /**
   * Display error message when template is not found
   */
  static displayTemplateNotFound(templateName: string, availableTemplates: string[]): void {
    console.error(`❌ Error: Template '${templateName}' not found.`);
    console.error('');

    // Show first few available templates as examples
    console.error('Available templates:');
    const examples = availableTemplates.slice(0, 8);
    examples.forEach(name => console.error(`  - ${name}`));

    if (availableTemplates.length > 8) {
      console.error(`  ... and ${availableTemplates.length - 8} more`);
      console.error('');
      console.error('Run "flowsh init" to see all available templates');
    }

    // Suggest similar templates if available
    const suggestions = this.findSimilarTemplates(templateName, availableTemplates);
    if (suggestions.length > 0) {
      console.error('');
      console.error('Did you mean:');
      suggestions.slice(0, 3).forEach(suggestion => {
        console.error(`  flowsh init ${suggestion} [TARGET_FILE]`);
      });
    }
  }

  /**
   * Display success message after template creation
   */
  static displaySuccess(templateName: string, targetFile: string): void {
    console.log(`✅ Workflow created from template '${templateName}': ${targetFile}`);
    console.log(`💡 Run 'flowsh validate ${targetFile}' to verify`);
    console.log(`🚀 Run 'flowsh compile ${targetFile}' to generate script`);
  }

  /**
   * Display validation error with helpful context
   */
  static displayValidationError(error: string, validationErrors?: string[]): void {
    console.error(`❌ Template validation failed: ${error}`);

    if (validationErrors && validationErrors.length > 0) {
      console.error('');
      console.error('Validation errors:');
      validationErrors.forEach(err => {
        console.error(`   → ${err}`);
      });
    }

    console.error('');
    console.error('💡 This template may have issues. Please report this at:');
    console.error('   https://github.com/tbrandenburg/flowsh/issues');
  }

  /**
   * Display processing error with suggestions
   */
  static displayProcessingError(error: string, targetFile?: string): void {
    console.error(`❌ Template processing failed: ${error}`);

    if (targetFile) {
      console.error('');
      console.error('Troubleshooting:');
      console.error(`   → Check if directory exists: ${require('path').dirname(targetFile)}`);
      console.error(`   → Verify write permissions for: ${targetFile}`);
      console.error('   → Ensure sufficient disk space');
    }
  }

  /**
   * Find templates with similar names for suggestions
   */
  private static findSimilarTemplates(target: string, available: string[]): string[] {
    const suggestions: Array<{ name: string; score: number }> = [];

    for (const template of available) {
      const score = this.calculateSimilarity(target.toLowerCase(), template.toLowerCase());
      if (score > 0.4) {
        // Similarity threshold
        suggestions.push({ name: template, score });
      }
    }

    // Sort by similarity score (descending) and return template names
    return suggestions.sort((a, b) => b.score - a.score).map(s => s.name);
  }

  /**
   * Calculate similarity between two strings (simplified)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    // Simple substring matching for similar template names
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;

    // Check if they start with the same prefix
    const minLength = Math.min(str1.length, str2.length);
    let commonPrefix = 0;
    for (let i = 0; i < minLength; i++) {
      if (str1[i] === str2[i]) {
        commonPrefix++;
      } else {
        break;
      }
    }

    const prefixScore = commonPrefix / Math.max(str1.length, str2.length);
    return prefixScore > 0.5 ? prefixScore : 0;
  }
}

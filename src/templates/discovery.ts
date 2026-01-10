import type { TemplateInfo, HierarchicalTemplates } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Template discovery system that scans the templates directory
 * and builds a searchable index of available templates
 */
export class TemplateDiscovery {
  private static readonly TEMPLATES_DIR = 'templates';

  private templateCache = new Map<string, TemplateInfo>();

  /**
   * Scan the templates directory and build the template index
   */
  async scanTemplates(): Promise<void> {
    const templateFiles = await this.findYamlFiles(TemplateDiscovery.TEMPLATES_DIR);

    this.templateCache.clear();

    for (const filePath of templateFiles) {
      try {
        const templateInfo = await this.parseTemplateInfo(filePath);
        await this.addTemplateToCache(templateInfo);
      } catch (error) {
        // Log warning but continue processing other templates
        console.warn(`Warning: Failed to parse template ${filePath}: ${error}`);
      }
    }
  }

  /**
   * Get template by name, supporting multiple lookup formats
   */
  getTemplateByName(name: string): TemplateInfo | undefined {
    // Try exact match first
    let template = this.templateCache.get(name);
    if (template) return template;

    // Try with common variations
    const variations = [
      name,
      `${name}-template`,
      name.replace('-template', ''),
      `${name}.yaml`,
      name.replace('.yaml', ''),
    ];

    for (const variation of variations) {
      template = this.templateCache.get(variation);
      if (template) return template;
    }

    return undefined;
  }

  /**
   * Get all templates in hierarchical format for display
   */
  getHierarchicalDisplay(): HierarchicalTemplates {
    const basic: TemplateInfo[] = [];
    const enhanced: TemplateInfo[] = [];
    const advanced: { [subcategory: string]: TemplateInfo[] } = {};

    // Get unique templates by file path to avoid duplicates from multiple cache keys
    const uniqueTemplates = this.getUniqueTemplates();

    for (const template of uniqueTemplates) {
      if (template.category === 'basic') {
        basic.push(template);
      } else if (template.category === 'enhanced') {
        enhanced.push(template);
      } else if (template.category === 'advanced') {
        const subcategory = template.subcategory || 'miscellaneous';
        if (!advanced[subcategory]) {
          advanced[subcategory] = [];
        }
        advanced[subcategory].push(template);
      }
    }

    // Sort templates within each category by display name
    basic.sort((a, b) => a.displayName.localeCompare(b.displayName));
    enhanced.sort((a, b) => a.displayName.localeCompare(b.displayName));

    for (const subcategory in advanced) {
      if (advanced[subcategory]) {
        advanced[subcategory].sort((a, b) => a.displayName.localeCompare(b.displayName));
      }
    }

    return { basic, enhanced, advanced };
  }

  /**
   * Get unique templates by filtering duplicates based on file path
   */
  private getUniqueTemplates(): TemplateInfo[] {
    const uniqueByPath = new Map<string, TemplateInfo>();

    for (const template of this.templateCache.values()) {
      uniqueByPath.set(template.filePath, template);
    }

    return Array.from(uniqueByPath.values());
  }

  /**
   * Get all available template names for error messages and suggestions
   */
  getAvailableTemplateNames(): string[] {
    return this.getUniqueTemplates()
      .map(template => template.displayName)
      .sort();
  }

  /**
   * Get template count for diagnostics
   */
  getTemplateCount(): number {
    return this.getUniqueTemplates().length;
  }

  /**
   * Get all templates with full details for listing
   */
  getAllTemplates(): TemplateInfo[] {
    return this.getUniqueTemplates();
  }

  /**
   * Search templates by keyword in name, category, or description
   */
  searchTemplates(query: string): TemplateInfo[] {
    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) {
      return this.getAllTemplates();
    }

    return this.getUniqueTemplates().filter(template => {
      // Search in display name
      if (template.displayName.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in category
      if (template.category?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in subcategory
      if (template.subcategory?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in description
      if (template.description?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Recursively find all .yaml files in a directory
   */
  private async findYamlFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories that shouldn't contain templates
          if (!['node_modules', '.git', '.vscode', 'dist', 'build'].includes(entry.name)) {
            const subResults = await this.findYamlFiles(fullPath);
            results.push(...subResults);
          }
        } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
          results.push(path.resolve(fullPath));
        }
      }
    } catch (error) {
      console.warn(`Warning: Cannot read directory ${dir}: ${error}`);
    }

    return results;
  }

  /**
   * Parse template information from file path
   */
  private async parseTemplateInfo(filePath: string): Promise<TemplateInfo> {
    const relativePath = path.relative(TemplateDiscovery.TEMPLATES_DIR, filePath);
    const pathParts = relativePath.split(path.sep);
    const fileName = path.basename(filePath, '.yaml');

    // Determine category and subcategory from path
    const category = pathParts[0] || 'unknown';
    const subcategory = pathParts.length > 2 ? pathParts[1] : undefined;

    // Create display name by removing common suffixes
    let displayName = fileName;
    if (displayName.endsWith('-template')) {
      displayName = displayName.slice(0, -9); // Remove '-template'
    }

    const description = await this.extractDescription(filePath);

    const templateInfo: TemplateInfo = {
      name: fileName,
      displayName,
      filePath,
      category,
    };

    if (subcategory) {
      templateInfo.subcategory = subcategory;
    }

    if (description) {
      templateInfo.description = description;
    }

    return templateInfo;
  }

  /**
   * Add template to cache with multiple lookup keys for user convenience
   */
  private async addTemplateToCache(templateInfo: TemplateInfo): Promise<void> {
    // Create multiple lookup keys for flexible searching
    const lookupKeys = new Set([
      templateInfo.name, // circuit-breaker-template
      templateInfo.displayName, // circuit-breaker
      `${templateInfo.name}.yaml`, // circuit-breaker-template.yaml
      `${templateInfo.displayName}.yaml`, // circuit-breaker.yaml
    ]);

    // Add category-prefixed versions for disambiguation if needed
    lookupKeys.add(`${templateInfo.category}/${templateInfo.displayName}`);
    if (templateInfo.subcategory) {
      lookupKeys.add(`${templateInfo.subcategory}/${templateInfo.displayName}`);
      lookupKeys.add(
        `${templateInfo.category}/${templateInfo.subcategory}/${templateInfo.displayName}`
      );
    }

    // Check for conflicts and warn
    for (const key of lookupKeys) {
      const existing = this.templateCache.get(key);
      if (existing && existing.filePath !== templateInfo.filePath) {
        console.warn(
          `Warning: Template name conflict for '${key}': ${existing.filePath} vs ${templateInfo.filePath}`
        );
      }
    }

    // Add all lookup keys to cache
    lookupKeys.forEach(key => {
      this.templateCache.set(key, templateInfo);
    });
  }

  /**
   * Extract description from template YAML metadata
   */
  private async extractDescription(filePath: string): Promise<string | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Look for description in workflow metadata
      const workflowDescMatch = content.match(
        /workflow:\s*\n(?:[^\n]*\n)*?\s*description:\s*['"]([^'"]+)['"]/
      );
      if (workflowDescMatch && workflowDescMatch[1]) {
        return workflowDescMatch[1];
      }

      // Look for top-level description
      const topLevelDescMatch = content.match(/^description:\s*['"]([^'"]+)['"]/m);
      if (topLevelDescMatch && topLevelDescMatch[1]) {
        return topLevelDescMatch[1];
      }

      // Look for comment-based description
      const commentDescMatch = content.match(/^#\s*Description:\s*(.+)$/m);
      if (commentDescMatch && commentDescMatch[1]) {
        return commentDescMatch[1].trim();
      }

      return undefined;
    } catch {
      // If we can't read the file or parse description, that's okay
      return undefined;
    }
  }
}

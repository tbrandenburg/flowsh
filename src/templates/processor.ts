import { createSuccessResult, createErrorResult } from './types.js';
import type { TemplateInfo, ProcessResult } from './types.js';
import { parseWorkflowFile } from '../parsing/parser.js';
import { FileOperations } from './file-operations.js';
import * as path from 'path';

/**
 * Template processor that handles validation, content processing,
 * and file creation with comprehensive error handling
 */
export class TemplateProcessor {
  private fileOps: FileOperations;

  constructor() {
    this.fileOps = new FileOperations();
  }

  /**
   * Process a template by copying and optionally modifying it
   */
  async processTemplate(
    templateInfo: TemplateInfo,
    targetPath: string,
    options: {
      overwrite?: boolean;
      stripComments?: boolean;
      validateTemplate?: boolean;
      validateResult?: boolean;
    } = {}
  ): Promise<ProcessResult> {
    const {
      overwrite = true,
      stripComments = true,
      validateTemplate = true,
      validateResult = true,
    } = options;

    try {
      // Step 1: Validate target path for security
      this.fileOps.validateFilePath(targetPath);

      // Step 2: Validate template integrity if requested
      if (validateTemplate) {
        const templateValidation = await this.validateTemplate(templateInfo.filePath);
        if (!templateValidation.success) {
          return createErrorResult(
            `Template validation failed: ${templateValidation.error}`,
            templateValidation.validationErrors
          );
        }
      }

      // Step 3: Read and process template content
      const content = await this.fileOps.readFile(templateInfo.filePath);
      const processedContent = stripComments ? this.stripTemplateComments(content) : content;

      // Step 4: Write processed template to target location
      await this.fileOps.writeFile(targetPath, processedContent, overwrite);

      // Step 5: Validate result if requested
      if (validateResult) {
        const resultValidation = await this.validateTemplate(targetPath);
        if (!resultValidation.success) {
          return createErrorResult(
            `Generated file validation failed: ${resultValidation.error}`,
            resultValidation.validationErrors
          );
        }
      }

      return createSuccessResult(path.resolve(targetPath));
    } catch (error: any) {
      return createErrorResult(`Template processing failed: ${error.message}`);
    }
  }

  /**
   * Validate a template file using the existing flowsh validation engine
   */
  private async validateTemplate(filePath: string): Promise<ProcessResult> {
    try {
      const parseResult = await parseWorkflowFile(filePath, {
        validate: true,
        strict: false,
      });

      if (!parseResult.success) {
        const errors = parseResult.errors.map(e => e.message);
        return createErrorResult('Template validation failed', errors);
      }

      return createSuccessResult(filePath);
    } catch (error: any) {
      return createErrorResult(`Validation error: ${error.message}`);
    }
  }

  /**
   * Strip template-specific comments while preserving essential workflow comments
   */
  private stripTemplateComments(content: string): string {
    const lines = content.split('\n');
    const processedLines: string[] = [];

    for (const line of lines) {
      // Skip comments that are template-specific
      if (this.isTemplateComment(line)) {
        continue;
      }

      // Keep the line as-is
      processedLines.push(line);
    }

    return processedLines.join('\n');
  }

  /**
   * Determine if a comment line is template-specific and should be removed
   */
  private isTemplateComment(line: string): boolean {
    const trimmedLine = line.trim();

    // Don't remove non-comment lines
    if (!trimmedLine.startsWith('#')) {
      return false;
    }

    // Template-specific comment patterns to remove
    const templatePatterns = [
      /^#\s*template:/i,
      /^#\s*this is a template/i,
      /^#\s*template description:/i,
      /^#\s*usage:/i,
      /^#\s*replace.*with/i,
      /^#\s*customize.*for/i,
      /^#\s*todo:/i,
      /^#\s*note:/i,
      /^#\s*example usage/i,
      /^#\s*template version/i,
    ];

    // Check if line matches any template pattern
    for (const pattern of templatePatterns) {
      if (pattern.test(trimmedLine)) {
        return true;
      }
    }

    // Keep workflow-related comments
    const workflowPatterns = [
      /^#\s*workflow/i,
      /^#\s*description/i,
      /^#\s*important/i,
      /^#\s*warning/i,
      /^#\s*security/i,
      /^#\s*configuration/i,
    ];

    for (const pattern of workflowPatterns) {
      if (pattern.test(trimmedLine)) {
        return false;
      }
    }

    // For generic comments, be conservative and keep them
    // unless they're clearly template instructions
    if (
      trimmedLine.includes('change') ||
      trimmedLine.includes('modify') ||
      trimmedLine.includes('replace') ||
      trimmedLine.includes('customize')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get processing statistics for diagnostics
   */
  async getProcessingStats(templateInfo: TemplateInfo): Promise<{
    originalSize: number;
    templateComments: number;
    workflowNodes: number;
  }> {
    try {
      const content = await this.fileOps.readFile(templateInfo.filePath);
      const lines = content.split('\n');

      const originalSize = content.length;
      const templateComments = lines.filter(line => this.isTemplateComment(line)).length;

      // Count workflow nodes (rough estimate)
      const nodeMatches = content.match(/^\s*-\s+id:\s*['"]?[^'"]+['"]?$/gm) || [];
      const workflowNodes = nodeMatches.length;

      return {
        originalSize,
        templateComments,
        workflowNodes,
      };
    } catch {
      return {
        originalSize: 0,
        templateComments: 0,
        workflowNodes: 0,
      };
    }
  }
}

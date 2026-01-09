import { TemplateProcessor } from './processor.js';
import { TemplateDiscovery } from './discovery.js';
import { TemplateDisplay } from './display.js';

/**
 * Main init command implementation that orchestrates template discovery,
 * processing, and user interaction following flowsh CLI patterns
 */

/**
 * Handle the init command with proper error handling and user feedback
 */
export async function initCommand(
  template?: string,
  target?: string,
  options?: {
    help?: boolean;
    preview?: boolean;
    listTemplates?: boolean;
    search?: string;
  }
): Promise<void> {
  const discovery = new TemplateDiscovery();

  try {
    // Always scan templates first to ensure we have the latest
    await discovery.scanTemplates();

    // Case 1: List templates mode
    if (options?.listTemplates) {
      const templates = discovery.getAllTemplates();
      TemplateDisplay.displayDetailedList(templates);
      return;
    }

    // Case 2: Search templates mode
    if (options?.search) {
      const templates = discovery.searchTemplates(options.search);
      TemplateDisplay.displaySearchResults(options.search, templates);
      return;
    }

    // Case 3: No arguments or --help - show template listing
    if (!template || options?.help) {
      const hierarchical = discovery.getHierarchicalDisplay();
      TemplateDisplay.displayHelp(hierarchical);
      return;
    }

    // Case 4: Preview mode - show template content without creating files
    if (options?.preview) {
      const templateInfo = discovery.getTemplateByName(template);
      if (!templateInfo) {
        const availableTemplates = discovery.getAvailableTemplateNames();
        TemplateDisplay.displayTemplateNotFound(template, availableTemplates);
        process.exit(1);
      }

      // Import preview functionality dynamically to avoid circular imports during build
      const { previewTemplate, displayTemplatePreview } = await import('./preview.js');

      try {
        const preview = await previewTemplate(templateInfo);
        displayTemplatePreview(preview);
        return;
      } catch (previewError: any) {
        console.error(`❌ Preview failed: ${previewError.message}`);
        process.exit(1);
      }
    }

    // Case 5: Missing target argument (when not in preview mode)
    if (!target) {
      console.error('❌ Error: Missing required parameter TARGET_FILE');
      console.error('Usage: flowsh init [TEMPLATE] [TARGET_FILE]');
      console.error('       flowsh init [TEMPLATE] --preview');
      console.error('       flowsh init --list-templates');
      console.error('       flowsh init --search <query>');
      process.exit(1);
    }

    // Case 6: Template creation workflow
    const templateInfo = discovery.getTemplateByName(template);
    if (!templateInfo) {
      const availableTemplates = discovery.getAvailableTemplateNames();
      TemplateDisplay.displayTemplateNotFound(template, availableTemplates);
      process.exit(1);
    }

    // Process the template
    const processor = new TemplateProcessor();

    try {
      const result = await processor.processTemplate(templateInfo, target, {
        overwrite: true, // Follow Unix philosophy - overwrite without prompts
        stripComments: true, // Clean up template-specific comments
        validateTemplate: true, // Ensure template is valid
        validateResult: true, // Ensure result is valid
      });

      if (result.success && result.filePath) {
        TemplateDisplay.displaySuccess(template, result.filePath);
      } else {
        // Handle processing errors
        if (result.validationErrors && result.validationErrors.length > 0) {
          TemplateDisplay.displayValidationError(
            result.error || 'Validation failed',
            result.validationErrors
          );
        } else {
          TemplateDisplay.displayProcessingError(result.error || 'Processing failed', target);
        }
        process.exit(1);
      }
    } catch (processingError: any) {
      TemplateDisplay.displayProcessingError(processingError.message, target);
      process.exit(1);
    }
  } catch (discoveryError: any) {
    handleError(discoveryError, 'Template discovery');
  }
}

/**
 * Error handler that follows existing flowsh patterns
 */
function handleError(error: unknown, operation: string): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ ${operation} failed: ${message}`);
  process.exit(1);
}

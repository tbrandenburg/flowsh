/**
 * Terminal User Interface (TUI) utilities for flowsh
 * Provides colorful, geeky aesthetics with interactive elements
 */

import gradient from 'gradient-string';
import cliProgress from 'cli-progress';
import ora, { Ora } from 'ora';
import figlet from 'figlet';
import chalk from 'chalk';
import boxen from 'boxen';

// Harmonic color palette following flowsh design guidelines
export const colors = {
  // Primary brand colors
  primary: chalk.hex('#00D9FF'), // Cyan - main accent
  secondary: chalk.hex('#FF6B6B'), // Coral - secondary accent
  success: chalk.hex('#51CF66'), // Green - success states
  warning: chalk.hex('#FFD43B'), // Yellow - warnings
  error: chalk.hex('#FF6B6B'), // Red - errors

  // Neutral colors
  text: chalk.hex('#E9ECEF'), // Light gray - primary text
  muted: chalk.hex('#868E96'), // Gray - secondary text
  subtle: chalk.hex('#495057'), // Dark gray - subtle elements

  // Syntax highlighting colors (for code/YAML display)
  keyword: chalk.hex('#FF79C6'), // Pink - keywords
  string: chalk.hex('#F1FA8C'), // Yellow - strings
  number: chalk.hex('#BD93F9'), // Purple - numbers
  comment: chalk.hex('#6272A4'), // Blue-gray - comments

  // Special semantic colors
  node: chalk.hex('#50FA7B'), // Bright green - workflow nodes
  edge: chalk.hex('#8BE9FD'), // Light cyan - workflow edges
  variable: chalk.hex('#FFB86C'), // Orange - variables
} as const;

// Gradient themes for special effects
export const gradients = {
  primary: gradient(['#00D9FF', '#FF6B6B']) as any,
  success: gradient(['#51CF66', '#69DB7C']) as any,
  rainbow: gradient(['#FF6B6B', '#FFD43B', '#51CF66', '#00D9FF', '#BD93F9']) as any,
  matrix: gradient(['#00FF00', '#008F11']) as any,
  fire: gradient(['#FF6B6B', '#FFD43B', '#FF8E53']) as any,
} as const;

// ASCII Art and Branding
export class FlowshBranding {
  static readonly logo = figlet.textSync('flowsh', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });

  static readonly miniLogo = figlet.textSync('flowsh', {
    font: 'Small',
    horizontalLayout: 'fitted',
    verticalLayout: 'default',
  });

  static displayLogo(): void {
    console.log(gradients.primary(this.logo));
    console.log(colors.muted('  AI Workflow-to-Shell Generator'));
    console.log(colors.subtle('  ────────────────────────────────\n'));
  }

  static displayMiniLogo(): void {
    console.log(gradients.primary(this.miniLogo) + colors.muted(' v1.0.0'));
  }

  static displayBanner(message: string): void {
    const box = boxen(gradients.rainbow(message), {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan',
      backgroundColor: '#1a1a1a',
    });
    console.log(box);
  }
}

// Progress Indicators
export class ProgressIndicator {
  private spinner: Ora | null = null;
  private progressBar: cliProgress.SingleBar | null = null;

  // Spinner configurations for different operations
  static readonly spinners = {
    parsing: { text: 'Parsing YAML workflow...', spinner: 'dots12' },
    validating: { text: 'Validating workflow structure...', spinner: 'arc' },
    generating: { text: 'Generating shell script...', spinner: 'dots' },
    optimizing: { text: 'Optimizing performance...', spinner: 'clock' },
    templating: { text: 'Resolving templates...', spinner: 'bouncingBall' },
    visualizing: { text: 'Creating visualization...', spinner: 'star' },
  } as const;

  startSpinner(operation: keyof typeof ProgressIndicator.spinners): void {
    const config = ProgressIndicator.spinners[operation];
    this.spinner = ora({
      text: colors.primary(config.text),
      spinner: config.spinner as any,
      color: 'cyan',
    }).start();
  }

  updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = colors.primary(text);
    }
  }

  succeedSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(colors.success(message));
      this.spinner = null;
    }
  }

  failSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.fail(colors.error(message));
      this.spinner = null;
    }
  }

  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  startProgressBar(total: number, label: string): void {
    this.progressBar = new cliProgress.SingleBar(
      {
        format:
          colors.primary(label + ' |') +
          colors.success('{bar}') +
          colors.primary('| {percentage}% | {value}/{total} | {eta}s'),
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic
    );

    this.progressBar.start(total, 0);
  }

  updateProgressBar(value: number): void {
    if (this.progressBar) {
      this.progressBar.update(value);
    }
  }

  completeProgressBar(): void {
    if (this.progressBar) {
      this.progressBar.stop();
      this.progressBar = null;
    }
  }
}

// Formatted Output Utilities
export class OutputFormatter {
  static header(text: string): void {
    console.log('\n' + colors.primary('▶ ') + colors.text(text));
  }

  static subheader(text: string): void {
    console.log(colors.secondary('  ◆ ') + colors.muted(text));
  }

  static success(text: string): void {
    console.log(colors.success('✓ ') + colors.text(text));
  }

  static warning(text: string): void {
    console.log(colors.warning('⚠ ') + colors.text(text));
  }

  static error(text: string): void {
    console.log(colors.error('✗ ') + colors.text(text));
  }

  static info(text: string): void {
    console.log(colors.primary('ℹ ') + colors.text(text));
  }

  static code(text: string): void {
    console.log(colors.subtle('  │ ') + colors.variable(text));
  }

  static list(items: string[]): void {
    items.forEach(item => {
      console.log(colors.muted('  • ') + colors.text(item));
    });
  }

  static keyValue(key: string, value: string | number): void {
    console.log(colors.muted(`  ${key}: `) + colors.primary(String(value)));
  }

  static separator(): void {
    console.log(colors.subtle('─'.repeat(50)));
  }

  static section(title: string, content: () => void): void {
    this.header(title);
    content();
    console.log();
  }
}

// Performance Metrics Visualization
export class PerformanceVisualizer {
  static displayMetrics(metrics: {
    parseTime?: number;
    generateTime?: number;
    totalTime?: number;
    nodeCount?: number;
    memoryUsage?: number;
    cacheHitRate?: number;
  }): void {
    OutputFormatter.section('Performance Metrics', () => {
      if (metrics.parseTime !== undefined) {
        this.displayBar('Parse Time', metrics.parseTime, 1000, 'ms');
      }
      if (metrics.generateTime !== undefined) {
        this.displayBar('Generate Time', metrics.generateTime, 2000, 'ms');
      }
      if (metrics.totalTime !== undefined) {
        this.displayBar('Total Time', metrics.totalTime, 3000, 'ms');
      }
      if (metrics.nodeCount !== undefined) {
        OutputFormatter.keyValue('Nodes Processed', metrics.nodeCount);
      }
      if (metrics.memoryUsage !== undefined) {
        this.displayBar('Memory Usage', metrics.memoryUsage, 100, 'MB');
      }
      if (metrics.cacheHitRate !== undefined) {
        this.displayBar('Cache Hit Rate', metrics.cacheHitRate, 100, '%');
      }
    });
  }

  private static displayBar(label: string, value: number, max: number, unit: string): void {
    const percentage = Math.min((value / max) * 100, 100);
    const barLength = 20;
    const filledLength = Math.round((percentage / 100) * barLength);
    const emptyLength = barLength - filledLength;

    const bar = colors.success('█'.repeat(filledLength)) + colors.subtle('░'.repeat(emptyLength));

    const coloredValue =
      percentage > 80
        ? colors.warning(String(value))
        : percentage > 95
          ? colors.error(String(value))
          : colors.success(String(value));

    console.log(
      colors.muted(`  ${label.padEnd(15)}: `) + bar + ' ' + coloredValue + colors.muted(unit)
    );
  }
}

// Workflow Visualization in Terminal
export class WorkflowVisualizer {
  static displayWorkflowSummary(workflow: {
    name?: string;
    nodeCount: number;
    edgeCount: number;
    nodeTypes: Record<string, number>;
  }): void {
    OutputFormatter.section('Workflow Summary', () => {
      if (workflow.name) {
        OutputFormatter.keyValue('Name', workflow.name);
      }
      OutputFormatter.keyValue('Nodes', workflow.nodeCount);
      OutputFormatter.keyValue('Edges', workflow.edgeCount);

      console.log(colors.muted('\n  Node Types:'));
      Object.entries(workflow.nodeTypes).forEach(([type, count]) => {
        const icon = this.getNodeTypeIcon(type);
        console.log(
          colors.subtle('    ') +
            colors.node(icon) +
            ' ' +
            colors.text(type.padEnd(12)) +
            colors.primary(`×${count}`)
        );
      });
    });
  }

  private static getNodeTypeIcon(nodeType: string): string {
    const icons: Record<string, string> = {
      start: '▶',
      end: '◼',
      llm: '🤖',
      code: '⚡',
      'if-else': '🔀',
      variable: '📦',
      agent: '🔧',
      loop: '🔄',
      template: '📄',
    };
    return icons[nodeType] || '●';
  }
}

// Interactive Prompts and Confirmations
export class InteractivePrompts {
  static async confirm(message: string): Promise<boolean> {
    const { default: inquirer } = await import('inquirer');
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: colors.primary(message),
        default: false,
      },
    ]);
    return confirmed;
  }

  static async select(message: string, choices: string[]): Promise<string> {
    const { default: inquirer } = await import('inquirer');
    const { selection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message: colors.primary(message),
        choices: choices.map(choice => ({
          name: colors.text(choice),
          value: choice,
        })),
      },
    ]);
    return selection;
  }

  static async input(message: string, defaultValue?: string): Promise<string> {
    const { default: inquirer } = await import('inquirer');
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: colors.primary(message),
        default: defaultValue,
      },
    ]);
    return input;
  }
}

// Main TUI orchestrator
export class FlowshTUI {
  private progress = new ProgressIndicator();

  constructor(private verbose = false) {}

  async withSpinner<T>(
    operation: keyof typeof ProgressIndicator.spinners,
    task: () => Promise<T>,
    successMessage?: string
  ): Promise<T> {
    this.progress.startSpinner(operation);
    try {
      const result = await task();
      this.progress.succeedSpinner(successMessage || 'Operation completed successfully');
      return result;
    } catch (error) {
      this.progress.failSpinner(
        `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  async withProgressBar<T>(
    label: string,
    total: number,
    task: (updateProgress: (value: number) => void) => Promise<T>
  ): Promise<T> {
    this.progress.startProgressBar(total, label);
    try {
      const result = await task(value => this.progress.updateProgressBar(value));
      this.progress.completeProgressBar();
      return result;
    } catch (error) {
      this.progress.completeProgressBar();
      throw error;
    }
  }

  showWelcome(): void {
    if (this.verbose) {
      FlowshBranding.displayLogo();
    } else {
      FlowshBranding.displayMiniLogo();
    }
  }

  showMetrics(metrics: Parameters<typeof PerformanceVisualizer.displayMetrics>[0]): void {
    PerformanceVisualizer.displayMetrics(metrics);
  }

  showWorkflow(workflow: Parameters<typeof WorkflowVisualizer.displayWorkflowSummary>[0]): void {
    WorkflowVisualizer.displayWorkflowSummary(workflow);
  }
}

// Export convenience functions for common operations
export const tui = {
  colors,
  gradients,
  output: OutputFormatter,
  branding: FlowshBranding,
  performance: PerformanceVisualizer,
  workflow: WorkflowVisualizer,
  prompts: InteractivePrompts,
};

export default FlowshTUI;

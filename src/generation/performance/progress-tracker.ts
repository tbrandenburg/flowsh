/**
 * Progress Tracking for Large Workflow Compilations
 *
 * Provides real-time progress feedback for workflows with many nodes
 */

export interface ProgressUpdate {
  /** Current phase of compilation */
  phase: 'parsing' | 'validation' | 'generation' | 'completion';
  /** Number of items processed */
  processed: number;
  /** Total number of items to process */
  total: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current item being processed */
  currentItem?: string;
  /** Estimated time remaining in milliseconds */
  estimatedRemainingMs?: number;
}

export type ProgressCallback = (update: ProgressUpdate) => void;

/**
 * Track and report compilation progress for complex workflows
 */
export class ProgressTracker {
  private startTime: number = 0;
  private callback: ProgressCallback | undefined;
  private currentPhase: ProgressUpdate['phase'] = 'parsing';
  private processed: number = 0;
  private total: number = 0;
  private lastUpdateTime: number = 0;
  private readonly updateIntervalMs: number = 100; // Update every 100ms max

  constructor(callback?: ProgressCallback, updateIntervalMs: number = 100) {
    this.callback = callback;
    this.updateIntervalMs = updateIntervalMs;
  }

  /**
   * Start progress tracking
   * @param totalItems - Total number of items to process
   */
  start(totalItems: number): void {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.total = totalItems;
    this.processed = 0;
    this.currentPhase = 'parsing';

    this.sendUpdate();
  }

  /**
   * Move to the next phase of compilation
   * @param phase - The new phase
   * @param totalItems - Updated total items for this phase
   */
  setPhase(phase: ProgressUpdate['phase'], totalItems?: number): void {
    this.currentPhase = phase;
    if (totalItems !== undefined) {
      this.total = totalItems;
      this.processed = 0;
    }
    this.sendUpdate();
  }

  /**
   * Update progress within current phase
   * @param processed - Number of items processed
   * @param currentItem - Current item being processed (optional)
   */
  update(processed: number, currentItem?: string): void {
    this.processed = Math.min(processed, this.total);

    // Throttle updates to avoid overwhelming the callback
    const now = Date.now();
    if (now - this.lastUpdateTime >= this.updateIntervalMs) {
      this.sendUpdate(currentItem);
      this.lastUpdateTime = now;
    }
  }

  /**
   * Increment progress by one item
   * @param currentItem - Current item being processed (optional)
   */
  increment(currentItem?: string): void {
    this.update(this.processed + 1, currentItem);
  }

  /**
   * Complete the current phase and move to completion
   */
  complete(): void {
    this.currentPhase = 'completion';
    this.processed = this.total;
    this.sendUpdate();
  }

  /**
   * Get current progress information
   */
  getProgress(): ProgressUpdate {
    const percentage = this.total > 0 ? Math.round((this.processed / this.total) * 100) : 0;
    const elapsed = Date.now() - this.startTime;

    const result: ProgressUpdate = {
      phase: this.currentPhase,
      processed: this.processed,
      total: this.total,
      percentage,
    };

    if (this.processed > 0 && this.processed < this.total) {
      const avgTimePerItem = elapsed / this.processed;
      const remainingItems = this.total - this.processed;
      result.estimatedRemainingMs = Math.round(avgTimePerItem * remainingItems);
    }

    return result;
  }

  /**
   * Check if progress tracking is enabled (has a callback)
   */
  isEnabled(): boolean {
    return this.callback !== undefined;
  }

  private sendUpdate(currentItem?: string): void {
    if (!this.callback) return;

    const update: ProgressUpdate = {
      ...this.getProgress(),
    };

    if (currentItem) {
      update.currentItem = currentItem;
    }

    try {
      this.callback(update);
    } catch (error) {
      // Don't let callback errors break compilation
      console.warn('Progress callback error:', error);
    }
  }
}

/**
 * Create a simple console progress reporter for CLI usage
 * @param showDetails - Whether to show detailed information
 * @param showOnlyLargeWorkflows - Only show progress for workflows with >20 nodes
 */
export function createConsoleProgressReporter(
  showDetails: boolean = false,
  showOnlyLargeWorkflows: boolean = true
): ProgressCallback {
  let lastPercentage = -1;

  return (update: ProgressUpdate) => {
    // Skip updates for small workflows if configured
    if (showOnlyLargeWorkflows && update.total <= 20) {
      return;
    }

    // Only show updates when percentage changes significantly
    if (update.percentage === lastPercentage) {
      return;
    }

    lastPercentage = update.percentage;

    // Simple progress bar
    const barLength = 20;
    const filledLength = Math.round((update.percentage / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    let message = `🔨 ${update.phase}: [${bar}] ${update.percentage}% (${update.processed}/${update.total})`;

    if (showDetails) {
      if (update.currentItem) {
        message += ` - ${update.currentItem}`;
      }
      if (update.estimatedRemainingMs) {
        const seconds = Math.round(update.estimatedRemainingMs / 1000);
        message += ` - ETA: ${seconds}s`;
      }
    }

    // Use stderr so it doesn't interfere with script output
    console.error(message);
  };
}

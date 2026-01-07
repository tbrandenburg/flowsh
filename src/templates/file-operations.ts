import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsStat from 'fs';

/**
 * File operations abstraction layer with cross-platform support
 * and comprehensive error handling
 */
export class FileOperations {
  /**
   * Ensure a directory exists, creating it recursively if needed
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Write content to a file, creating directories as needed
   */
  async writeFile(filePath: string, content: string, overwrite = true): Promise<void> {
    if (!overwrite) {
      try {
        await fs.access(filePath);
        throw new Error(`File already exists: ${filePath}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    const resolvedPath = path.resolve(filePath);
    const directory = path.dirname(resolvedPath);

    await this.ensureDirectory(directory);
    await fs.writeFile(resolvedPath, content, 'utf8');
  }

  /**
   * Read content from a file
   */
  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf8');
  }

  /**
   * Check if a file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy a file from source to destination
   */
  async copyFile(source: string, destination: string, overwrite = true): Promise<void> {
    if (!overwrite && (await this.exists(destination))) {
      throw new Error(`File already exists: ${destination}`);
    }

    const destinationDir = path.dirname(destination);
    await this.ensureDirectory(destinationDir);

    await fs.copyFile(source, destination);
  }

  /**
   * Get file stats (modification time, size, etc.)
   */
  async getStats(filePath: string): Promise<fsStat.Stats> {
    return await fs.stat(filePath);
  }

  /**
   * Safely resolve a file path to prevent directory traversal attacks
   */
  safeResolve(basePath: string, userPath: string): string {
    const resolvedPath = path.resolve(basePath, userPath);
    const normalizedBase = path.resolve(basePath);

    if (!resolvedPath.startsWith(normalizedBase)) {
      throw new Error(`Invalid path: ${userPath} (directory traversal detected)`);
    }

    return resolvedPath;
  }

  /**
   * Validate that a file path is safe and doesn't contain dangerous patterns
   */
  validateFilePath(filePath: string): void {
    // Check for null bytes
    if (filePath.includes('\0')) {
      throw new Error('Invalid file path: contains null byte');
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /\.\./, // Parent directory traversal
      /\/\//, // Double slashes
      /^[/\\]/, // Absolute paths (should be relative)
      /[<>:"|?*]/, // Invalid filename characters on Windows
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(filePath)) {
        throw new Error(`Invalid file path: ${filePath}`);
      }
    }

    // Check path length (Windows has 260 character limit)
    if (filePath.length > 250) {
      throw new Error('File path too long');
    }
  }
}

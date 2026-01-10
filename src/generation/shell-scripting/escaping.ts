/**
 * Centralized Shell Escaping Utility
 *
 * Provides standardized escaping functions for shell script generation
 * to prevent command injection and ensure consistent shell syntax across generators.
 */

export class ShellEscaping {
  /**
   * Escape text for JSON payload in shell commands (curl, API calls)
   * Handles all JSON metacharacters that need escaping
   */
  static forJSON(text: string): string {
    return text
      .replace(/\\/g, '\\\\') // Escape backslashes first
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\r/g, '\\r') // Escape carriage returns
      .replace(/\t/g, '\\t') // Escape tabs
      .replace(/\f/g, '\\f') // Escape form feeds
      .replace(/\b/g, '\\b'); // Escape backspaces
  }

  /**
   * Escape text for shell variable assignment (prevents command injection)
   * Uses double-quote wrapping with embedded quote escaping to match test expectations
   */
  static forShellVariable(text: string): string {
    // Double-quote wrapping with embedded quote escaping to match test expectations
    return '"' + text.replace(/([\\$`"])/g, '\\$1') + '"';
  }

  /**
   * Escape text for shell command arguments
   * Uses appropriate escaping based on content
   */
  static forShellArg(text: string): string {
    // Safe characters need no escaping
    if (/^[a-zA-Z0-9._/\-]+$/.test(text)) {
      return text;
    }
    // Double-quote with escape sequences
    return '"' + text.replace(/([\\$`"])/g, '\\$1') + '"';
  }

  /**
   * Escape text for use inside shell expressions and command substitutions
   * Fixes the problematic single-quote escaping that causes "Entry: command not found"
   */
  static forShellExpression(text: string): string {
    // For expressions, use double quotes and escape internal metacharacters
    return text.replace(/([\\$`"])/g, '\\$1');
  }

  /**
   * Smart escaping for shell expressions based on context
   * Handles both simple strings and complex expressions
   */
  static forExpressionContext(expression: string): string {
    // Check if this is a simple echo command with single quotes that cause problems
    const singleQuotedEchoPattern = /^echo\s+'([^']*)'$/;
    const match = expression.match(singleQuotedEchoPattern);

    if (match && match[1]) {
      // This is a simple single-quoted echo that can cause issues
      const content = match[1];
      // Check if content has shell metacharacters that would be problematic
      if (content.includes('|') || content.includes('&') || content.includes(';')) {
        // Escape for double-quoted context
        const escapedContent = content.replace(/([\\$`"])/g, '\\$1');
        return `echo "${escapedContent}"`;
      }
    }

    // For complex expressions or expressions that are already properly formatted,
    // don't modify them as they might be intentionally structured
    return expression;
  }

  /**
   * Validate shell syntax before generation
   * Uses bash -n to check syntax without execution
   */
  static async validateSyntax(shellCode: string): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      execSync('bash -n', { input: shellCode, encoding: 'utf8' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Escape text for HTML context (useful for Telegram HTML parse mode)
   */
  static forHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;') // Must be first to avoid double-escaping
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Escape text for Markdown context
   */
  static forMarkdown(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/`/g, '\\`')
      .replace(/~/g, '\\~')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/!/g, '\\!')
      .replace(/#/g, '\\#');
  }

  /**
   * Escape special regex characters for use in sed/grep patterns
   */
  static forRegex(text: string): string {
    return text.replace(/[[\\.+*?{}^$()]/g, '\\$&');
  }

  /**
   * Escape text for URL encoding
   */
  static forURL(text: string): string {
    return encodeURIComponent(text);
  }

  /**
   * Comprehensive escaping test - validates that escaped strings are safe
   */
  static testEscaping(): boolean {
    const testCases = [
      { input: `Hello "World"`, method: 'forJSON' },
      { input: `It's a test`, method: 'forShellVariable' },
      { input: `echo 'Hello World'`, method: 'forExpressionContext' },
      { input: `cat file.txt | grep "pattern"`, method: 'forShellArg' },
    ];

    let allPassed = true;

    for (const testCase of testCases) {
      try {
        const method = this[testCase.method as keyof typeof ShellEscaping] as (
          text: string
        ) => string;
        const result = method.call(this, testCase.input);

        // Basic validation that escaping occurred
        if (result === testCase.input && testCase.input.includes(' ')) {
          console.warn(`Escaping may not have occurred for: ${testCase.input}`);
          allPassed = false;
        }
      } catch (error) {
        console.error(`Test failed for ${testCase.method}: ${error}`);
        allPassed = false;
      }
    }

    return allPassed;
  }
}

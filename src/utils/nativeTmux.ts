import { spawn } from 'child_process'
import { execa } from 'execa'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, chmodSync } from 'fs'

/**
 * Native tmux helper that uses shell script with exec() for proper TTY control
 * This solves the TTY corruption issue by using exec to replace the process
 */
export class NativeTmuxHelper {
  // Cached path to the native tmux helper script (lazy initialization)
  private static _helperScript: string | null = null

  /**
   * Get the path to the tmux helper script with lazy initialization
   * Only resolves the path when tmux functionality is actually needed
   */
  private static getHelperScript(): string {
    // Return cached value if already resolved
    if (this._helperScript !== null) {
      return this._helperScript
    }

    // Skip initialization in test environment
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      this._helperScript = '/mock/path/maestro-tmux-attach'
      return this._helperScript
    }

    // Get current file directory
    const currentDir = dirname(fileURLToPath(import.meta.url))

    // Try multiple possible paths for different installation scenarios
    const possiblePaths = [
      // Built package: dist/utils -> ../../scripts/ (from issue-144/dist/utils to issue-144/scripts)
      join(dirname(dirname(currentDir)), 'scripts', 'maestro-tmux-attach'),
      // Development/source: src/utils -> ../../scripts/ (from issue-144/src/utils to issue-144/scripts)
      join(dirname(dirname(currentDir)), 'scripts', 'maestro-tmux-attach'),
      // npm package root: node_modules/@camoneart/maestro/dist/utils -> ../../../scripts/
      join(dirname(dirname(dirname(currentDir))), 'scripts', 'maestro-tmux-attach'),
      // Direct path for current development structure
      join(process.cwd(), 'scripts', 'maestro-tmux-attach'),
    ]

    let scriptPath: string | null = null
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        scriptPath = path
        break
      }
    }

    if (!scriptPath) {
      throw new Error(
        `Maestro tmux helper script not found. Searched paths: ${possiblePaths.join(', ')}\n` +
          'Note: This error occurs only when tmux functionality is used. ' +
          'Non-tmux commands like "config init" should work without tmux installed.'
      )
    }

    // Set executable permissions
    try {
      chmodSync(scriptPath, '755')
    } catch {
      // Ignore permission errors in case of read-only filesystem
      console.warn(`Warning: Could not set executable permissions for ${scriptPath}`)
    }

    this._helperScript = scriptPath
    return this._helperScript
  }
  /**
   * Attach to an existing tmux session using native shell script with exec
   * This function replaces the current Node.js process with tmux
   */
  static async attachToSession(sessionName: string): Promise<never> {
    // Validate session name
    if (!sessionName || typeof sessionName !== 'string') {
      throw new Error('Session name must be a non-empty string')
    }

    // Check if session exists before attempting to attach
    try {
      await execa('tmux', ['has-session', '-t', sessionName])
    } catch {
      throw new Error(`Tmux session '${sessionName}' does not exist`)
    }

    // Use the native helper script which properly uses exec to replace the process
    const helperProcess = spawn(this.getHelperScript(), ['attach', sessionName], {
      stdio: 'inherit',
      detached: false,
    })

    // Wait for helper to exit, then terminate Node.js process
    helperProcess.on('exit', code => {
      // Exit with the same code as tmux to maintain proper exit status
      process.exit(code || 0)
    })

    helperProcess.on('error', error => {
      console.error(`Failed to attach to tmux session: ${error.message}`)
      process.exit(1)
    })

    // This promise never resolves because process.exit() terminates Node.js
    return new Promise(() => {}) as Promise<never>
  }

  /**
   * Create a new tmux session and attach using native shell script with exec
   * This function replaces the current Node.js process with tmux
   */
  static async createAndAttachSession(
    sessionName: string,
    workingDirectory?: string,
    command?: string
  ): Promise<never> {
    // Validate session name
    if (!sessionName || typeof sessionName !== 'string') {
      throw new Error('Session name must be a non-empty string')
    }

    // Check if session already exists, attach if it does
    try {
      await execa('tmux', ['has-session', '-t', sessionName])
      console.warn(`Warning: tmux session '${sessionName}' already exists, attaching instead`)
      return this.attachToSession(sessionName)
    } catch {
      // Session doesn't exist, continue with creation
    }

    // Prepare arguments for the native helper script
    const args = ['new', sessionName]
    if (workingDirectory) {
      args.push(workingDirectory)
    }
    if (command) {
      args.push(command)
    }

    // Use the native helper script which properly uses exec to replace the process
    const helperProcess = spawn(this.getHelperScript(), args, {
      stdio: 'inherit',
      detached: false,
    })

    // Wait for helper to exit, then terminate Node.js process
    helperProcess.on('exit', code => {
      // Exit with the same code as tmux to maintain proper exit status
      process.exit(code || 0)
    })

    helperProcess.on('error', error => {
      console.error(`Failed to create tmux session: ${error.message}`)
      process.exit(1)
    })

    // This promise never resolves because process.exit() terminates Node.js
    return new Promise(() => {}) as Promise<never>
  }

  /**
   * Switch tmux client to another session (only works from within tmux)
   * This doesn't need process replacement since it's an internal tmux operation
   */
  static async switchClient(sessionName: string): Promise<void> {
    // Validate session name
    if (!sessionName || typeof sessionName !== 'string') {
      throw new Error('Session name must be a non-empty string')
    }

    // Use the native helper script for consistency
    try {
      await execa(this.getHelperScript(), ['switch', sessionName])
    } catch (error) {
      throw new Error(
        `Failed to switch tmux client: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Check if a tmux session exists
   */
  static async sessionExists(sessionName: string): Promise<boolean> {
    try {
      await execa('tmux', ['has-session', '-t', sessionName])
      return true
    } catch {
      return false
    }
  }

  /**
   * List all tmux sessions
   */
  static async listSessions(): Promise<Array<{ name: string; attached: boolean }>> {
    try {
      const { stdout } = await execa('tmux', [
        'list-sessions',
        '-F',
        '#{session_name}:#{session_attached}',
      ])

      return stdout
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [name, attached] = line.split(':')
          return {
            name: name || 'unknown',
            attached: attached === '1',
          }
        })
    } catch {
      return []
    }
  }
}

/**
 * Legacy compatibility functions for backward compatibility
 * These functions now use the native helper
 */

/**
 * @deprecated Use NativeTmuxHelper.attachToSession instead
 */
export async function attachToTmuxWithNativeHelper(sessionName: string): Promise<never> {
  return NativeTmuxHelper.attachToSession(sessionName)
}

/**
 * @deprecated Use NativeTmuxHelper.createAndAttachSession instead
 */
export async function createAndAttachTmuxWithNativeHelper(
  sessionName: string,
  workingDirectory?: string,
  command?: string
): Promise<never> {
  return NativeTmuxHelper.createAndAttachSession(sessionName, workingDirectory, command)
}

/**
 * @deprecated Use NativeTmuxHelper.switchClient instead
 */
export async function switchTmuxClientWithNativeHelper(sessionName: string): Promise<void> {
  return NativeTmuxHelper.switchClient(sessionName)
}

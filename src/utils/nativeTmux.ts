import { spawn } from 'child_process'
import { execa } from 'execa'

/**
 * Native tmux helper that uses direct tmux commands with proper TTY control
 * This solves the TTY corruption issue by using spawn + process.exit()
 */
export class NativeTmuxHelper {
  /**
   * Attach to an existing tmux session using direct tmux command
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

    // Use spawn with stdio: 'inherit' to transfer TTY control to tmux
    // This provides the most direct interaction with tmux process
    const tmuxProcess = spawn('tmux', ['attach-session', '-t', sessionName], {
      stdio: 'inherit',
      detached: false,
    })

    // Wait for tmux to exit, then terminate Node.js process
    tmuxProcess.on('exit', code => {
      // Exit with the same code as tmux to maintain proper exit status
      process.exit(code || 0)
    })

    tmuxProcess.on('error', error => {
      console.error(`Failed to attach to tmux session: ${error.message}`)
      process.exit(1)
    })

    // This promise never resolves because process.exit() terminates Node.js
    return new Promise(() => {}) as Promise<never>
  }

  /**
   * Create a new tmux session and attach using direct tmux command
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

    // Prepare arguments for tmux new-session
    const args = ['new-session', '-s', sessionName]
    if (workingDirectory) {
      args.push('-c', workingDirectory)
    }
    if (command) {
      args.push('--', command)
    }

    // Use spawn with stdio: 'inherit' to transfer TTY control to tmux
    const tmuxProcess = spawn('tmux', args, {
      stdio: 'inherit',
      detached: false,
    })

    // Wait for tmux to exit, then terminate Node.js process
    tmuxProcess.on('exit', code => {
      // Exit with the same code as tmux to maintain proper exit status
      process.exit(code || 0)
    })

    tmuxProcess.on('error', error => {
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

    // Check if we're inside tmux
    if (!process.env.TMUX) {
      throw new Error('switch-client can only be used from within tmux')
    }

    // Check if target session exists
    try {
      await execa('tmux', ['has-session', '-t', sessionName])
    } catch {
      throw new Error(`Tmux session '${sessionName}' does not exist`)
    }

    // Use direct tmux switch-client command
    try {
      await execa('tmux', ['switch-client', '-t', sessionName])
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

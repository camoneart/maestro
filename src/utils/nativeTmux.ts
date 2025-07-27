import { spawn } from 'child_process'
import { execa } from 'execa'
import path from 'path'
import { fileURLToPath } from 'url'

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to the native tmux helper script
const TMUX_HELPER_SCRIPT = path.join(__dirname, '../../scripts/maestro-tmux-attach')

/**
 * Native tmux attach helper that uses exec() to properly transfer TTY control
 * This solves the TTY corruption issue by completely replacing the Node.js process
 */
export class NativeTmuxHelper {
  /**
   * Attach to an existing tmux session using the native helper
   * This function replaces the current Node.js process with tmux
   */
  static async attachToSession(sessionName: string): Promise<never> {
    // Validate session name
    if (!sessionName || typeof sessionName !== 'string') {
      throw new Error('Session name must be a non-empty string')
    }

    // Check if the helper script exists
    try {
      await execa('test', ['-x', TMUX_HELPER_SCRIPT])
    } catch {
      throw new Error(`Tmux helper script not found or not executable: ${TMUX_HELPER_SCRIPT}`)
    }

    // Check if session exists before attempting to attach
    try {
      await execa('tmux', ['has-session', '-t', sessionName])
    } catch {
      throw new Error(`Tmux session '${sessionName}' does not exist`)
    }

    // Use the native helper to attach with proper TTY control
    // This will replace the current process and never return
    const helperProcess = spawn(TMUX_HELPER_SCRIPT, ['attach', sessionName], {
      stdio: 'inherit',
      detached: false,
    })

    // This promise will never resolve because the process is replaced
    return new Promise((_, reject) => {
      helperProcess.on('error', error => {
        reject(new Error(`Failed to execute tmux helper: ${error.message}`))
      })

      // If we get an exit event, something went wrong
      helperProcess.on('exit', (code, signal) => {
        if (code !== 0) {
          reject(new Error(`Tmux helper exited with code ${code} signal ${signal}`))
        }
      })
    }) as Promise<never>
  }

  /**
   * Create a new tmux session and attach using the native helper
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

    // Check if the helper script exists
    try {
      await execa('test', ['-x', TMUX_HELPER_SCRIPT])
    } catch {
      throw new Error(`Tmux helper script not found or not executable: ${TMUX_HELPER_SCRIPT}`)
    }

    // Prepare arguments for the helper script
    const args = ['new', sessionName]
    if (workingDirectory) {
      args.push(workingDirectory)
    }
    if (command) {
      args.push(command)
    }

    // Use the native helper to create and attach with proper TTY control
    // This will replace the current process and never return
    const helperProcess = spawn(TMUX_HELPER_SCRIPT, args, {
      stdio: 'inherit',
      detached: false,
    })

    // This promise will never resolve because the process is replaced
    return new Promise((_, reject) => {
      helperProcess.on('error', error => {
        reject(new Error(`Failed to execute tmux helper: ${error.message}`))
      })

      // If we get an exit event, something went wrong
      helperProcess.on('exit', (code, signal) => {
        if (code !== 0) {
          reject(new Error(`Tmux helper exited with code ${code} signal ${signal}`))
        }
      })
    }) as Promise<never>
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

    // Use the native helper for consistency
    try {
      await execa(TMUX_HELPER_SCRIPT, ['switch', sessionName])
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

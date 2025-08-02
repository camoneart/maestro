import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'
import { Command } from 'commander'
import { githubCommand } from '../../commands/github.js'
import * as git from '../../core/git.js'
import * as config from '../../core/config.js'
import { execa } from 'execa'

vi.mock('execa')
vi.mock('../../core/git.js')
vi.mock('../../core/config.js')
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    isSpinning: true,
  }),
}))

describe('GitHub Command Error Handling', () => {
  let mockGitManager: any
  let mockConfigManager: any
  let program: Command
  let processExitCodeSpy: any
  let consoleErrorSpy: any

  beforeEach(() => {
    // Mock implementations
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue('/test/worktree'),
    }

    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue({
        github: {
          branchNaming: {
            issueTemplate: 'issue-{number}',
          },
        },
      }),
    }

    vi.mocked(git.GitWorktreeManager).mockImplementation(() => mockGitManager)
    vi.mocked(config.ConfigManager).mockImplementation(() => mockConfigManager)

    // Mock gh CLI - type assertion to avoid complex type mismatch
    ;(vi.mocked(execa) as Mock).mockImplementation(async (cmd: string | URL, args?: any) => {
      const cmdStr = cmd.toString()
      if (cmdStr === 'gh' && args?.[0] === '--version') {
        return { stdout: 'gh version 2.0.0', stderr: '', exitCode: 0 } as any
      }
      if (cmdStr === 'gh' && args?.[0] === 'auth' && args?.[1] === 'status') {
        return { stdout: 'Logged in', stderr: '', exitCode: 0 } as any
      }
      if (cmdStr === 'gh' && args?.[0] === 'issue' && args?.[1] === 'view') {
        return {
          stdout: JSON.stringify({
            number: 182,
            title: 'Test Issue',
            author: { login: 'testuser' },
          }),
          stderr: '',
          exitCode: 0,
        } as any
      }
      throw new Error('Command not mocked')
    })

    // Mock process.exitCode instead of process.exit
    processExitCodeSpy = vi.spyOn(process, 'exitCode', 'set')

    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Create a new Command instance for testing
    program = new Command()
    program.exitOverride()
    program.addCommand(githubCommand)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle unknown options and prevent command execution', async () => {
    // Test with invalid option
    const args = [
      'node',
      'maestro',
      'github',
      'issue',
      '182',
      '--tmux-h-panes',
      '4',
      '--tmux-layout',
      'tiled',
    ]

    try {
      await program.parseAsync(args)
      // If we get here, the command didn't throw an error as expected
      expect.fail('Command should have thrown an error for unknown option')
    } catch (error: any) {
      // Check that the error is about unknown option
      expect(error.code).toBe('commander.unknownOption')
      expect(error.message).toContain('--tmux-h-panes')
    }

    // Verify that worktree was NOT created
    expect(mockGitManager.createWorktree).not.toHaveBeenCalled()

    // Verify error was displayed via console.error
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('should execute normally with valid options', async () => {
    const args = ['node', 'maestro', 'github', 'issue', '182']

    // Mock inquirer to auto-confirm
    vi.doMock('inquirer', () => ({
      default: {
        prompt: vi.fn().mockResolvedValue({ confirmCreate: true }),
      },
    }))

    // Process should not throw an error with valid options
    await expect(program.parseAsync(args)).resolves.not.toThrow()

    // Since action is async and exit code is set, wait a bit
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify that process.exitCode was set to 1 (because of spinner.fail in test env)
    expect(processExitCodeSpy).toHaveBeenCalled()
  })

  it('should reject multiple unknown options', async () => {
    const args = [
      'node',
      'maestro',
      'github',
      'issue',
      '182',
      '--invalid-option',
      '--another-invalid',
    ]

    try {
      await program.parseAsync(args)
      expect.fail('Command should have thrown an error')
    } catch (error: any) {
      expect(error.code).toBe('commander.unknownOption')
      expect(error.message).toContain('--invalid-option')
    }

    expect(mockGitManager.createWorktree).not.toHaveBeenCalled()

    // Verify error was displayed
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})

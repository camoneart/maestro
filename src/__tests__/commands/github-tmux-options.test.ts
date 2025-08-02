import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { githubCommand } from '../../commands/github.js'
import { execa } from 'execa'
import { GitWorktreeManager } from '../../core/git.js'
import { ConfigManager } from '../../core/config.js'
import inquirer from 'inquirer'
import chalk from 'chalk'

vi.mock('execa')
vi.mock('../../core/git.js')
vi.mock('../../core/config.js')
vi.mock('inquirer')
vi.mock('../../utils/tmuxSession.js', () => ({
  createTmuxSession: vi.fn().mockResolvedValue(undefined),
  validateTmuxOptions: vi.fn(),
}))
vi.mock('../../utils/tmux.js', () => ({
  isInTmuxSession: vi.fn().mockResolvedValue(true),
}))

const mockExeca = vi.mocked(execa)
const mockGitWorktreeManager = vi.mocked(GitWorktreeManager)
const mockConfigManager = vi.mocked(ConfigManager)
const mockInquirer = vi.mocked(inquirer)

describe('github command with new tmux options', () => {
  let mockGitInstance: any
  let mockConfigInstance: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    // Mock git instance
    mockGitInstance = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
    }
    mockGitWorktreeManager.mockReturnValue(mockGitInstance)

    // Mock config instance
    mockConfigInstance = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue({
        worktrees: { branchPrefix: 'feature/' },
        github: {
          branchNaming: {
            issueTemplate: 'issue-{number}-{title}',
          },
        },
      }),
    }
    mockConfigManager.mockReturnValue(mockConfigInstance)

    // Mock gh auth status and version check
    mockExeca.mockImplementation(async (cmd: string, args?: string[]) => {
      if (cmd === 'gh' && args?.[0] === '--version') {
        return { stdout: 'gh version 2.0.0' } as any
      }
      if (cmd === 'gh' && args?.[0] === 'auth' && args?.[1] === 'status') {
        return { stdout: 'Logged in' } as any
      }
      if (cmd === 'gh' && args?.[0] === 'issue' && args?.[1] === 'view') {
        return {
          stdout: JSON.stringify({
            number: 123,
            title: 'Test Issue',
            author: { login: 'testuser' },
          }),
        } as any
      }
      throw new Error(`Unexpected command: ${cmd} ${args?.join(' ')}`)
    })

    // Mock inquirer
    mockInquirer.prompt.mockResolvedValue({ confirmCreate: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should accept --tmux-h option for horizontal split', async () => {
    const { createTmuxSession: mockCreateTmuxSession } = await import('../../utils/tmuxSession.js')

    await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux-h'])

    expect(mockCreateTmuxSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tmuxH: true,
      })
    )
  })

  it('should accept --tmux-v option for vertical split', async () => {
    const { createTmuxSession: mockCreateTmuxSession } = await import('../../utils/tmuxSession.js')

    await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux-v'])

    expect(mockCreateTmuxSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tmuxV: true,
      })
    )
  })

  it('should accept --tmux-h-panes option with number', async () => {
    const { createTmuxSession: mockCreateTmuxSession } = await import('../../utils/tmuxSession.js')

    await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux-h-panes', '4'])

    expect(mockCreateTmuxSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tmuxHPanes: 4,
      })
    )
  })

  it('should accept --tmux-v-panes option with number', async () => {
    const { createTmuxSession: mockCreateTmuxSession } = await import('../../utils/tmuxSession.js')

    await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux-v-panes', '3'])

    expect(mockCreateTmuxSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tmuxVPanes: 3,
      })
    )
  })

  it('should accept --tmux-layout option', async () => {
    const { createTmuxSession: mockCreateTmuxSession } = await import('../../utils/tmuxSession.js')

    await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux-layout', 'tiled'])

    expect(mockCreateTmuxSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tmuxLayout: 'tiled',
      })
    )
  })

  it('should validate tmux options before creating session', async () => {
    const { validateTmuxOptions: mockValidateTmuxOptions } = await import('../../utils/tmuxSession.js')

    await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux-h-panes', '10'])

    expect(mockValidateTmuxOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        tmuxHPanes: 10,
      })
    )
  })

  it('should error when multiple tmux options are specified', async () => {
    try {
      await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux', '--tmux-h'])
    } catch (error: any) {
      expect(error.message).toBe('process.exit called')
    }

    expect(console.error).toHaveBeenCalledWith(
      chalk.red('エラー: tmuxオプションは一つだけ指定してください')
    )
  })

  it('should not require being inside tmux for new options', async () => {
    const tmuxMod = await import('../../utils/tmux.js')
    vi.mocked(tmuxMod.isInTmuxSession).mockResolvedValue(false)

    await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux-h-panes', '3'])

    // Should not error about being outside tmux
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('tmuxセッション内にいる必要があります')
    )
  })

  it('should still require being inside tmux for --tmux-vertical option', async () => {
    const tmuxMod = await import('../../utils/tmux.js')
    vi.mocked(tmuxMod.isInTmuxSession).mockResolvedValue(false)

    try {
      await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux-vertical'])
    } catch (error: any) {
      expect(error.message).toBe('process.exit called')
    }

    expect(console.error).toHaveBeenCalledWith(
      chalk.red('エラー: --tmux-v/--tmux-hオプションを使用するにはtmuxセッション内にいる必要があります')
    )
  })

  it('should map old options to new ones correctly', async () => {
    const { createTmuxSession: mockCreateTmuxSession } = await import('../../utils/tmuxSession.js')
    const tmuxMod = await import('../../utils/tmux.js')
    vi.mocked(tmuxMod.isInTmuxSession).mockResolvedValue(true) // --tmux-horizontal requires being inside tmux

    await githubCommand.parseAsync(['node', 'test', 'issue', '123', '--tmux-horizontal'])

    expect(mockCreateTmuxSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tmuxH: true, // Old option should map to new option
      })
    )
  })
})
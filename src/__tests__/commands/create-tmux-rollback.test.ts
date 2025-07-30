import { vi, describe, it, expect, beforeEach } from 'vitest'
import { execa } from 'execa'
import { executeCreateCommand, CreateOptions } from '../../commands/create.js'
import { GitWorktreeManager } from '../../core/git.js'
import { ConfigManager } from '../../core/config.js'
import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import * as path from '../../utils/path.js'

// モック設定
vi.mock('execa')
vi.mock('inquirer')
vi.mock('ora')
vi.mock('../../core/git.js')
vi.mock('../../core/config.js')
vi.mock('../../utils/tmux.js')
vi.mock('../../utils/tty.js')
vi.mock('../../utils/packageManager.js')
vi.mock('../../utils/gitignore.js')
vi.mock('../../utils/path.js')
vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockRejectedValue(new Error('File not found')),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ isFile: () => true }),
    copyFile: vi.fn().mockResolvedValue(undefined),
  },
}))

const mockExeca = vi.mocked(execa)
const mockGitWorktreeManager = vi.mocked(GitWorktreeManager)
const mockConfigManager = vi.mocked(ConfigManager)
const mockInquirer = vi.mocked(inquirer)
const mockOra = vi.mocked(ora)

describe('Tmux error rollback tests', () => {
  let mockOraInstance: any
  let mockExit: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock process.exit
    mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process exited with code ${code}`)
    })

    // Mock ora
    mockOraInstance = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
    }
    mockOra.mockReturnValue(mockOraInstance)

    // Git repository check mock
    mockGitWorktreeManager.prototype.isGitRepository = vi.fn().mockResolvedValue(true)

    // Worktree creation mock
    mockGitWorktreeManager.prototype.createWorktree = vi
      .fn()
      .mockResolvedValue('/test/worktree/path')

    // Worktree deletion mock (for rollback)
    mockGitWorktreeManager.prototype.deleteWorktree = vi.fn().mockResolvedValue(undefined)

    // Config manager mock
    const mockConfig = {
      worktrees: {},
      tmux: { enabled: false },
      claude: { markdownMode: 'shared' },
    }
    mockConfigManager.prototype.loadProjectConfig = vi.fn().mockResolvedValue(undefined)
    mockConfigManager.prototype.getAll = vi.fn().mockReturnValue(mockConfig)
    mockConfigManager.prototype.get = vi.fn().mockReturnValue(undefined)

    // Branch info mock
    mockGitWorktreeManager.prototype.getAllBranches = vi.fn().mockResolvedValue({
      local: [],
      remote: [],
    })

    // Path formatting mock
    vi.mocked(path.formatPath).mockReturnValue('/formatted/path')

    // Environment variable mock
    delete process.env.TMUX

    // Console mocks
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should rollback worktree when tmux creation fails due to too many panes', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      tmuxHPanes: 40,
      tmuxLayout: 'tiled',
      yes: true, // Skip confirmation prompt
    }

    // Mock tmux session doesn't exist
    mockExeca.mockRejectedValueOnce(new Error('Session not found'))

    // Mock successful tmux session creation
    mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any)

    // Mock tmux split-window failure (too many panes)
    mockExeca.mockRejectedValueOnce(new Error('no space for new pane'))

    // Execute the command and expect it to exit
    await expect(executeCreateCommand(branchName, options)).rejects.toThrow(
      'Process exited with code 1'
    )

    // Verify worktree was created
    expect(mockGitWorktreeManager.prototype.createWorktree).toHaveBeenCalledWith(
      branchName,
      undefined
    )

    // Verify tmux commands were attempted
    expect(mockExeca).toHaveBeenCalledWith('tmux', [
      'new-session',
      '-d',
      '-s',
      branchName,
      '-c',
      '/test/worktree/path',
      expect.any(String),
      '-l',
    ])

    // Verify rollback was performed
    expect(mockGitWorktreeManager.prototype.deleteWorktree).toHaveBeenCalledWith(branchName, true)

    // Verify appropriate error messages were shown
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('画面サイズに対してペイン数（40個）が多すぎます')
    )
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(
        '後処理でエラーが発生したため、作成したリソースをクリーンアップします'
      )
    )
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('クリーンアップが完了しました')
    )
  })

  it('should show manual cleanup instructions if rollback fails', async () => {
    const branchName = 'test-branch'
    const worktreePath = '/test/worktree/path'
    const options: CreateOptions = {
      tmuxHPanes: 40,
      yes: true,
    }

    // Mock tmux session doesn't exist
    mockExeca.mockRejectedValueOnce(new Error('Session not found'))

    // Mock successful tmux session creation
    mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any)

    // Mock tmux split-window failure
    mockExeca.mockRejectedValueOnce(new Error('no space for new pane'))

    // Mock rollback failure
    mockGitWorktreeManager.prototype.deleteWorktree = vi
      .fn()
      .mockRejectedValue(new Error('Failed to delete'))

    // Execute the command
    await expect(executeCreateCommand(branchName, options)).rejects.toThrow(
      'Process exited with code 1'
    )

    // Verify manual cleanup instructions were shown
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'クリーンアップに失敗しました。手動で以下のコマンドを実行してください'
      )
    )
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`git worktree remove --force ${worktreePath}`)
    )
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`git branch -D ${branchName}`)
    )
  })

  it('should not attempt rollback if worktree creation itself fails', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      tmux: true,
      yes: true,
    }

    // Mock worktree creation failure
    mockGitWorktreeManager.prototype.createWorktree = vi
      .fn()
      .mockRejectedValue(new Error('Branch already exists'))

    // Execute the command
    await expect(executeCreateCommand(branchName, options)).rejects.toThrow(
      'Process exited with code 1'
    )

    // Verify no rollback was attempted
    expect(mockGitWorktreeManager.prototype.deleteWorktree).not.toHaveBeenCalled()
  })

  it('should handle tmux errors inside existing tmux session', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      tmuxVPanes: 50,
      yes: true,
    }

    // Set TMUX environment variable to simulate being inside tmux
    process.env.TMUX = '/tmp/tmux-1000/default,12345,0'

    // Mock tmux split-window failure for too many panes
    mockExeca.mockRejectedValueOnce(new Error('no space for new pane'))

    // Execute the command
    await expect(executeCreateCommand(branchName, options)).rejects.toThrow(
      'Process exited with code 1'
    )

    // Verify rollback was performed
    expect(mockGitWorktreeManager.prototype.deleteWorktree).toHaveBeenCalledWith(branchName, true)

    // Verify error message
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('画面サイズに対してペイン数（50個）が多すぎます')
    )
  })

  it('should not fail for other post-creation task errors', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      open: true, // This will try to open an editor
      yes: true,
    }

    // Mock editor opening failure
    mockExeca.mockImplementation((cmd: string) => {
      if (cmd === 'cursor') {
        throw new Error('Editor not found')
      }
      return Promise.resolve({ stdout: '', stderr: '' } as any)
    })

    // Execute the command - should not exit despite editor error
    await executeCreateCommand(branchName, options)

    // Verify worktree was created and NOT rolled back
    expect(mockGitWorktreeManager.prototype.createWorktree).toHaveBeenCalled()
    expect(mockGitWorktreeManager.prototype.deleteWorktree).not.toHaveBeenCalled()
  })
})

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

describe('Tmux pane validation tests', () => {
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

  it('should prevent worktree creation when too many horizontal panes are specified', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      tmuxHPanes: 40,
      tmuxLayout: 'tiled',
      yes: true,
    }

    // Execute the command and expect it to exit
    await expect(executeCreateCommand(branchName, options)).rejects.toThrow(
      'Process exited with code 1'
    )

    // Verify worktree was NOT created
    expect(mockGitWorktreeManager.prototype.createWorktree).not.toHaveBeenCalled()

    // Verify no tmux commands were attempted
    expect(mockExeca).not.toHaveBeenCalledWith('tmux', expect.anything())

    // Verify appropriate error messages were shown
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        '画面サイズに対してペイン数（40個）が多すぎるため、セッションが作成できませんでした'
      )
    )
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('水平分割'))
  })

  it('should prevent worktree creation when too many vertical panes are specified', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      tmuxVPanes: 50,
      yes: true,
    }

    // Execute the command and expect it to exit
    await expect(executeCreateCommand(branchName, options)).rejects.toThrow(
      'Process exited with code 1'
    )

    // Verify worktree was NOT created
    expect(mockGitWorktreeManager.prototype.createWorktree).not.toHaveBeenCalled()

    // Verify appropriate error messages were shown
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        '画面サイズに対してペイン数（50個）が多すぎるため、セッションが作成できませんでした'
      )
    )
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('垂直分割'))
  })

  it('should allow reasonable horizontal pane counts', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      tmuxHPanes: 4, // Reasonable number (≤ 10)
      yes: true,
    }

    // Execute the command - should succeed with validation
    await executeCreateCommand(branchName, options)

    // Verify worktree was created
    expect(mockGitWorktreeManager.prototype.createWorktree).toHaveBeenCalledWith(
      branchName,
      undefined
    )

    // Verify no error messages about pane count
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('画面サイズに対してペイン数')
    )
  })

  it('should allow reasonable vertical pane counts', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      tmuxVPanes: 8, // Reasonable number (≤ 15)
      yes: true,
    }

    // Execute the command - should succeed with validation
    await executeCreateCommand(branchName, options)

    // Verify worktree was created
    expect(mockGitWorktreeManager.prototype.createWorktree).toHaveBeenCalledWith(
      branchName,
      undefined
    )

    // Verify no error messages about pane count
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('画面サイズに対してペイン数')
    )
  })

  it('should allow 2 panes without validation (default behavior)', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      tmuxH: true, // Only 2 panes
      yes: true,
    }

    // Execute the command - should succeed without validation
    await executeCreateCommand(branchName, options)

    // Verify worktree was created
    expect(mockGitWorktreeManager.prototype.createWorktree).toHaveBeenCalledWith(
      branchName,
      undefined
    )

    // Verify no error messages
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('画面サイズに対してペイン数')
    )
  })

  it('should not validate pane count when no tmux options are specified', async () => {
    const branchName = 'test-branch'
    const options: CreateOptions = {
      yes: true,
    }

    // Execute the command - should succeed without validation
    await executeCreateCommand(branchName, options)

    // Verify worktree was created
    expect(mockGitWorktreeManager.prototype.createWorktree).toHaveBeenCalledWith(
      branchName,
      undefined
    )

    // Verify no error messages
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('画面サイズに対してペイン数')
    )
  })
})
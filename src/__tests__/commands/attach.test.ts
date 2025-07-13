import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { attachCommand } from '../../commands/attach.js'
import { GitWorktreeManager } from '../../core/git.js'
import { ConfigManager } from '../../core/config.js'
import inquirer from 'inquirer'
import ora from 'ora'
import { execa } from 'execa'
import chalk from 'chalk'

vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn(),
}))

vi.mock('../../core/config.js', () => ({
  ConfigManager: vi.fn(),
}))

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}))

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  })),
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

describe('attach command', () => {
  let consoleLogSpy: Mock
  let consoleErrorSpy: Mock
  let processExitSpy: Mock
  let mockGitManager: {
    isGitRepository: Mock
    fetchAll: Mock
    getAllBranches: Mock
    listWorktrees: Mock
    createWorktree: Mock
    getConfigValue: Mock
  }
  let mockConfigManager: {
    loadProjectConfig: Mock
    get: Mock
  }
  let mockSpinner: any

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process exited with code ${code}`)
    })

    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      fetchAll: vi.fn(),
      getAllBranches: vi.fn().mockResolvedValue({
        local: ['main', 'feature-1', 'feature-2'],
        remote: ['origin/main', 'origin/feature-3'],
      }),
      listWorktrees: vi.fn().mockResolvedValue([
        {
          path: '/path/to/main',
          branch: 'refs/heads/main',
          commit: 'abc123',
          isCurrentDirectory: true,
        },
      ]),
      createWorktree: vi.fn(),
      getConfigValue: vi.fn().mockResolvedValue(null),
    }
    ;(GitWorktreeManager as any).mockImplementation(() => mockGitManager)

    // ConfigManagerのモック
    mockConfigManager = {
      loadProjectConfig: vi.fn(),
      get: vi.fn().mockReturnValue({ path: '.git/shadow-clones' }),
    }
    ;(ConfigManager as any).mockImplementation(() => mockConfigManager)

    // oraのモック
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      text: '',
    }
    ;(ora as Mock).mockReturnValue(mockSpinner)
  })

  describe('basic functionality', () => {
    it.skip('should attach to specified branch', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await attachCommand.parseAsync(['node', 'attach', 'feature-1'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'feature-1',
        expect.stringContaining('.git/shadow-clones/feature-1')
      )
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        '影分身の術が成功しました！'
      )
    })

    it.skip('should prompt for branch selection when no branch specified', async () => {
      ;(inquirer.prompt as Mock).mockResolvedValue({ selectedBranch: 'feature-2' })
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await attachCommand.parseAsync(['node', 'attach'])

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'selectedBranch',
          message: 'どのブランチから影分身を作り出しますか？',
          choices: expect.arrayContaining([
            expect.objectContaining({ value: 'feature-1' }),
            expect.objectContaining({ value: 'feature-2' }),
          ]),
        }),
      ])
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'feature-2',
        expect.any(String)
      )
    })

    it.skip('should include remote branches with --remote option', async () => {
      ;(inquirer.prompt as Mock).mockResolvedValue({ selectedBranch: 'origin/feature-3' })
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await attachCommand.parseAsync(['node', 'attach', '--remote'])

      const promptCall = (inquirer.prompt as Mock).mock.calls[0][0][0]
      const choices = promptCall.choices
      expect(choices).toHaveLength(3) // feature-1, feature-2, origin/feature-3
      expect(choices.some((c: any) => c.value === 'origin/feature-3')).toBe(true)
    })

    it.skip('should fetch before listing branches with --fetch option', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await attachCommand.parseAsync(['node', 'attach', 'feature-1', '--fetch'])

      expect(mockGitManager.fetchAll).toHaveBeenCalled()
      expect(mockSpinner.text).toBe('ブランチ一覧を取得中...')
    })
  })

  describe('error handling', () => {
    it('should handle not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(
        attachCommand.parseAsync(['node', 'attach'])
      ).rejects.toThrow('Process exited with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        'このディレクトリはGitリポジトリではありません'
      )
    })

    it.skip('should handle no available branches', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([
        {
          path: '/path/to/main',
          branch: 'refs/heads/main',
          commit: 'abc123',
        },
        {
          path: '/path/to/feature-1',
          branch: 'refs/heads/feature-1',
          commit: 'def456',
        },
        {
          path: '/path/to/feature-2',
          branch: 'refs/heads/feature-2',
          commit: 'ghi789',
        },
      ])

      await expect(
        attachCommand.parseAsync(['node', 'attach'])
      ).rejects.toThrow('Process exited with code 0')

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        '利用可能なブランチがありません'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.yellow('すべてのブランチは既に影分身として存在します')
      )
    })

    it.skip('should handle branch not found', async () => {
      await expect(
        attachCommand.parseAsync(['node', 'attach', 'non-existent'])
      ).rejects.toThrow('Process exited with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        'ブランチ non-existent が見つかりません'
      )
    })

    it.skip('should handle worktree creation error', async () => {
      mockGitManager.createWorktree.mockRejectedValue(
        new Error('Worktree creation failed')
      )

      await expect(
        attachCommand.parseAsync(['node', 'attach', 'feature-1'])
      ).rejects.toThrow('Process exited with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith('影分身の術に失敗しました')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('エラー:'),
        'Worktree creation failed'
      )
    })
  })

  describe('post-creation actions', () => {
    it.skip('should open editor with --open option', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      mockConfigManager.get.mockReturnValue({
        path: '.git/shadow-clones',
        development: { defaultEditor: 'code' },
      })
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await attachCommand.parseAsync(['node', 'attach', 'feature-1', '--open'])

      expect(execa).toHaveBeenCalledWith(
        'code',
        [expect.stringContaining('.git/shadow-clones/feature-1')],
        expect.any(Object)
      )
    })

    it.skip('should run setup with --setup option', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await attachCommand.parseAsync(['node', 'attach', 'feature-1', '--setup'])

      expect(mockSpinner.text).toBe('環境をセットアップ中...')
      expect(execa).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({
          cwd: expect.stringContaining('.git/shadow-clones/feature-1'),
        })
      )
    })

    it.skip('should handle remote branch checkout', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await attachCommand.parseAsync(['node', 'attach', 'origin/feature-3', '--remote'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'feature-3', // リモートプレフィックスを除去
        expect.stringContaining('.git/shadow-clones/feature-3')
      )
    })
  })

  describe('user cancellation', () => {
    it('should handle user cancellation in branch selection', async () => {
      ;(inquirer.prompt as Mock).mockRejectedValue(new Error('User cancelled'))

      await expect(
        attachCommand.parseAsync(['node', 'attach'])
      ).rejects.toThrow()

      expect(mockGitManager.createWorktree).not.toHaveBeenCalled()
    })
  })

  describe('custom worktree path', () => {
    it.skip('should use custom worktree path from config', async () => {
      mockConfigManager.get.mockReturnValue({
        worktrees: { path: 'custom/path' },
      })
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await attachCommand.parseAsync(['node', 'attach', 'feature-1'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'feature-1',
        expect.stringContaining('custom/path/feature-1')
      )
    })
  })
})
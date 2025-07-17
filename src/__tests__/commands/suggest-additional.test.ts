import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { suggestCommand } from '../../commands/suggest.js'
import { GitWorktreeManager } from '../../core/git.js'
import { execa } from 'execa'
import inquirer from 'inquirer'
import ora from 'ora'
import fs from 'fs/promises'
import type { ParsedWorktreeInfo } from '../../types/index.js'

// モック設定
vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn(),
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
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
    warn: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  })),
}))

vi.mock('fs/promises', () => ({
  default: {
    mkdtemp: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    rm: vi.fn(),
  },
}))

vi.mock('os', () => ({
  tmpdir: vi.fn().mockReturnValue('/tmp'),
}))

describe.skip('suggest command - additional tests', () => {
  let mockGitManager: {
    isGitRepository: Mock
    getCommitLogs: Mock
    listBranches: Mock
    listWorktrees: Mock
    getCurrentBranch: Mock
  }
  let mockSpinner: any

  beforeEach(() => {
    vi.clearAllMocks()

    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      getCommitLogs: vi
        .fn()
        .mockResolvedValue([
          'feat: add user authentication',
          'fix: resolve login issue',
          'refactor: update database schema',
        ]),
      listBranches: vi.fn().mockResolvedValue(['main', 'develop', 'feature/auth']),
      listWorktrees: vi.fn().mockResolvedValue([]),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
    }
    ;(GitWorktreeManager as any).mockImplementation(() => mockGitManager)

    // Spinnerのモック
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      warn: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      text: '',
    }
    ;(ora as any).mockReturnValue(mockSpinner)

    // inquirerのモック
    ;(inquirer as any).default.prompt.mockResolvedValue({
      suggestionType: '🌿 ブランチ名',
      description: 'Add new feature',
    })

    // execaのモック（Claudeコマンド等）
    ;(execa as any).mockResolvedValue({
      stdout: '1. feature/new-feature\n2. feature/add-component\n3. feat/user-interface',
      stderr: '',
      exitCode: 0,
    })

    // fs/promisesのモック
    ;(fs as any).default.mkdtemp.mockResolvedValue('/tmp/maestro-suggest-123')
    ;(fs as any).default.writeFile.mockResolvedValue(undefined)
    ;(fs as any).default.readFile.mockResolvedValue(
      '1. feature/new-feature\n2. feature/add-component'
    )
    ;(fs as any).default.rm.mockResolvedValue(undefined)
  })

  describe('basic functionality', () => {
    it('should display suggestion type selection', async () => {
      await suggestCommand.parseAsync(['node', 'suggest'])

      expect((inquirer as any).default.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'list',
            name: 'suggestionType',
            message: '何を提案しますか？',
            choices: expect.arrayContaining(['🌿 ブランチ名', '📝 コミットメッセージ']),
          }),
        ])
      )
    })

    it('should handle branch name suggestions', async () => {
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'Add user authentication' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect(mockGitManager.isGitRepository).toHaveBeenCalled()
      expect((fs as any).default.mkdtemp).toHaveBeenCalled()
      expect((fs as any).default.writeFile).toHaveBeenCalled()
    })

    it('should handle commit message suggestions', async () => {
      ;(inquirer as any).default.prompt.mockResolvedValueOnce({
        suggestionType: '📝 コミットメッセージ',
      })

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect(mockGitManager.getCommitLogs).toHaveBeenCalled()
      expect(execa).toHaveBeenCalledWith('git', ['diff', '--staged'])
    })

    it('should include branch suggestions from existing branches', async () => {
      mockGitManager.listBranches.mockResolvedValue([
        'main',
        'develop',
        'feature/auth',
        'bugfix/login',
      ])
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'New feature development' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect(mockGitManager.listBranches).toHaveBeenCalled()
    })

    it('should include worktree suggestions', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: '/path/to/worktree/feature-1',
          branch: 'refs/heads/feature-1',
          commit: 'abc123',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: false,
        },
        {
          path: '/path/to/worktree/feature-2',
          branch: 'refs/heads/feature-2',
          commit: 'def456',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'New feature' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect(mockGitManager.listWorktrees).toHaveBeenCalled()
    })
  })

  describe('options handling', () => {
    it('should handle --branch option', async () => {
      await suggestCommand.parseAsync(['node', 'suggest', '--branch'])

      // ブランチモードで直接実行
      expect((inquirer as any).default.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'description',
            message: expect.stringContaining('説明'),
          }),
        ])
      )
    })

    it('should handle --commit option', async () => {
      await suggestCommand.parseAsync(['node', 'suggest', '--commit'])

      expect(mockGitManager.getCommitLogs).toHaveBeenCalled()
      expect(execa).toHaveBeenCalledWith('git', ['diff', '--staged'])
    })

    it('should handle --issue option', async () => {
      ;(execa as any).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args.includes('issue')) {
          return Promise.resolve({
            stdout: JSON.stringify({
              number: 123,
              title: 'Add new feature',
              body: 'Detailed description of the feature',
            }),
          })
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 })
      })

      await suggestCommand.parseAsync(['node', 'suggest', '--issue', '123'])

      expect(execa).toHaveBeenCalledWith('gh', [
        'issue',
        'view',
        '123',
        '--json',
        'number,title,body',
      ])
    })

    it('should handle --pr option', async () => {
      ;(execa as any).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args.includes('pr')) {
          return Promise.resolve({
            stdout: JSON.stringify({
              number: 456,
              title: 'Fix critical bug',
              body: 'This PR fixes a critical bug in the authentication system',
            }),
          })
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 })
      })

      await suggestCommand.parseAsync(['node', 'suggest', '--pr', '456'])

      expect(execa).toHaveBeenCalledWith('gh', ['pr', 'view', '456', '--json', 'number,title,body'])
    })

    it('should handle --description option', async () => {
      await suggestCommand.parseAsync([
        'node',
        'suggest',
        '--description',
        'Add authentication system',
      ])

      // 説明が直接提供された場合はプロンプトをスキップ
      expect((fs as any).default.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Add authentication system')
      )
    })

    it('should handle --diff option', async () => {
      await suggestCommand.parseAsync(['node', 'suggest', '--diff'])

      expect(execa).toHaveBeenCalledWith('git', ['diff'])
    })

    it('should handle --review option', async () => {
      await suggestCommand.parseAsync(['node', 'suggest', '--review'])

      expect(execa).toHaveBeenCalledWith('git', ['diff', '--staged'])
    })
  })

  describe('Claude Code integration', () => {
    it('should handle Claude Code not available', async () => {
      ;(execa as any).mockImplementation((cmd: string) => {
        if (cmd === 'claude') {
          throw new Error('Command not found: claude')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 })
      })
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'Test feature' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('Claude'))
    })

    it('should parse Claude suggestions correctly', async () => {
      ;(fs as any).default.readFile.mockResolvedValue(
        '1. feature/user-auth\n2. feat/authentication\n3. feature/login-system\n4. auth/user-login\n5. feature/secure-auth'
      )
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'Add user authentication' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect((fs as any).default.readFile).toHaveBeenCalled()
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('提案を生成しました')
      )
    })

    it('should handle empty Claude output', async () => {
      ;(fs as any).default.readFile.mockResolvedValue('')
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'Test feature' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect(mockSpinner.warn).toHaveBeenCalledWith(expect.stringContaining('生成されませんでした'))
    })
  })

  describe('error handling', () => {
    it('should handle not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(suggestCommand.parseAsync(['node', 'suggest'])).rejects.toThrow()
    })

    it('should handle GitHub CLI not available for issue/PR', async () => {
      ;(execa as any).mockImplementation((cmd: string) => {
        if (cmd === 'gh') {
          throw new Error('gh: command not found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 })
      })

      await suggestCommand.parseAsync(['node', 'suggest', '--issue', '123'])

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('GitHub CLI'))
    })

    it('should handle file system errors', async () => {
      ;(fs as any).default.mkdtemp.mockRejectedValue(new Error('Permission denied'))
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'Test feature' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('エラー'))
    })

    it('should clean up temporary files on error', async () => {
      ;(execa as any).mockRejectedValue(new Error('Claude execution failed'))
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'Test feature' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect((fs as any).default.rm).toHaveBeenCalledWith('/tmp/maestro-suggest-123', {
        recursive: true,
        force: true,
      })
    })
  })

  describe('suggestion formatting', () => {
    it('should format suggestions for display', async () => {
      ;(fs as any).default.readFile.mockResolvedValue(
        '1. feature/user-auth\n2. feat/authentication\n3. feature/login-system'
      )
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'Add authentication' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      // 提案がフォーマットされて表示されることを確認
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature/user-auth'))
    })

    it('should filter duplicate suggestions', async () => {
      mockGitManager.listBranches.mockResolvedValue(['feature/auth', 'feature/login'])
      ;(fs as any).default.readFile.mockResolvedValue(
        '1. feature/auth\n2. feature/login\n3. feature/new-auth'
      )
      ;(inquirer as any).default.prompt
        .mockResolvedValueOnce({ suggestionType: '🌿 ブランチ名' })
        .mockResolvedValueOnce({ description: 'Authentication feature' })

      await suggestCommand.parseAsync(['node', 'suggest'])

      // 重複が除去されることを確認
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature/new-auth'))
    })
  })
})

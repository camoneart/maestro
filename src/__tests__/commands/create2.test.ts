import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createCommand } from '../../commands/create.js'
import { GitWorktreeManager } from '../../core/git.js'
import { ConfigManager } from '../../core/config.js'
import { getTemplateConfig } from '../../commands/template.js'
import inquirer from 'inquirer'
import ora from 'ora'
import { execa } from 'execa'
import chalk from 'chalk'
import fs from 'fs/promises'
import path from 'path'

vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn(),
}))

vi.mock('../../core/config.js', () => ({
  ConfigManager: vi.fn(),
}))

vi.mock('../../commands/template.js', () => ({
  getTemplateConfig: vi.fn(),
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

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    copyFile: vi.fn(),
    access: vi.fn(),
  },
}))

describe.skip('create command - additional tests', () => {
  let consoleLogSpy: Mock
  let consoleErrorSpy: Mock
  let processExitSpy: Mock
  let processCwdSpy: Mock
  let mockGitManager: {
    isGitRepository: Mock
    listWorktrees: Mock
    createWorktree: Mock
    getConfigValue: Mock
    getCurrentBranch: Mock
  }
  let mockConfigManager: {
    loadProjectConfig: Mock
    get: Mock
    getAll: Mock
  }
  let mockSpinner: any

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`Process exited with code ${code}`)
    })
    processCwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/project/root')

    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([]),
      createWorktree: vi.fn().mockResolvedValue('/project/root/.git/shadow-clones/feature-1'),
      getConfigValue: vi.fn().mockResolvedValue(null),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
    }
    ;(GitWorktreeManager as any).mockImplementation(() => mockGitManager)

    // ConfigManagerのモック
    mockConfigManager = {
      loadProjectConfig: vi.fn(),
      get: vi.fn().mockReturnValue({ path: '.git/shadow-clones' }),
      getAll: vi.fn().mockReturnValue({
        worktrees: { path: '.git/shadow-clones' },
        development: { autoSetup: false },
      }),
    }
    ;(ConfigManager as any).mockImplementation(() => mockConfigManager)

    // oraのモック
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      warn: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      text: '',
    }
    ;(ora as Mock).mockReturnValue(mockSpinner)

    // getTemplateConfigのモック
    ;(getTemplateConfig as Mock).mockReturnValue(null)
    
    // inquirerのモック - デフォルトで確認をYesにする
    ;(inquirer as any).default.prompt.mockResolvedValue({ confirmCreate: true })
    
    // execaのモック
    ;(execa as Mock).mockResolvedValue({ stdout: '' })
  })

  describe('basic create functionality', () => {
    it('should create worktree with specified branch name', async () => {
      mockGitManager.createWorktree.mockResolvedValue('/project/root/.git/shadow-clones/feature-1')
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'feature-new',
        expect.stringContaining('.git/shadow-clones/feature-new')
      )
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        '影分身の術が成功しました！'
      )
    })

    it('should handle issue number format', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', '123'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'issue-123',
        expect.any(String)
      )
    })

    it('should handle issue number with # prefix', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', '#456'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'issue-456',
        expect.any(String)
      )
    })

    it('should handle issue-prefixed format', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'issue-789'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'issue-789',
        expect.any(String)
      )
    })
  })

  describe('template functionality', () => {
    it('should apply template configuration', async () => {
      const templateConfig = {
        hooks: {
          afterCreate: 'echo "Template applied"',
        },
        files: ['template-file.txt'],
        development: {
          autoSetup: true,
        },
      }
      ;(getTemplateConfig as Mock).mockReturnValue(templateConfig)
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new', '--template', 'feature'])

      expect(getTemplateConfig).toHaveBeenCalledWith('feature')
      expect(execa).toHaveBeenCalledWith(
        'sh',
        ['-c', 'echo "Template applied"'],
        expect.any(Object)
      )
    })

    it('should copy template files', async () => {
      const templateConfig = {
        files: ['template.md', 'config.json'],
      }
      ;(getTemplateConfig as Mock).mockReturnValue(templateConfig)
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(fs.readdir as Mock).mockResolvedValue(['template.md', 'config.json'])
      ;(fs.access as Mock).mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new', '--template', 'docs'])

      expect(fs.copyFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('GitHub integration', () => {
    it('should fetch GitHub issue metadata', async () => {
      const githubData = {
        number: 123,
        title: 'Test Issue',
        body: 'Issue description',
        author: { login: 'user1' },
        labels: [{ name: 'bug' }],
        assignees: [{ login: 'dev1' }],
        url: 'https://github.com/org/repo/issues/123',
      }
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock)
        .mockResolvedValueOnce({ stdout: JSON.stringify(githubData) }) // gh issue view
        .mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', '123'])

      expect(execa).toHaveBeenCalledWith(
        'gh',
        ['issue', 'view', '123', '--json', expect.any(String)],
        expect.any(Object)
      )
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.scj-metadata.json'),
        expect.stringContaining('Test Issue')
      )
    })

    it('should handle GitHub API errors gracefully', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock)
        .mockRejectedValueOnce(new Error('gh: issue not found')) // gh issue view fails
        .mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', '999'])

      // Should still create worktree even if GitHub fetch fails
      expect(mockGitManager.createWorktree).toHaveBeenCalled()
    })
  })

  describe('options handling', () => {
    it('should handle --base option', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new', '--base', 'develop'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'feature-new',
        expect.any(String),
        'develop'
      )
    })

    it('should handle --open option', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      mockConfigManager.get.mockReturnValue({
        worktrees: { path: '.git/shadow-clones' },
        development: { defaultEditor: 'code' },
      })
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new', '--open'])

      expect(execa).toHaveBeenCalledWith(
        'code',
        [expect.stringContaining('.git/shadow-clones/feature-new')],
        expect.any(Object)
      )
    })

    it('should handle --setup option', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new', '--setup'])

      expect(mockSpinner.text).toBe('環境をセットアップ中...')
      expect(execa).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({
          cwd: expect.stringContaining('.git/shadow-clones/feature-new'),
        })
      )
    })

    it('should handle --tmux option', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new', '--tmux'])

      expect(execa).toHaveBeenCalledWith(
        'tmux',
        expect.arrayContaining(['new-session', '-s', 'refs-heads-feature-new']),
        expect.any(Object)
      )
    })

    it('should handle --claude option', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      mockConfigManager.getAll.mockReturnValue({
        claude: {
          autoStart: true,
          markdownMode: 'shared',
        },
      })
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new', '--claude'])

      expect(execa).toHaveBeenCalledWith(
        'claude',
        [],
        expect.objectContaining({
          cwd: expect.stringContaining('.git/shadow-clones/feature-new'),
        })
      )
    })

    it('should handle --draft-pr option', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new', '--draft-pr'])

      expect(execa).toHaveBeenCalledWith(
        'gh',
        ['pr', 'create', '--draft', '--fill-first'],
        expect.any(Object)
      )
    })
  })

  describe('error handling', () => {
    it('should handle not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(
        createCommand.parseAsync(['node', 'create', 'feature-new'])
      ).rejects.toThrow('Process exited with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        'このディレクトリはGitリポジトリではありません'
      )
    })

    it('should handle existing worktree', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([
        {
          path: '/path/to/worktree/feature-exists',
          branch: 'refs/heads/feature-exists',
          commit: 'abc123',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: false,
        },
      ])

      await expect(
        createCommand.parseAsync(['node', 'create', 'feature-exists'])
      ).rejects.toThrow('Process exited with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('既に存在します')
      )
    })

    it('should handle worktree creation error', async () => {
      mockGitManager.createWorktree.mockRejectedValue(
        new Error('Permission denied')
      )

      await expect(
        createCommand.parseAsync(['node', 'create', 'feature-new'])
      ).rejects.toThrow('Process exited with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith('影分身の術に失敗しました')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('エラー:'),
        'Permission denied'
      )
    })
  })

  describe('hooks functionality', () => {
    it('should execute afterCreate hook from config', async () => {
      mockConfigManager.get.mockReturnValue({
        worktrees: { path: '.git/shadow-clones' },
        hooks: {
          afterCreate: 'echo "Hook executed"',
        },
      })
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new'])

      expect(execa).toHaveBeenCalledWith(
        'sh',
        ['-c', 'echo "Hook executed"'],
        expect.objectContaining({
          env: expect.objectContaining({
            SHADOW_CLONE: 'feature-new',
          }),
        })
      )
    })

    it('should handle hook execution errors', async () => {
      mockConfigManager.get.mockReturnValue({
        worktrees: { path: '.git/shadow-clones' },
        hooks: {
          afterCreate: 'exit 1',
        },
      })
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockRejectedValueOnce(new Error('Hook failed'))

      await createCommand.parseAsync(['node', 'create', 'feature-new'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.yellow('フックの実行に失敗しました:'),
        'Hook failed'
      )
    })
  })

  describe('custom worktree path', () => {
    it('should use custom worktree path from config', async () => {
      mockConfigManager.get.mockReturnValue({
        worktrees: { path: 'custom/worktrees' },
      })
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'feature-new',
        expect.stringContaining('custom/worktrees/feature-new')
      )
    })
  })

  describe('metadata persistence', () => {
    it('should save worktree metadata', async () => {
      mockGitManager.createWorktree.mockResolvedValue(undefined)
      ;(execa as Mock).mockResolvedValue({ stdout: '' })

      await createCommand.parseAsync(['node', 'create', 'feature-new'])

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.scj-metadata.json'),
        expect.stringContaining('"branch":"feature-new"')
      )
    })
  })
})
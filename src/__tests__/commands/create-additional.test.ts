import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { createCommand } from '../../commands/create.js'
import { GitWorktreeManager } from '../../core/git.js'
import { ConfigManager } from '../../core/config.js'
import { execa } from 'execa'
import inquirer from 'inquirer'
import ora from 'ora'
import fs from 'fs/promises'

// モック設定
vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn(),
}))

vi.mock('../../core/config.js', () => ({
  ConfigManager: vi.fn(),
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
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    symlink: vi.fn(),
    copyFile: vi.fn(),
  },
}))

vi.mock('../../commands/template.js', () => ({
  getTemplateConfig: vi.fn().mockReturnValue({}),
}))

describe.skip('create command - integration tests', () => {
  let mockGitManager: {
    isGitRepository: Mock
    createWorktree: Mock
    listBranches: Mock
    getCurrentBranch: Mock
  }
  let mockConfigManager: {
    loadProjectConfig: Mock
    getAll: Mock
  }
  let mockSpinner: any

  beforeEach(() => {
    vi.clearAllMocks()

    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree/feature-test'),
      listBranches: vi.fn().mockResolvedValue(['main', 'develop']),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
    }
    ;(GitWorktreeManager as any).mockImplementation(() => mockGitManager)

    // ConfigManagerのモック
    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue({
        worktrees: { 
          path: '.git/shadow-clones',
          branchPrefix: '',
        },
        development: {
          autoSetup: true,
          syncFiles: ['.env'],
          defaultEditor: 'cursor',
        },
        templates: {},
        hooks: {},
        claude: {
          autoStart: false,
          markdownMode: 'shared',
        },
        github: {},
      }),
    }
    ;(ConfigManager as any).mockImplementation(() => mockConfigManager)

    // その他のモック
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
      confirmCreation: true,
    })

    // execaのモック
    ;(execa as any).mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    })

    // fs/promisesのモック
    ;(fs as any).default.access.mockResolvedValue(undefined)
    ;(fs as any).default.writeFile.mockResolvedValue(undefined)
    ;(fs as any).default.mkdir.mockResolvedValue(undefined)
    ;(fs as any).default.symlink.mockResolvedValue(undefined)
    ;(fs as any).default.copyFile.mockResolvedValue(undefined)
  })

  describe('Issue number parsing', () => {
    it('should parse issue number format (#123)', async () => {
      await createCommand.parseAsync(['node', 'create', '#123'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'issue-123',
        undefined
      )
    })

    it('should parse issue number format (123)', async () => {
      await createCommand.parseAsync(['node', 'create', '123'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'issue-123',
        undefined
      )
    })

    it('should parse issue-prefixed format (issue-123)', async () => {
      await createCommand.parseAsync(['node', 'create', 'issue-123'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'issue-123',
        undefined
      )
    })

    it('should handle regular branch names', async () => {
      await createCommand.parseAsync(['node', 'create', 'feature-branch'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'feature-branch',
        undefined
      )
    })
  })

  describe('GitHub integration', () => {
    it('should handle GitHub API unavailable gracefully', async () => {
      ;(execa as any).mockRejectedValueOnce(new Error('gh command not found'))
      
      await createCommand.parseAsync(['node', 'create', '#123'])
      
      // 基本的なworktree作成は継続される
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'issue-123',
        undefined
      )
    })
  })

  describe('Options handling', () => {
    it('should handle --base option', async () => {
      await createCommand.parseAsync(['node', 'create', 'test-branch', '--base', 'develop'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'test-branch',
        'develop'
      )
    })

    it('should handle --setup option', async () => {
      await createCommand.parseAsync(['node', 'create', 'test-branch', '--setup'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'test-branch',
        undefined
      )
      // セットアップ関連の処理が実行される
      expect(execa).toHaveBeenCalled()
    })

    it('should handle --open option', async () => {
      await createCommand.parseAsync(['node', 'create', 'test-branch', '--open'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith(
        'test-branch',
        undefined
      )
    })
  })

  describe('Claude Code integration', () => {
    it('should handle CLAUDE.md in shared mode', async () => {
      await createCommand.parseAsync(['node', 'create', 'test-branch'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalled()
      // CLAUDE.mdのシンボリックリンク作成
      expect((fs as any).default.symlink).toHaveBeenCalled()
    })

    it('should handle CLAUDE.md when file does not exist', async () => {
      ;(fs as any).default.access.mockRejectedValueOnce(new Error('ENOENT'))
      
      await createCommand.parseAsync(['node', 'create', 'test-branch'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalled()
      // エラーをキャッチしてスキップ
    })
  })

  describe('Error handling', () => {
    it('should handle not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)
      
      await createCommand.parseAsync(['node', 'create', 'test-branch'])
      
      expect(mockSpinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('Gitリポジトリ')
      )
    })

    it('should handle worktree creation failure', async () => {
      mockGitManager.createWorktree.mockRejectedValueOnce(new Error('Branch already exists'))
      
      await createCommand.parseAsync(['node', 'create', 'existing-branch'])
      
      expect(mockSpinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('Branch already exists')
      )
    })

    it('should handle configuration loading errors', async () => {
      mockConfigManager.loadProjectConfig.mockRejectedValueOnce(new Error('Config error'))
      
      await createCommand.parseAsync(['node', 'create', 'test-branch'])
      
      // エラーが発生してもデフォルト設定で継続
      expect(mockGitManager.createWorktree).toHaveBeenCalled()
    })
  })

  describe('Template functionality', () => {
    it('should apply template when specified', async () => {
      mockConfigManager.getAll.mockReturnValue({
        ...mockConfigManager.getAll(),
        templates: {
          'react': {
            files: ['package.json', 'src/index.tsx']
          }
        }
      })
      
      await createCommand.parseAsync(['node', 'create', 'test-branch', '--template', 'react'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalled()
    })
  })

  describe('tmux integration', () => {
    it('should handle tmux session creation', async () => {
      await createCommand.parseAsync(['node', 'create', 'test-branch', '--tmux'])
      
      expect(mockGitManager.createWorktree).toHaveBeenCalled()
      // tmux関連のコマンドが実行される
      expect(execa).toHaveBeenCalledWith(
        'tmux',
        expect.arrayContaining(['new-session']),
        expect.any(Object)
      )
    })

    it('should handle tmux not installed', async () => {
      ;(execa as any).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'tmux') {
          throw new Error('tmux: command not found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 })
      })
      
      await createCommand.parseAsync(['node', 'create', 'test-branch', '--tmux'])
      
      // tmuxエラーでも基本的なworktree作成は継続
      expect(mockGitManager.createWorktree).toHaveBeenCalled()
    })
  })
})
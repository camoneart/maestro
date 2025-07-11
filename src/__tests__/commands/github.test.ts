import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Command } from 'commander'
import { execa } from 'execa'
import { ConfigManager } from '../../core/config'
import inquirer from 'inquirer'
import { mockGhAuthStatus, mockGhVersion } from '../utils/test-utils'

// モック設定
vi.mock('execa')
vi.mock('inquirer')
vi.mock('../../core/config')
// GitWorktreeManagerのモックインスタンスをグローバルに定義
let mockGitWorktreeManagerInstance: any

vi.mock('../../core/git', () => {
  return {
    GitWorktreeManager: vi.fn().mockImplementation(() => {
      mockGitWorktreeManagerInstance = {
        isGitRepository: vi.fn().mockResolvedValue(true),
        createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
        attachWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
      }
      return mockGitWorktreeManagerInstance
    }),
  }
})
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  })),
}))

describe('github command', () => {
  let program: Command
  let mockExeca: any
  let mockInquirer: any
  let mockConfigManager: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // GitWorktreeManagerのモックをリセット
    mockGitWorktreeManagerInstance = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
      attachWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
    }
    const { GitWorktreeManager } = await import('../../core/git')
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitWorktreeManagerInstance)

    const { githubCommand } = await import('../../commands/github')

    program = new Command()
    program.exitOverride()
    program.addCommand(githubCommand)

    mockExeca = vi.mocked(execa)
    mockInquirer = vi.mocked(inquirer)
    mockConfigManager = vi.mocked(ConfigManager)

    // process.exitのモック
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    // デフォルトのモック設定
    mockExeca.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'gh' && args[0] === '--version') {
        return Promise.resolve(mockGhVersion())
      }
      if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
        return Promise.resolve(mockGhAuthStatus())
      }
      return Promise.resolve({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any)
    })

    // ConfigManagerのモック
    mockConfigManager.prototype.loadProjectConfig = vi.fn().mockResolvedValue(undefined)
    mockConfigManager.prototype.getAll = vi.fn().mockReturnValue({
      github: {
        branchNaming: {
          prTemplate: 'pr-{number}',
          issueTemplate: 'issue-{number}',
        },
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('checkout type', () => {
    it('should checkout PR by number', async () => {
      const mockPR = {
        number: 123,
        title: 'Add feature',
        headRefName: 'feature-branch',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockPR),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'checkout') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'git' && args[0] === 'checkout' && args[1] === '-') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'git' && args[0] === 'branch' && args[1] === '-D') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // inquirerのモック設定 (確認プロンプト)
      mockInquirer.prompt.mockResolvedValueOnce({ confirmCreate: true })

      await program.parseAsync(['node', 'test', 'github', 'checkout', '123'])

      expect(mockExeca).toHaveBeenCalledWith('gh', [
        'pr',
        'view',
        '123',
        '--json',
        'number,title,headRefName',
      ])
      expect(mockGitWorktreeManagerInstance.attachWorktree).toHaveBeenCalledWith('pr-123')
    })

    it('should handle interactive PR selection', async () => {
      const mockPRs = [
        { number: 123, title: 'Feature A', author: { login: 'user1' } },
        { number: 124, title: 'Feature B', author: { login: 'user2' } },
      ]

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'list') {
          return Promise.resolve({
            stdout: JSON.stringify(mockPRs),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify({ ...mockPRs[0], headRefName: 'feature-a' }),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt
        .mockResolvedValueOnce({ selectType: 'pr' })
        .mockResolvedValueOnce({ selectedNumber: '123' })
        .mockResolvedValueOnce({ confirmCreate: true })

      // checkoutサブコマンドでは番号が必要なので、process.exitが呼ばれる
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'checkout'])
      } catch (error) {
        // process.exitがスローされることを期待
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('PR/Issue番号を指定してください')
      )

      consoleSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })
  })

  describe('issue type', () => {
    it('should create branch from issue', async () => {
      const mockIssue = {
        number: 456,
        title: 'Bug report',
      }

      // inquirer.promptのモック設定
      mockInquirer.prompt.mockResolvedValueOnce({ confirmCreate: true })

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          throw new Error('no pull requests found')
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockIssue),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'github', 'issue', '456'])

      expect(mockExeca).toHaveBeenCalledWith('gh', [
        'issue',
        'view',
        '456',
        '--json',
        'number,title',
      ])
      expect(mockGitWorktreeManagerInstance.createWorktree).toHaveBeenCalledWith('issue-456')
    })

    it('should use custom branch naming', async () => {
      mockConfigManager.prototype.getAll = vi.fn().mockReturnValue({
        github: {
          branchNaming: {
            issueTemplate: 'issue-{number}-{title}',
          },
        },
      })

      const mockIssue = {
        number: 789,
        title: 'Feature Request',
      }

      // inquirer.promptのモック設定
      mockInquirer.prompt.mockResolvedValueOnce({ confirmCreate: true })

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          throw new Error('no pull requests found')
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockIssue),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'github', 'issue', '789'])

      expect(mockGitWorktreeManagerInstance.createWorktree).toHaveBeenCalledWith(
        'issue-789-feature-request'
      )
    })
  })

  describe('comment type', () => {
    it('should add comment to PR', async () => {
      // detectTypeのためのモック
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view' && args[2] === '123') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'github', 'comment', '123', '-m', 'Great work!'])

      expect(mockExeca).toHaveBeenCalledWith('gh', [
        'pr',
        'comment',
        '123',
        '--body',
        'Great work!',
      ])
    })

    it('should prompt for comment body if not provided', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        comment: 'Interactive comment', // 'message' ではなく 'comment'
      })

      // detectTypeのためのモック
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view' && args[2] === '123') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'github', 'comment', '123'])

      expect(mockInquirer.prompt).toHaveBeenCalled()
      expect(mockExeca).toHaveBeenCalledWith('gh', [
        'pr',
        'comment',
        '123',
        '--body',
        'Interactive comment',
      ])
    })
  })

  describe('state management', () => {
    it('should close a PR', async () => {
      // detectTypeのためのモック
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view' && args[2] === '123') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // インタラクティブな入力をスキップするために、inquirer.promptをモック
      mockInquirer.prompt.mockResolvedValueOnce({ comment: 'Closing' })

      await program.parseAsync(['node', 'test', 'github', 'comment', '123', '--close'])

      // detectTypeとcomment サブコマンドの処理により、実際の順序は変わる
      expect(mockExeca).toHaveBeenCalledWith('gh', ['pr', 'close', '123'])
    })

    it('should reopen a PR', async () => {
      // detectTypeのためのモック
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view' && args[2] === '123') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // インタラクティブな入力をスキップするために、inquirer.promptをモック
      mockInquirer.prompt.mockResolvedValueOnce({ comment: 'Reopening' })

      await program.parseAsync(['node', 'test', 'github', 'comment', '123', '--reopen'])

      // detectTypeとcomment サブコマンドの処理により、実際の順序は変わる
      expect(mockExeca).toHaveBeenCalledWith('gh', ['pr', 'reopen', '123'])
    })
  })

  describe('error handling', () => {
    it('should handle gh CLI not installed', async () => {
      mockExeca.mockRejectedValue(new Error('command not found: gh'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'checkout', '123'])
      } catch {
        // エラーがスローされることを期待
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle unauthenticated gh CLI', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          throw new Error('not authenticated')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'checkout', '123'])
      } catch {
        // エラーがスローされることを期待
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle PR/Issue not found', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          throw new Error('no pull requests found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'checkout', '999'])
      } catch {
        // エラーがスローされることを期待
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})

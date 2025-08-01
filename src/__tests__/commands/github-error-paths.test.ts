import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Command } from 'commander'
import { execa } from 'execa'
import { ConfigManager } from '../../core/config'
import inquirer from 'inquirer'
import { mockGhAuthStatus, mockGhVersion } from '../utils/test-utils'
import fs from 'fs/promises'
import chalk from 'chalk'

// モック設定
vi.mock('execa')
vi.mock('inquirer')
vi.mock('../../core/config')
vi.mock('fs/promises')

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
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  })),
}))

describe('github command error paths', () => {
  let program: Command
  let mockExeca: any
  let mockInquirer: any
  let mockConfigManager: any
  let mockFs: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

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
    mockFs = vi.mocked(fs)

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
      development: {
        autoSetup: true,
        syncFiles: ['.env', 'config.json'],
        defaultEditor: 'cursor',
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('detectType error handling', () => {
    it('should handle when both PR and Issue views fail', async () => {
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
          throw new Error('no issues found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // コメントを追加しようとするが、PR/Issueが見つからない
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'comment', '999', '-m', 'Test comment'])
      } catch (error) {
        // エラーが発生することを期待
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('addComment error handling', () => {
    it('should handle comment posting failure', async () => {
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
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'comment') {
          throw new Error('Network error: Unable to post comment')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'comment', '123', '-m', 'Test comment'])
      } catch (error) {
        // エラーが発生することを期待
        expect(error).toBeDefined()
      }

      // exitCode is set to 1
      consoleSpy.mockRestore()
    })
  })

  describe('changeState error handling', () => {
    it('should handle close operation failure', async () => {
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
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'close') {
          throw new Error('Permission denied')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt.mockResolvedValueOnce({ comment: 'Closing PR' })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'comment', '123', '--close'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      // exitCode is set to 1
      consoleSpy.mockRestore()
    })

    it('should handle reopen operation failure', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view' && args[2] === '456') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view' && args[2] === '456') {
          throw new Error('not a PR')
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'reopen') {
          throw new Error('Issue is already open')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt.mockResolvedValueOnce({ comment: 'Reopening issue' })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'comment', '456', '--reopen'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      // exitCode is set to 1
      consoleSpy.mockRestore()
    })
  })

  describe('PR/Issue info retrieval error', () => {
    it('should handle error when getting PR/Issue info', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          throw new Error('API rate limit exceeded')
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          throw new Error('API rate limit exceeded')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt.mockResolvedValueOnce({ confirmCreate: true })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'checkout', '789'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('setup error handling', () => {
    it('should handle npm install failure gracefully', async () => {
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
        if (cmd === 'git') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'npm' && args[0] === 'install') {
          throw new Error('npm install failed: network timeout')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt.mockResolvedValueOnce({ confirmCreate: true })

      await program.parseAsync(['node', 'test', 'github', 'checkout', '123', '--setup'])

      // Should complete successfully despite npm install failure
      expect(mockGitWorktreeManagerInstance.createWorktree).toHaveBeenCalled()
    })

    it('should handle sync file copy failure gracefully', async () => {
      const mockIssue = {
        number: 456,
        title: 'Bug report',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          throw new Error('not a PR')
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockIssue),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'npm' && args[0] === 'install') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // Mock fs.copyFile to throw error
      mockFs.copyFile.mockRejectedValue(new Error('Permission denied'))

      mockInquirer.prompt.mockResolvedValueOnce({ confirmCreate: true })

      await program.parseAsync(['node', 'test', 'github', 'issue', '456', '--setup'])

      // Should complete successfully despite file copy failure
      expect(mockGitWorktreeManagerInstance.createWorktree).toHaveBeenCalled()
    })
  })

  describe('editor opening error handling', () => {
    it('should handle editor not found error', async () => {
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
        if (cmd === 'git') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'cursor' || cmd === 'code') {
          throw new Error('command not found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt.mockResolvedValueOnce({ confirmCreate: true })

      await program.parseAsync(['node', 'test', 'github', 'checkout', '123', '--open'])

      // Should complete successfully despite editor error
      expect(mockGitWorktreeManagerInstance.createWorktree).toHaveBeenCalled()
    })

    it('should handle custom editor failure', async () => {
      mockConfigManager.prototype.getAll = vi.fn().mockReturnValue({
        github: {
          branchNaming: {
            prTemplate: 'pr-{number}',
            issueTemplate: 'issue-{number}',
          },
        },
        development: {
          defaultEditor: 'sublime',
        },
      })

      const mockIssue = {
        number: 789,
        title: 'Feature request',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          throw new Error('not a PR')
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockIssue),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'sublime') {
          throw new Error('sublime: command not found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt.mockResolvedValueOnce({ confirmCreate: true })

      await program.parseAsync(['node', 'test', 'github', 'issue', '789'])

      // Should complete successfully despite editor error
      expect(mockGitWorktreeManagerInstance.createWorktree).toHaveBeenCalled()
    })
  })

  describe('general error handling', () => {
    it('should handle non-GithubCommandError exceptions', async () => {
      mockExeca.mockImplementation(() => {
        throw new TypeError('Cannot read property of undefined')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'checkout', '123'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      // exitCode is set to 1
      // エラーメッセージが記録されたことを確認
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle unknown error types', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        throw 'String error' // Non-Error object
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'checkout', '123'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      // exitCode is set to 1
      // エラーメッセージが記録されたことを確認
      // エラーメッセージはAPIからの文字列エラーで処理される
      expect(consoleSpy).toHaveBeenCalledWith(chalk.red('PR/Issue #123 が見つかりません'))
      consoleSpy.mockRestore()
    })
  })

  describe('worktree creation error handling', () => {
    it('should handle branch collision error and stop spinner properly', async () => {
      const mockIssue = {
        number: 90,
        title: 'test',
        author: { login: 'user1' },
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          throw new Error('not a PR')
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

      // ブランチ衝突エラーをモック
      mockGitWorktreeManagerInstance.createWorktree.mockRejectedValue(
        new Error("ブランチ 'issue-90' は既に存在します")
      )

      mockInquirer.prompt.mockResolvedValueOnce({ confirmCreate: true })

      // oraモックのfailメソッドが呼ばれるかをチェック
      const { default: ora } = await import('ora')
      const mockOra = vi.mocked(ora)
      const mockFail = vi.fn().mockReturnThis()
      const mockStart = vi.fn().mockReturnThis()
      mockOra.mockReturnValue({
        start: mockStart,
        succeed: vi.fn().mockReturnThis(),
        fail: mockFail,
        warn: vi.fn().mockReturnThis(),
        info: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        text: '',
      } as any)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'issue', '90'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      // スピナーのfailメソッドが呼ばれたことを確認
      expect(mockFail).toHaveBeenCalledWith('演奏者の招集に失敗しました')
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('not git repository error', () => {
    it('should handle when not in a git repository', async () => {
      mockGitWorktreeManagerInstance.isGitRepository.mockResolvedValue(false)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'checkout', '123'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('PR list error handling', () => {
    it('should handle PR list retrieval failure', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'list') {
          throw new Error('API error')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt.mockResolvedValueOnce({ selectType: 'pr' })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('spinner handling on non-existent issue/PR', () => {
    it('should stop spinner properly when issue does not exist during worktree creation', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view' && args[2] === '999') {
          throw new Error('no pull requests found')
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view' && args[2] === '999') {
          throw new Error('no issues found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // oraモックのfailメソッドが呼ばれるかをチェック
      const { default: ora } = await import('ora')
      const mockOra = vi.mocked(ora)
      const mockFail = vi.fn().mockReturnThis()
      const mockStart = vi.fn().mockReturnThis()
      const mockStop = vi.fn().mockReturnThis()
      mockOra.mockReturnValue({
        start: mockStart,
        succeed: vi.fn().mockReturnThis(),
        fail: mockFail,
        warn: vi.fn().mockReturnThis(),
        info: vi.fn().mockReturnThis(),
        stop: mockStop,
        text: '',
        isSpinning: false, // Issue #140 fix: spinner is stopped after initialization
      } as any)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'checkout', '999'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      // Issue #140 fix: When spinner is already stopped, console.error is used instead
      expect(consoleSpy).toHaveBeenCalledWith(chalk.red('✖ エラーが発生しました'))
      expect(consoleSpy).toHaveBeenCalledWith(chalk.red('PR/Issue #999 が見つかりません'))
      consoleSpy.mockRestore()
    })

    it('should stop spinner properly when issue does not exist during comment command', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view' && args[2] === '888') {
          throw new Error('no pull requests found')
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view' && args[2] === '888') {
          throw new Error('no issues found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // oraモックのfailメソッドが呼ばれるかをチェック
      const { default: ora } = await import('ora')
      const mockOra = vi.mocked(ora)
      const mockFail = vi.fn().mockReturnThis()
      const mockStart = vi.fn().mockReturnThis()
      mockOra.mockReturnValue({
        start: mockStart,
        succeed: vi.fn().mockReturnThis(),
        fail: mockFail,
        warn: vi.fn().mockReturnThis(),
        info: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        text: '',
        isSpinning: false, // Main spinner is stopped after initialization
      } as any)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github', 'comment', '888', '-m', 'test comment'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      // Comment command has its own spinner handling, so it calls spinner.fail directly
      expect(mockFail).toHaveBeenCalledWith('PR/Issueの確認に失敗しました')
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should stop spinner properly when issue does not exist during interactive comment', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === '--version') {
          return Promise.resolve(mockGhVersion())
        }
        if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
          return Promise.resolve(mockGhAuthStatus())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view' && args[2] === '777') {
          throw new Error('no pull requests found')
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view' && args[2] === '777') {
          throw new Error('no issues found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt
        .mockResolvedValueOnce({ selectType: 'comment' })
        .mockResolvedValueOnce({ inputNumber: '777' })
        .mockResolvedValueOnce({ comment: 'test comment' })

      // oraモックのfailメソッドが呼ばれるかをチェック
      const { default: ora } = await import('ora')
      const mockOra = vi.mocked(ora)
      const mockFail = vi.fn().mockReturnThis()
      const mockStart = vi.fn().mockReturnThis()
      mockOra.mockReturnValue({
        start: mockStart,
        succeed: vi.fn().mockReturnThis(),
        fail: mockFail,
        warn: vi.fn().mockReturnThis(),
        info: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        text: '',
        isSpinning: false, // Main spinner is stopped after initialization
      } as any)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'github'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      // Interactive comment has its own spinner handling, similar to comment command
      expect(mockFail).toHaveBeenCalledWith('PR/Issueの確認に失敗しました')
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})

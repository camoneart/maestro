import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Command } from 'commander'
import { execa } from 'execa'
import inquirer from 'inquirer'
import { mockGhRepoView } from '../utils/test-utils'

// モック設定
vi.mock('execa')
vi.mock('inquirer')
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

// GitWorktreeManagerのモック
vi.mock('../../core/git', () => {
  return {
    GitWorktreeManager: vi.fn().mockImplementation(() => ({
      isGitRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
      attachWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
      listWorktrees: vi.fn().mockResolvedValue([]),
    })),
  }
})

describe('review command', () => {
  let program: Command
  let mockExeca: any
  let mockInquirer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // GitWorktreeManagerのモックをリセット
    const { GitWorktreeManager } = await import('../../core/git')
    vi.mocked(GitWorktreeManager).mockImplementation(
      () =>
        ({
          isGitRepository: vi.fn().mockResolvedValue(true),
          createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
          attachWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
          listWorktrees: vi.fn().mockResolvedValue([]),
        }) as any
    )

    const { reviewCommand } = await import('../../commands/review')

    program = new Command()
    program.exitOverride()
    program.addCommand(reviewCommand)

    mockExeca = vi.mocked(execa)
    mockInquirer = vi.mocked(inquirer)

    // デフォルトのモック設定
    mockExeca.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'gh' && args[0] === '--version') {
        return Promise.resolve({
          stdout: 'gh version 2.40.0 (2025-01-01)',
          stderr: '',
          exitCode: 0,
        } as any)
      }
      if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
        return Promise.resolve({
          stdout: '✓ Logged in to github.com as test-user',
          stderr: '',
          exitCode: 0,
        } as any)
      }
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
        return Promise.resolve(mockGhRepoView())
      }
      return Promise.resolve({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('basic review', () => {
    it('should approve a PR', async () => {
      const mockPR = {
        number: 123,
        title: 'Add feature X',
        author: { login: 'user1' },
        headRefName: 'feature-x',
        baseRefName: 'main',
        url: 'https://github.com/owner/repo/pull/123',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockPR),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'review', '123', '--approve'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['pr', 'review', '123', '--approve'])
    })

    it('should request changes on a PR', async () => {
      const mockPR = {
        number: 123,
        title: 'Add feature X',
        author: { login: 'user1' },
        headRefName: 'feature-x',
        baseRefName: 'main',
        url: 'https://github.com/owner/repo/pull/123',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockPR),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'review', '123', '--request-changes'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['pr', 'review', '123', '--request-changes'])
    })

    it('should add a comment to PR', async () => {
      const mockPR = {
        number: 123,
        title: 'Add feature X',
        author: { login: 'user1' },
        headRefName: 'feature-x',
        baseRefName: 'main',
        url: 'https://github.com/owner/repo/pull/123',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockPR),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'review', '123', '--comment', 'LGTM'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['pr', 'comment', '123', '--body', 'LGTM'])
    })
  })

  describe('interactive review', () => {
    it('should review interactively when no options provided', async () => {
      const mockPR = {
        number: 123,
        title: 'Add feature X',
        author: { login: 'user1' },
        headRefName: 'feature-x',
        baseRefName: 'main',
        url: 'https://github.com/owner/repo/pull/123',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockPR),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // インタラクティブな選択のモック
      mockInquirer.prompt.mockResolvedValueOnce({
        action: 'approve',
      })

      await program.parseAsync(['node', 'test', 'review', '123'])

      expect(mockExeca).toHaveBeenCalledWith('gh', [
        'pr',
        'view',
        '123',
        '--json',
        'number,title,author,body,headRefName,baseRefName,state,url',
      ])
      expect(mockInquirer.prompt).toHaveBeenCalled()
    })
  })

  describe('reviewer assignment', () => {
    it('should assign a reviewer', async () => {
      const mockPR = {
        number: 123,
        title: 'Add feature X',
        author: { login: 'user1' },
        headRefName: 'feature-x',
        baseRefName: 'main',
        url: 'https://github.com/owner/repo/pull/123',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockPR),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'review', '123', '--assign', 'user2'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['pr', 'edit', '123', '--add-reviewer', 'user2'])
    })
  })

  describe('error handling', () => {
    it('should handle PR not found', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          throw new Error('no pull requests found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'review', '999', '--approve'])
      } catch (error) {
        // エラーがスローされることを期待
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle network errors', async () => {
      mockExeca.mockRejectedValue(new Error('Network error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'review', '123', '--approve'])
      } catch (error) {
        // エラーがスローされることを期待
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})

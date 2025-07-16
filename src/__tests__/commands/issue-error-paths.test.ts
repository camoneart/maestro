import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Command } from 'commander'
import { execa } from 'execa'
import inquirer from 'inquirer'
import { mockGhRepoView, mockGhAuthStatus, mockGhVersion } from '../utils/test-utils'

// モック設定
vi.mock('execa')
vi.mock('inquirer')
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  })),
}))

// GitWorktreeManagerのモック
let mockGitWorktreeManagerInstance: any
vi.mock('../../core/git', () => {
  return {
    GitWorktreeManager: vi.fn().mockImplementation(() => {
      mockGitWorktreeManagerInstance = {
        isGitRepository: vi.fn().mockResolvedValue(true),
        createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
      }
      return mockGitWorktreeManagerInstance
    }),
  }
})

describe('issue command error paths', () => {
  let program: Command
  let mockExeca: any
  let mockInquirer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // GitWorktreeManagerのモックをリセット
    mockGitWorktreeManagerInstance = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
    }
    const { GitWorktreeManager } = await import('../../core/git')
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitWorktreeManagerInstance)

    const { issueCommand } = await import('../../commands/issue')

    program = new Command()
    program.exitOverride() // process.exitを防ぐ
    program.addCommand(issueCommand)

    mockExeca = vi.mocked(execa)
    mockInquirer = vi.mocked(inquirer)

    // process.exitのモック
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    // デフォルトのモック設定
    mockExeca.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
        return Promise.resolve(mockGhRepoView())
      }
      if (cmd === 'gh' && args[0] === 'auth' && args[1] === 'status') {
        return Promise.resolve(mockGhAuthStatus())
      }
      if (cmd === 'gh' && args[0] === '--version') {
        return Promise.resolve(mockGhVersion())
      }
      return Promise.resolve({
        stdout: JSON.stringify([]),
        stderr: '',
        exitCode: 0,
      } as any)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('close issue error handling', () => {
    it('should handle close issue failure', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view' && args[2] === '123') {
          return Promise.resolve({
            stdout: JSON.stringify({
              number: 123,
              title: 'Test Issue',
              state: 'OPEN',
              author: { login: 'user1' },
              labels: [],
              assignees: [],
              url: 'https://github.com/owner/repo/issues/123',
            }),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'close') {
          throw new Error('Permission denied')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '123', '--close'])
      } catch (error) {
        // エラーが発生することを期待
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied'))
      consoleSpy.mockRestore()
    })
  })

  describe('assign user error handling', () => {
    it('should handle assign user failure', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view' && args[2] === '456') {
          return Promise.resolve({
            stdout: JSON.stringify({
              number: 456,
              title: 'Test Issue',
              state: 'OPEN',
              author: { login: 'user1' },
              labels: [],
              assignees: [],
              url: 'https://github.com/owner/repo/issues/456',
            }),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'edit' && args.includes('--add-assignee')) {
          throw new Error('User not found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '456', '--assign', 'nonexistent'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('User not found'))
      consoleSpy.mockRestore()
    })
  })

  describe('add labels error handling', () => {
    it('should handle add labels failure', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view' && args[2] === '789') {
          return Promise.resolve({
            stdout: JSON.stringify({
              number: 789,
              title: 'Test Issue',
              state: 'OPEN',
              author: { login: 'user1' },
              labels: [],
              assignees: [],
              url: 'https://github.com/owner/repo/issues/789',
            }),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'edit' && args.includes('--add-label')) {
          throw new Error('Label not found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '789', '--label', 'invalid-label'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Label not found'))
      consoleSpy.mockRestore()
    })
  })

  describe('set milestone error handling', () => {
    it('should handle set milestone failure', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view' && args[2] === '111') {
          return Promise.resolve({
            stdout: JSON.stringify({
              number: 111,
              title: 'Test Issue',
              state: 'OPEN',
              author: { login: 'user1' },
              labels: [],
              assignees: [],
              url: 'https://github.com/owner/repo/issues/111',
            }),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'edit' && args.includes('--milestone')) {
          throw new Error('Milestone not found')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '111', '--milestone', 'v99.0'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Milestone not found'))
      consoleSpy.mockRestore()
    })
  })

  describe('GitHub repository check error', () => {
    it('should handle non-GitHub repository', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          throw new Error('not a github repo')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '--list'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('gh CLIがインストールされていないか、認証されていません')
      )
      consoleSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })
  })

  describe('no issues found error', () => {
    it('should handle no issues found when selecting issue', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'list') {
          return Promise.resolve({
            stdout: JSON.stringify([]),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('オープンなIssueが見つかりません'))
      consoleSpy.mockRestore()
    })
  })

  describe('create issue error handling', () => {
    it('should handle issue creation failure', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({ title: 'New Issue' })
        .mockResolvedValueOnce({ body: 'Issue description' })

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'create') {
          throw new Error('API rate limit exceeded')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '--create'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API rate limit exceeded'))
      consoleSpy.mockRestore()
    })
  })

  describe('interactive menu actions', () => {
    it('should handle create-branch action from interactive menu', async () => {
      const mockIssue = {
        number: 222,
        title: 'Test Issue',
        state: 'OPEN',
        author: { login: 'user1' },
        labels: [],
        assignees: [],
        url: 'https://github.com/owner/repo/issues/222',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
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

      mockInquirer.prompt.mockResolvedValueOnce({ action: 'create-branch' })

      await program.parseAsync(['node', 'test', 'issue', '222'])

      expect(mockGitWorktreeManagerInstance.createWorktree).toHaveBeenCalledWith('issue-222')
    })

    it('should handle create-branch action failure', async () => {
      const mockIssue = {
        number: 333,
        title: 'Test Issue',
        state: 'OPEN',
        author: { login: 'user1' },
        labels: [],
        assignees: [],
        url: 'https://github.com/owner/repo/issues/333',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
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

      mockInquirer.prompt.mockResolvedValueOnce({ action: 'create-branch' })
      mockGitWorktreeManagerInstance.createWorktree.mockRejectedValueOnce(new Error('Worktree already exists'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '333'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Worktree already exists'))
      consoleSpy.mockRestore()
    })

    it('should handle web action from interactive menu', async () => {
      const mockIssue = {
        number: 444,
        title: 'Test Issue',
        state: 'OPEN',
        author: { login: 'user1' },
        labels: [],
        assignees: [],
        url: 'https://github.com/owner/repo/issues/444',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
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

      mockInquirer.prompt.mockResolvedValueOnce({ action: 'web' })

      await program.parseAsync(['node', 'test', 'issue', '444'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['issue', 'view', '444', '--web'])
    })

    it('should handle close action from interactive menu', async () => {
      const mockIssue = {
        number: 555,
        title: 'Test Issue',
        state: 'OPEN',
        author: { login: 'user1' },
        labels: [],
        assignees: [],
        url: 'https://github.com/owner/repo/issues/555',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockIssue),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'close') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt.mockResolvedValueOnce({ action: 'close' })

      await program.parseAsync(['node', 'test', 'issue', '555'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['issue', 'close', '555'])
    })

    it('should handle assign action from interactive menu', async () => {
      const mockIssue = {
        number: 666,
        title: 'Test Issue',
        state: 'OPEN',
        author: { login: 'user1' },
        labels: [],
        assignees: [],
        url: 'https://github.com/owner/repo/issues/666',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockIssue),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'edit') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt
        .mockResolvedValueOnce({ action: 'assign' })
        .mockResolvedValueOnce({ assignee: 'dev1' })

      await program.parseAsync(['node', 'test', 'issue', '666'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['issue', 'edit', '666', '--add-assignee', 'dev1'])
    })

    it('should handle label action from interactive menu', async () => {
      const mockIssue = {
        number: 777,
        title: 'Test Issue',
        state: 'OPEN',
        author: { login: 'user1' },
        labels: [],
        assignees: [],
        url: 'https://github.com/owner/repo/issues/777',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockIssue),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'edit') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt
        .mockResolvedValueOnce({ action: 'label' })
        .mockResolvedValueOnce({ label: 'bug, urgent' })

      await program.parseAsync(['node', 'test', 'issue', '777'])

      expect(mockExeca).toHaveBeenCalledWith('gh', [
        'issue',
        'edit',
        '777',
        '--add-label',
        'bug',
        '--add-label',
        'urgent',
      ])
    })

    it('should handle milestone action from interactive menu', async () => {
      const mockIssue = {
        number: 888,
        title: 'Test Issue',
        state: 'OPEN',
        author: { login: 'user1' },
        labels: [],
        assignees: [],
        url: 'https://github.com/owner/repo/issues/888',
      }

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return Promise.resolve({
            stdout: JSON.stringify(mockIssue),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'edit') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockInquirer.prompt
        .mockResolvedValueOnce({ action: 'milestone' })
        .mockResolvedValueOnce({ milestone: 'v2.0' })

      await program.parseAsync(['node', 'test', 'issue', '888'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['issue', 'edit', '888', '--milestone', 'v2.0'])
    })
  })

  describe('non-IssueCommandError handling', () => {
    it('should handle general errors properly', async () => {
      mockExeca.mockImplementation(() => {
        throw new TypeError('Cannot read property of undefined')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '--list'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      // エラーが記録されたことを確認
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle non-Error objects', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        throw 'String error'  // Non-Error object
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '--list'])
      } catch (error) {
        expect(error).toBeDefined()
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('不明なエラー'))
      consoleSpy.mockRestore()
    })
  })

  describe('create issue with branch creation', () => {
    it('should create issue and then create branch', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({ title: 'New Issue' })
        .mockResolvedValueOnce({ body: 'Issue description' })
        .mockResolvedValueOnce({ createBranch: true })

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'create') {
          return Promise.resolve({
            stdout: 'https://github.com/owner/repo/issues/999',
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'issue', '--create'])

      expect(mockGitWorktreeManagerInstance.createWorktree).toHaveBeenCalledWith('issue-999')
    })
  })

  describe('empty list handling', () => {
    it('should handle empty issue list properly', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'list') {
          return Promise.resolve({
            stdout: JSON.stringify([]),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'test', 'issue', '--list'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('オープンなIssueが見つかりません')
      )
      consoleLogSpy.mockRestore()
    })
  })
})
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

vi.mock('../../core/git', () => ({
  GitWorktreeManager: vi.fn().mockImplementation(() => ({
    isGitRepository: vi.fn().mockResolvedValue(true),
  })),
}))

describe('issue command', () => {
  let program: Command
  let mockExeca: any
  let mockInquirer: any

  beforeEach(async () => {
    vi.resetModules()
    const { issueCommand } = await import('../../commands/issue')
    
    program = new Command()
    program.exitOverride() // process.exitを防ぐ
    program.addCommand(issueCommand)

    mockExeca = vi.mocked(execa)
    mockInquirer = vi.mocked(inquirer)
    vi.clearAllMocks()

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

  describe('list option', () => {
    it('should list open issues', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Bug: Something is broken',
          state: 'OPEN',
          author: { login: 'user1' },
          labels: [{ name: 'bug', color: 'ff0000' }],
          assignees: [],
        },
      ]

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'list') {
          return Promise.resolve({
            stdout: JSON.stringify(mockIssues),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'issue', '--list'])

      expect(mockExeca).toHaveBeenCalledWith(
        'gh',
        ['issue', 'list', '--json', 'number,title,author,state,labels,assignees', '--limit', '30']
      )
    })
  })

  describe('create option', () => {
    it('should create an issue with interactive prompts', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({
        title: 'New Issue',
        body: 'Issue description',
        labels: [],
        assignees: [],
      })

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'label' && args[1] === 'list') {
          return Promise.resolve({
            stdout: JSON.stringify([{ name: 'bug', color: 'ff0000' }]),
            stderr: '',
            exitCode: 0,
          } as any)
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'create') {
          return Promise.resolve({
            stdout: 'https://github.com/owner/repo/issues/1',
            stderr: '',
            exitCode: 0,
          } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'issue', '--create'])

      expect(mockInquirer.prompt).toHaveBeenCalled()
      expect(mockExeca).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['issue', 'create', '--title', 'New Issue', '--body', 'Issue description'])
      )
    })
  })

  describe('view issue', () => {
    it('should view an issue by number', async () => {
      const mockIssue = {
        number: 1,
        title: 'Issue Title',
        state: 'OPEN',
        body: 'Issue body',
        author: { login: 'user1' },
        labels: [{ name: 'bug', color: 'ff0000' }],
        assignees: [{ login: 'dev1' }],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
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

      await program.parseAsync(['node', 'test', 'issue', '1'])

      expect(mockExeca).toHaveBeenCalledWith(
        'gh',
        ['issue', 'view', '1', '--json', 'number,title,state,body,labels,author,assignees,createdAt,updatedAt']
      )
    })

    it('should handle web view option', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'view') {
          return Promise.resolve(mockGhRepoView())
        }
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'issue', '1', '--web'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['issue', 'view', '1', '--web'])
    })
  })

  describe('error handling', () => {
    it('should handle non-git repository', async () => {
      const { GitWorktreeManager } = await import('../../core/git')
      vi.mocked(GitWorktreeManager).mockImplementation(() => ({
        isGitRepository: vi.fn().mockResolvedValue(false),
      }) as any)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'issue', '--list'])
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
        await program.parseAsync(['node', 'test', 'issue', '--list'])
      } catch (error) {
        // エラーがスローされることを期待
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
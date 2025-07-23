import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pushCommand } from '../../commands/push.js'
import { Command } from 'commander'
import { execa } from 'execa'
import { GitWorktreeManager } from '../../core/git.js'
import inquirer from 'inquirer'

vi.mock('execa')
vi.mock('../../core/git.js')
vi.mock('inquirer')
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    text: '',
  })),
}))
vi.mock('chalk', () => ({
  default: {
    red: vi.fn(text => text),
    green: vi.fn(text => text),
    yellow: vi.fn(text => text),
    blue: vi.fn(text => text),
    cyan: vi.fn(text => text),
    gray: vi.fn(text => text),
  },
}))

const mockExeca = vi.mocked(execa)
const mockGitWorktreeManager = vi.mocked(GitWorktreeManager)
const mockInquirer = vi.mocked(inquirer)

describe('push command simple tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('command configuration', () => {
    it('should have correct command configuration', () => {
      expect(pushCommand).toBeInstanceOf(Command)
      expect(pushCommand.name()).toBe('push')
      expect(pushCommand.description()).toContain('現在のブランチをリモートにプッシュ')

      // Check options
      const options = pushCommand.options
      const optionNames = options.map(opt => opt.long)

      expect(optionNames).toContain('--pr')
      expect(optionNames).toContain('--draft-pr')
      expect(optionNames).toContain('--base')
      expect(optionNames).toContain('--title')
      expect(optionNames).toContain('--body')
      expect(optionNames).toContain('--no-edit')
      expect(optionNames).toContain('--force')
      expect(optionNames).toContain('--all')
      expect(optionNames).toContain('--issue')
    })
  })

  describe('utility functions', () => {
    it('should test PR title generation', () => {
      const generatePRTitle = (branchName: string, isDraft: boolean): string => {
        return isDraft ? `WIP: ${branchName}` : branchName
      }

      expect(generatePRTitle('feature/login', false)).toBe('feature/login')
      expect(generatePRTitle('feature/login', true)).toBe('WIP: feature/login')
      expect(generatePRTitle('bugfix/validation', true)).toBe('WIP: bugfix/validation')
    })

    it('should test branch name validation', () => {
      const isMainBranch = (branchName: string): boolean => {
        const mainBranches = ['main', 'master', 'develop', 'development']
        return mainBranches.includes(branchName)
      }

      expect(isMainBranch('main')).toBe(true)
      expect(isMainBranch('master')).toBe(true)
      expect(isMainBranch('develop')).toBe(true)
      expect(isMainBranch('feature/test')).toBe(false)
      expect(isMainBranch('bugfix/issue-123')).toBe(false)
    })

    it('should test git command argument generation', () => {
      const generatePushArgs = (
        branchName: string,
        force: boolean,
        hasRemoteBranch: boolean
      ): string[] => {
        const args = ['push']

        if (force) {
          args.push('--force-with-lease')
        }

        if (!hasRemoteBranch) {
          args.push('-u', 'origin', branchName)
        }

        return args
      }

      expect(generatePushArgs('feature/test', false, false)).toEqual([
        'push',
        '-u',
        'origin',
        'feature/test',
      ])
      expect(generatePushArgs('feature/test', true, false)).toEqual([
        'push',
        '--force-with-lease',
        '-u',
        'origin',
        'feature/test',
      ])
      expect(generatePushArgs('feature/test', false, true)).toEqual(['push'])
      expect(generatePushArgs('feature/test', true, true)).toEqual(['push', '--force-with-lease'])
    })

    it('should test PR creation arguments', () => {
      const generatePRArgs = (options: {
        isDraft?: boolean
        base?: string
        title?: string
        body?: string
        noEdit?: boolean
      }): string[] => {
        const args = ['pr', 'create']

        if (options.isDraft) {
          args.push('--draft')
        }

        if (options.base) {
          args.push('--base', options.base)
        }

        if (options.title) {
          args.push('--title', options.title)
        }

        if (options.body) {
          args.push('--body', options.body)
        }

        if (options.noEdit) {
          args.push('--fill')
        }

        return args
      }

      expect(generatePRArgs({ isDraft: true, title: 'WIP: feature' })).toEqual([
        'pr',
        'create',
        '--draft',
        '--title',
        'WIP: feature',
      ])

      expect(
        generatePRArgs({ base: 'develop', title: 'New feature', body: 'Description' })
      ).toEqual([
        'pr',
        'create',
        '--base',
        'develop',
        '--title',
        'New feature',
        '--body',
        'Description',
      ])

      expect(generatePRArgs({ noEdit: true, title: 'Quick fix' })).toEqual([
        'pr',
        'create',
        '--title',
        'Quick fix',
        '--fill',
      ])
    })

    it('should test worktree filtering', () => {
      const filterWorktrees = (
        worktrees: Array<{ path: string; branch: string }>,
        currentPath: string
      ) => {
        return worktrees.filter(wt => wt.path !== currentPath)
      }

      const worktrees = [
        { path: '/current/path', branch: 'main' },
        { path: '/work/feature-1', branch: 'feature/auth' },
        { path: '/work/feature-2', branch: 'feature/ui' },
      ]

      const filtered = filterWorktrees(worktrees, '/current/path')
      expect(filtered).toHaveLength(2)
      expect(filtered[0].branch).toBe('feature/auth')
      expect(filtered[1].branch).toBe('feature/ui')
    })
  })

  describe('push command functionality', () => {
    beforeEach(() => {
      // Setup default mocks
      mockGitWorktreeManager.prototype.isGitRepository = vi.fn().mockResolvedValue(true)
      mockExeca.mockResolvedValue({ stdout: 'feature/test', stderr: '' })
    })

    it('should handle git repository check', async () => {
      mockGitWorktreeManager.prototype.isGitRepository = vi.fn().mockResolvedValue(false)
      
      let errorMessage = ''
      vi.spyOn(console, 'error').mockImplementation((msg) => {
        errorMessage = msg
      })
      vi.spyOn(process, 'exitCode', 'set').mockImplementation(() => {})

      await pushCommand.parseAsync(['node', 'test'])

      expect(errorMessage).toContain('このディレクトリはGitリポジトリではありません')
    })

    it('should handle branch retrieval', async () => {
      mockExeca
        .mockResolvedValueOnce({ stdout: 'feature/test', stderr: '' }) // branch --show-current
        .mockResolvedValueOnce({ stdout: 'origin', stderr: '' }) // remote get-url origin
        .mockRejectedValueOnce(new Error('no remote branch')) // rev-parse origin/feature/test
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // push -u origin feature/test

      await pushCommand.parseAsync(['node', 'test'])

      expect(mockExeca).toHaveBeenCalledWith('git', ['branch', '--show-current'])
      expect(mockExeca).toHaveBeenCalledWith('git', ['remote', 'get-url', 'origin'])
      expect(mockExeca).toHaveBeenCalledWith('git', ['push', '-u', 'origin', 'feature/test'])
    })

    it('should handle main branch warning', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'main', stderr: '' })
      mockInquirer.prompt = vi.fn().mockResolvedValue({ confirmPush: false })
      
      let consoleOutput = ''
      vi.spyOn(console, 'log').mockImplementation((msg) => {
        consoleOutput = msg
      })

      await pushCommand.parseAsync(['node', 'test'])

      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmPush',
          message: "メインブランチ 'main' をプッシュしますか？",
          default: false,
        },
      ])
      expect(consoleOutput).toContain('キャンセルされました')
    })

    it('should handle PR creation', async () => {
      mockExeca
        .mockResolvedValueOnce({ stdout: 'feature/test', stderr: '' }) // branch --show-current
        .mockResolvedValueOnce({ stdout: 'origin', stderr: '' }) // remote get-url origin
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // gh auth status
        .mockRejectedValueOnce(new Error('no remote branch')) // rev-parse origin/feature/test
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // push -u origin feature/test
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // gh pr create

      await pushCommand.parseAsync(['node', 'test', '--pr'])

      expect(mockExeca).toHaveBeenCalledWith('gh', ['auth', 'status'])
      expect(mockExeca).toHaveBeenCalledWith('gh', ['pr', 'create', '--title', 'feature/test'])
    })

    it('should handle draft PR creation', async () => {
      mockExeca
        .mockResolvedValueOnce({ stdout: 'feature/test', stderr: '' }) // branch --show-current
        .mockResolvedValueOnce({ stdout: 'origin', stderr: '' }) // remote get-url origin
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // gh auth status
        .mockRejectedValueOnce(new Error('no remote branch')) // rev-parse origin/feature/test
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // push -u origin feature/test
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // gh pr create --draft

      await pushCommand.parseAsync(['node', 'test', '--draft-pr'])

      expect(mockExeca).toHaveBeenCalledWith('gh', [
        'pr',
        'create',
        '--draft',
        '--title',
        'WIP: feature/test',
        '--body',
        'Work in progress',
      ])
    })

    it('should handle force push', async () => {
      mockExeca
        .mockResolvedValueOnce({ stdout: 'feature/test', stderr: '' }) // branch --show-current
        .mockResolvedValueOnce({ stdout: 'origin', stderr: '' }) // remote get-url origin
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // rev-parse origin/feature/test (exists)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // push --force-with-lease

      await pushCommand.parseAsync(['node', 'test', '--force'])

      expect(mockExeca).toHaveBeenCalledWith('git', ['push', '--force-with-lease'])
    })

    it('should handle all worktrees option', async () => {
      const mockWorktrees = [
        { path: '/current/path', branch: 'main' },
        { path: '/work/feature-1', branch: 'feature/auth' },
        { path: '/work/feature-2', branch: 'feature/ui' },
      ]

      mockGitWorktreeManager.prototype.listWorktrees = vi.fn().mockResolvedValue(mockWorktrees)
      vi.spyOn(process, 'cwd').mockReturnValue('/current/path')
      vi.spyOn(process, 'chdir').mockImplementation(() => {})

      mockExeca
        .mockResolvedValue({ stdout: 'origin', stderr: '' }) // remote get-url origin calls
        .mockRejectedValue(new Error('no remote branch')) // rev-parse calls
        .mockResolvedValue({ stdout: '', stderr: '' }) // push calls

      let consoleOutput = ''
      vi.spyOn(console, 'log').mockImplementation((msg) => {
        consoleOutput += msg + '\n'
      })

      await pushCommand.parseAsync(['node', 'test', '--all'])

      expect(mockGitWorktreeManager.prototype.listWorktrees).toHaveBeenCalled()
      expect(consoleOutput).toContain('2個の演奏者を処理します')
    })

    it('should handle errors gracefully', async () => {
      mockExeca.mockRejectedValue(new Error('Git command failed'))
      
      let errorMessage = ''
      vi.spyOn(console, 'error').mockImplementation((msg) => {
        errorMessage = msg
      })
      vi.spyOn(process, 'exitCode', 'set').mockImplementation(() => {})

      await pushCommand.parseAsync(['node', 'test'])

      expect(errorMessage).toContain('現在のブランチを取得できませんでした')
    })
  })
})

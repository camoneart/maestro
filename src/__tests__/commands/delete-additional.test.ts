import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { deleteCommand } from '../../commands/delete.js'
import { GitWorktreeManager } from '../../core/git.js'
import { execa } from 'execa'
import inquirer from 'inquirer'
import ora from 'ora'
import { spawn } from 'child_process'
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

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

describe.skip('delete command - additional tests', () => {
  let mockGitManager: {
    isGitRepository: Mock
    listWorktrees: Mock
    deleteWorktree: Mock
    getCurrentWorktreePath: Mock
  }
  let mockSpinner: any

  beforeEach(() => {
    vi.clearAllMocks()

    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([]),
      deleteWorktree: vi.fn().mockResolvedValue(undefined),
      getCurrentWorktreePath: vi.fn().mockResolvedValue('/current/path'),
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
    ;(inquirer as any).default.prompt.mockResolvedValue({ confirmDelete: true })

    // execaのモック
    ;(execa as any).mockResolvedValue({
      stdout: '100K\t/path/to/worktree',
      stderr: '',
      exitCode: 0,
    })
  })

  describe('basic delete functionality', () => {
    it('should delete specified worktree', async () => {
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
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1'])

      expect(mockGitManager.deleteWorktree).toHaveBeenCalledWith('refs/heads/feature-1', false)
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('演奏者の削除が完了しました')
      )
    })

    it('should handle --force option', async () => {
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
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1', '--force'])

      expect((inquirer as any).default.prompt).not.toHaveBeenCalled()
      expect(mockGitManager.deleteWorktree).toHaveBeenCalledWith('refs/heads/feature-1', true)
    })

    it('should handle current worktree deletion with --current option', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: '/current/path',
          branch: 'refs/heads/feature-current',
          commit: 'abc123',
          isCurrentDirectory: true,
          locked: false,
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)

      await deleteCommand.parseAsync(['node', 'delete', '--current'])

      expect(mockGitManager.deleteWorktree).toHaveBeenCalledWith(
        'refs/heads/feature-current',
        false
      )
    })
  })

  describe('remote branch deletion', () => {
    it('should delete remote branch with --remove-remote option', async () => {
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
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      
      ;(execa as any).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'git' && args.includes('branch')) {
          return Promise.resolve({ stdout: '  origin/feature-1\n  origin/main\n' })
        }
        if (cmd === 'git' && args.includes('push')) {
          return Promise.resolve({ stdout: '', stderr: '' })
        }
        return Promise.resolve({ stdout: '100K\t/path/to/worktree', stderr: '' })
      })

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1', '--remove-remote'])

      expect(execa).toHaveBeenCalledWith('git', ['push', 'origin', '--delete', 'feature-1'])
    })

    it('should handle non-existent remote branch', async () => {
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
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      
      ;(execa as any).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'git' && args.includes('branch')) {
          return Promise.resolve({ stdout: '  origin/main\n' }) // feature-1はリモートに無い
        }
        return Promise.resolve({ stdout: '100K\t/path/to/worktree', stderr: '' })
      })

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1', '--remove-remote'])

      expect(mockSpinner.warn).toHaveBeenCalledWith(
        expect.stringContaining('リモートブランチ')
      )
    })
  })

  describe('fzf integration', () => {
    it('should handle fzf selection', async () => {
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

      // fzfプロセスのモック
      const mockSpawn = vi.fn().mockImplementation(() => ({
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: { on: vi.fn((event, cb) => {
          if (event === 'data') cb('feature-1\n')
        })},
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => {
          if (event === 'close') cb(0)
        }),
      }))
      ;(spawn as any).mockImplementation(mockSpawn)

      await deleteCommand.parseAsync(['node', 'delete', '--fzf'])

      expect(spawn).toHaveBeenCalledWith('fzf', expect.any(Array), expect.any(Object))
      expect(mockGitManager.deleteWorktree).toHaveBeenCalled()
    }, 10000) // fzfテストはタイムアウトを長めに設定
  })

  describe('error handling', () => {
    it('should handle not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(
        deleteCommand.parseAsync(['node', 'delete', 'test-branch'])
      ).rejects.toThrow()
    })

    it('should handle no worktrees available', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([])

      await expect(
        deleteCommand.parseAsync(['node', 'delete', 'non-existent'])
      ).rejects.toThrow()
    })

    it('should handle worktree not found', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: '/path/to/worktree/other-branch',
          branch: 'refs/heads/other-branch',
          commit: 'abc123',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)

      await expect(
        deleteCommand.parseAsync(['node', 'delete', 'non-existent'])
      ).rejects.toThrow()
    })

    it('should handle delete cancellation', async () => {
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
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      ;(inquirer as any).default.prompt.mockResolvedValue({ confirmDelete: false })

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1'])

      expect(console.log).toHaveBeenCalledWith('削除をキャンセルしました')
      expect(mockGitManager.deleteWorktree).not.toHaveBeenCalled()
    })

    it('should handle directory size retrieval error', async () => {
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
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      ;(execa as any).mockImplementation((cmd: string) => {
        if (cmd === 'du') {
          throw new Error('Permission denied')
        }
        return Promise.resolve({ stdout: '', stderr: '' })
      })

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1'])

      // Should still proceed with deletion even if size retrieval fails
      expect(mockGitManager.deleteWorktree).toHaveBeenCalled()
    })
  })

  describe('locked worktree handling', () => {
    it('should warn about locked worktree', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: '/path/to/worktree/feature-1',
          branch: 'refs/heads/feature-1',
          commit: 'abc123',
          isCurrentDirectory: false,
          locked: true, // ロックされている
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1'])

      // ロック警告が表示されることを確認
      expect(mockSpinner.warn).toHaveBeenCalledWith(
        expect.stringContaining('ロック')
      )
    })
  })

  describe('detached HEAD handling', () => {
    it('should handle detached HEAD worktree', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: '/path/to/worktree/detached',
          branch: 'abc123', // detached HEADの場合はコミットハッシュ
          commit: 'abc123',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: true,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)

      await deleteCommand.parseAsync(['node', 'delete', 'detached'])

      expect(mockGitManager.deleteWorktree).toHaveBeenCalled()
    })
  })
})
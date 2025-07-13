import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { deleteCommand } from '../../commands/delete.js'
import { GitWorktreeManager } from '../../core/git.js'
import inquirer from 'inquirer'
import ora from 'ora'
import { execa } from 'execa'
import chalk from 'chalk'
import type { ParsedWorktreeInfo } from '../../types/index.js'
import { spawn } from 'child_process'

vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn(),
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

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

describe.skip('delete command - additional tests', () => {
  let consoleLogSpy: Mock
  let consoleErrorSpy: Mock
  let processExitSpy: Mock
  let mockGitManager: {
    isGitRepository: Mock
    listWorktrees: Mock
    removeWorktree: Mock
  }
  let mockSpinner: any

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process exited with code ${code}`)
    })

    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn(),
      removeWorktree: vi.fn(),
    }
    ;(GitWorktreeManager as any).mockImplementation(() => mockGitManager)

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

    // execaのデフォルトモック
    ;(execa as Mock).mockResolvedValue({ stdout: '100M\t/path/to/worktree' })
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
      mockGitManager.removeWorktree.mockResolvedValue(undefined)
      ;(inquirer.prompt as Mock).mockResolvedValue({ confirmDelete: true })

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1'])

      expect(mockGitManager.removeWorktree).toHaveBeenCalledWith(
        '/path/to/worktree/feature-1',
        false
      )
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('影分身の削除が完了しました')
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
      mockGitManager.removeWorktree.mockResolvedValue(undefined)

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1', '--force'])

      expect(inquirer.prompt).not.toHaveBeenCalled()
      expect(mockGitManager.removeWorktree).toHaveBeenCalledWith(
        '/path/to/worktree/feature-1',
        true
      )
    })

    it('should delete current worktree with --current option', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: process.cwd(),
          branch: 'refs/heads/current-branch',
          commit: 'abc123',
          isCurrentDirectory: true,
          locked: false,
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      mockGitManager.removeWorktree.mockResolvedValue(undefined)
      ;(inquirer.prompt as Mock).mockResolvedValue({ confirmDelete: true })

      await deleteCommand.parseAsync(['node', 'delete', '--current'])

      expect(mockGitManager.removeWorktree).toHaveBeenCalledWith(process.cwd(), false)
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
      mockGitManager.removeWorktree.mockResolvedValue(undefined)
      ;(inquirer.prompt as Mock).mockResolvedValue({ confirmDelete: true })
      ;(execa as Mock)
        .mockResolvedValueOnce({ stdout: '100M\t/path/to/worktree' }) // du command
        .mockResolvedValueOnce({ stdout: 'origin/feature-1' }) // git branch -r
        .mockResolvedValueOnce({ stdout: '' }) // git push origin --delete

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
      mockGitManager.removeWorktree.mockResolvedValue(undefined)
      ;(inquirer.prompt as Mock).mockResolvedValue({ confirmDelete: true })
      ;(execa as Mock)
        .mockResolvedValueOnce({ stdout: '100M\t/path/to/worktree' }) // du command
        .mockResolvedValueOnce({ stdout: '' }) // git branch -r (empty)

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
          locked: true,
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)

      const mockFzfProcess = {
        stdin: {
          write: vi.fn(),
          end: vi.fn(),
        },
        stdout: {
          on: vi.fn(),
        },
        on: vi.fn(),
      }
      ;(spawn as Mock).mockReturnValue(mockFzfProcess)

      await deleteCommand.parseAsync(['node', 'delete', '--fzf'])

      expect(spawn).toHaveBeenCalledWith(
        'fzf',
        expect.arrayContaining(['--multi', '--ansi']),
        expect.any(Object)
      )

      const fzfInput = mockFzfProcess.stdin.write.mock.calls[0][0]
      expect(fzfInput).toContain('feature-1')
      expect(fzfInput).toContain('[ロック]')
    })
  })

  describe('error handling', () => {
    it('should handle not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(
        deleteCommand.parseAsync(['node', 'delete', 'feature-1'])
      ).rejects.toThrow('Process exited with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        'このディレクトリはGitリポジトリではありません'
      )
    })

    it('should handle no worktrees available', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([])

      await expect(
        deleteCommand.parseAsync(['node', 'delete', 'feature-1'])
      ).rejects.toThrow('Process exited with code 0')

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('影分身が存在しません'))
    })

    it('should handle worktree not found', async () => {
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

      await expect(
        deleteCommand.parseAsync(['node', 'delete', 'non-existent'])
      ).rejects.toThrow('Process exited with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('見つかりません')
      )
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
      ;(inquirer.prompt as Mock).mockResolvedValue({ confirmDelete: false })

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1'])

      expect(mockGitManager.removeWorktree).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('削除をキャンセルしました'))
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
      mockGitManager.removeWorktree.mockResolvedValue(undefined)
      ;(inquirer.prompt as Mock).mockResolvedValue({ confirmDelete: true })
      ;(execa as Mock).mockRejectedValue(new Error('du command failed'))

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1'])

      // Should still proceed with deletion even if size retrieval fails
      expect(mockGitManager.removeWorktree).toHaveBeenCalled()
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
          locked: true,
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      ;(inquirer.prompt as Mock).mockResolvedValue({ confirmDelete: true })
      mockGitManager.removeWorktree.mockResolvedValue(undefined)

      await deleteCommand.parseAsync(['node', 'delete', 'feature-1'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('ロックされています')
      )
    })
  })

  describe('detached HEAD handling', () => {
    it('should handle detached HEAD worktree', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: '/path/to/worktree/detached',
          branch: null,
          commit: 'abc123',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: true,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      mockGitManager.removeWorktree.mockResolvedValue(undefined)
      ;(inquirer.prompt as Mock).mockResolvedValue({ confirmDelete: true })

      await deleteCommand.parseAsync(['node', 'delete', 'detached'])

      expect(mockGitManager.removeWorktree).toHaveBeenCalled()
    })
  })
})
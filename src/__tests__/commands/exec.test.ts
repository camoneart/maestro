import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { execCommand } from '../../commands/exec.js'
import { GitWorktreeManager } from '../../core/git.js'
import { execa } from 'execa'
import chalk from 'chalk'
import type { ParsedWorktreeInfo } from '../../types/index.js'

vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn(),
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

describe('exec command', () => {
  let consoleLogSpy: Mock
  let consoleErrorSpy: Mock
  let processExitSpy: Mock
  let mockGitManager: {
    isGitRepository: Mock
    listWorktrees: Mock
  }

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
    }
    ;(GitWorktreeManager as any).mockImplementation(() => mockGitManager)
  })

  describe('basic functionality', () => {
    it.skip('should execute command in specified worktree', async () => {
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
      ;(execa as Mock).mockResolvedValue({
        stdout: 'Command output',
        stderr: '',
      })

      await execCommand.parseAsync(['node', 'exec', 'feature-1', 'echo', 'hello'])

      expect(execa).toHaveBeenCalledWith(
        'sh',
        ['-c', 'echo hello'],
        expect.objectContaining({
          cwd: '/path/to/worktree/feature-1',
          env: expect.objectContaining({
            SHADOW_CLONE: 'feature-1',
            SHADOW_CLONE_PATH: '/path/to/worktree/feature-1',
          }),
        })
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('Command output')
    })

    it('should execute command in all worktrees with --all option', async () => {
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
      ;(execa as Mock).mockResolvedValue({
        stdout: 'Command output',
        stderr: '',
      })

      await execCommand.parseAsync(['node', 'exec', 'dummy', 'echo', 'hello', '--all'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.bold(`\n🥷 すべての影分身でコマンドを実行: ${chalk.cyan('echo hello')}\n`)
      )
      expect(execa).toHaveBeenCalledTimes(2)
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('▶ feature-1'))
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('▶ feature-2'))
    })

    it('should suppress output with --silent option', async () => {
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
      ;(execa as Mock).mockResolvedValue({
        stdout: 'Command output',
        stderr: 'Warning message',
      })

      await execCommand.parseAsync(['node', 'exec', 'feature-1', 'echo', 'hello', '--silent'])

      expect(consoleLogSpy).not.toHaveBeenCalledWith('Command output')
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(chalk.yellow('Warning message'))
    })

    it('should handle command with multiple parts', async () => {
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
      ;(execa as Mock).mockResolvedValue({
        stdout: 'npm test output',
        stderr: '',
      })

      await execCommand.parseAsync(['node', 'exec', 'feature-1', 'npm', 'run', 'test'])

      expect(execa).toHaveBeenCalledWith(
        'sh',
        ['-c', 'npm run test'],
        expect.any(Object)
      )
    })
  })

  describe('error handling', () => {
    it('should handle not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(
        execCommand.parseAsync(['node', 'exec', 'feature-1', 'echo', 'hello'])
      ).rejects.toThrow('Process exited with code 1')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('エラー: このディレクトリはGitリポジトリではありません')
      )
    })

    it.skip('should handle no worktrees', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([])

      await expect(
        execCommand.parseAsync(['node', 'exec', 'feature-1', 'echo', 'hello'])
      ).rejects.toThrow('Process exited with code 0')

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('影分身が存在しません'))
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.gray('scj create <branch-name> で影分身を作り出してください')
      )
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
        execCommand.parseAsync(['node', 'exec', 'non-existent', 'echo', 'hello'])
      ).rejects.toThrow('Process exited with code 1')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red(`エラー: 影分身 'non-existent' が見つかりません`)
      )
    })

    it.skip('should handle command execution error', async () => {
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
      const execError = Object.assign(new Error('Command failed'), {
        exitCode: 1,
        stderr: 'Error message',
      })
      ;(execa as Mock).mockRejectedValue(execError)

      await expect(
        execCommand.parseAsync(['node', 'exec', 'feature-1', 'invalid-command'])
      ).rejects.toThrow('Process exited with code 1')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('コマンドの実行に失敗しました (exit code: 1)')
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Error message'))
    })

    it('should continue execution in --all mode even if one fails', async () => {
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
      
      const execError = Object.assign(new Error('Command failed'), {
        exitCode: 1,
        stderr: 'Error in feature-1',
      })
      ;(execa as Mock)
        .mockRejectedValueOnce(execError)
        .mockResolvedValueOnce({
          stdout: 'Success in feature-2',
          stderr: '',
        })

      await execCommand.parseAsync(['node', 'exec', 'dummy', 'test-command', '--all'])

      expect(execa).toHaveBeenCalledTimes(2)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('  エラー (exit code: 1)')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('Success in feature-2')
    })
  })

  describe('worktree filtering', () => {
    it('should filter out dotfiles from worktrees', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: '/path/to/repo/.',
          branch: 'refs/heads/main',
          commit: 'abc123',
          isCurrentDirectory: true,
          locked: false,
          prunable: false,
          detached: false,
        },
        {
          path: '/path/to/worktree/feature-1',
          branch: 'refs/heads/feature-1',
          commit: 'def456',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      ;(execa as Mock).mockResolvedValue({
        stdout: 'Output',
        stderr: '',
      })

      await execCommand.parseAsync(['node', 'exec', 'dummy', 'echo', 'hello', '--all'])

      expect(execa).toHaveBeenCalledTimes(1)
      expect(execa).toHaveBeenCalledWith(
        'sh',
        ['-c', 'echo hello'],
        expect.objectContaining({
          cwd: '/path/to/worktree/feature-1',
        })
      )
    })
  })

  describe('branch name matching', () => {
    it.skip('should match partial branch names', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: '/path/to/worktree/feature-auth',
          branch: 'refs/heads/feature/auth',
          commit: 'abc123',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      ;(execa as Mock).mockResolvedValue({
        stdout: 'Command output',
        stderr: '',
      })

      await execCommand.parseAsync(['node', 'exec', 'auth', 'echo', 'hello'])

      expect(execa).toHaveBeenCalledWith(
        'sh',
        ['-c', 'echo hello'],
        expect.objectContaining({
          cwd: '/path/to/worktree/feature-auth',
        })
      )
    })
  })

  describe('stderr handling', () => {
    it.skip('should display stderr in yellow when not silent', async () => {
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
      ;(execa as Mock).mockResolvedValue({
        stdout: 'Output',
        stderr: 'Warning message',
      })

      await execCommand.parseAsync(['node', 'exec', 'feature-1', 'echo', 'hello'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.yellow('Warning message'))
    })
  })
})
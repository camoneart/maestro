import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { spawn } from 'child_process'
import { whereCommand } from '../../commands/where.js'
import { GitWorktreeManager } from '../../core/git.js'
import type { ParsedWorktreeInfo } from '../../types/index.js'
import chalk from 'chalk'

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn(),
}))

describe('where command', () => {
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
    it('should display path for existing worktree', async () => {
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

      await whereCommand.parseAsync(['node', 'where', 'feature-1'])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/feature-1$/))
    })

    it('should display current worktree path with --current option', async () => {
      const cwd = process.cwd()
      await whereCommand.parseAsync(['node', 'where', '--current'])

      expect(consoleLogSpy).toHaveBeenCalledWith('.')
      expect(mockGitManager.listWorktrees).not.toHaveBeenCalled()
    })

    it('should handle worktree not found', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([])

      await expect(whereCommand.parseAsync(['node', 'where', 'non-existent'])).rejects.toThrow(
        'Process exited with code 1'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red(`エラー: 演奏者 'non-existent' が見つかりません`)
      )
    })

    it('should suggest similar worktrees when not found', async () => {
      const mockWorktrees: ParsedWorktreeInfo[] = [
        {
          path: '/path/to/worktree/feature-auth',
          branch: 'refs/heads/feature-auth',
          commit: 'abc123',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: false,
        },
        {
          path: '/path/to/worktree/feature-authentication',
          branch: 'refs/heads/feature-authentication',
          commit: 'def456',
          isCurrentDirectory: false,
          locked: false,
          prunable: false,
          detached: false,
        },
      ]
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)

      await expect(whereCommand.parseAsync(['node', 'where', 'auth'])).rejects.toThrow(
        'Process exited with code 1'
      )

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('\n類似した演奏者:'))
      expect(consoleLogSpy).toHaveBeenCalledWith('  - feature-auth')
      expect(consoleLogSpy).toHaveBeenCalledWith('  - feature-authentication')
    })
  })

  describe('error handling', () => {
    it('should handle not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(whereCommand.parseAsync(['node', 'where', 'feature-1'])).rejects.toThrow(
        'Process exited with code 1'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('エラー: このディレクトリはGitリポジトリではありません')
      )
    })

    it('should show usage when no branch name provided', async () => {
      await expect(whereCommand.parseAsync(['node', 'where'])).rejects.toThrow(
        'Process exited with code 1'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red(
          'エラー: ブランチ名を指定するか、--fzf または --current オプションを使用してください'
        )
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('使い方:'))
    })

    it('should handle errors gracefully', async () => {
      mockGitManager.listWorktrees.mockRejectedValue(new Error('Git error'))

      await expect(whereCommand.parseAsync(['node', 'where', 'feature-1'])).rejects.toThrow(
        'Process exited with code 1'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('エラー:'), 'Git error')
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
          isCurrentDirectory: true,
          locked: false,
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

      await whereCommand.parseAsync(['node', 'where', '--fzf'])

      expect(spawn).toHaveBeenCalledWith(
        'fzf',
        expect.arrayContaining(['--ansi', '--header=演奏者を選択 (Ctrl-C でキャンセル)']),
        expect.any(Object)
      )

      // fzfに渡されるデータを確認
      expect(mockFzfProcess.stdin.write).toHaveBeenCalled()
      const fzfInput = mockFzfProcess.stdin.write.mock.calls[0][0]
      expect(fzfInput).toContain('feature-1')
      expect(fzfInput).toContain('feature-2')
      expect(fzfInput).toContain('[現在]')
    })

    it('should handle fzf cancellation', async () => {
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

      const mockFzfProcess = {
        stdin: {
          write: vi.fn(),
          end: vi.fn(),
        },
        stdout: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1) // 終了コード1（キャンセル）
          }
        }),
      }
      ;(spawn as Mock).mockReturnValue(mockFzfProcess)

      await whereCommand.parseAsync(['node', 'where', '--fzf'])

      // closeイベントのコールバックを実行
      const closeCallback = mockFzfProcess.on.mock.calls.find(call => call[0] === 'close')?.[1]
      closeCallback?.(1)

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('キャンセルされました'))
    })

    it('should handle empty worktrees with fzf option', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([])

      await expect(whereCommand.parseAsync(['node', 'where', '--fzf'])).rejects.toThrow(
        'Process exited with code 1'
      )

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('演奏者が存在しません'))
    })

    it('should display selected path from fzf', async () => {
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

      let stdoutCallback: ((data: any) => void) | undefined
      const mockFzfProcess = {
        stdin: {
          write: vi.fn(),
          end: vi.fn(),
        },
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              stdoutCallback = callback
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            // まずデータを送信
            if (stdoutCallback) {
              stdoutCallback(Buffer.from('feature-1 | /path/to/worktree/feature-1\n'))
            }
            // その後closeイベント
            callback(0)
          }
        }),
      }
      ;(spawn as Mock).mockReturnValue(mockFzfProcess)

      await whereCommand.parseAsync(['node', 'where', '--fzf'])

      // closeイベントのコールバックを実行
      const closeCallback = mockFzfProcess.on.mock.calls.find(call => call[0] === 'close')?.[1]
      closeCallback?.(0)

      expect(consoleLogSpy).toHaveBeenCalledWith('/path/to/worktree/feature-1')
    })
  })

  describe('branch name handling', () => {
    it('should handle refs/heads/ prefix', async () => {
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

      await whereCommand.parseAsync(['node', 'where', 'refs/heads/feature-1'])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/feature-1$/))
    })

    it('should match partial branch names', async () => {
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

      await whereCommand.parseAsync(['node', 'where', 'auth'])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/feature-auth$/))
    })
  })

  describe('worktree status display', () => {
    it('should display locked and prunable status in fzf', async () => {
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
        {
          path: '/path/to/worktree/feature-2',
          branch: 'refs/heads/feature-2',
          commit: 'def456',
          isCurrentDirectory: false,
          locked: false,
          prunable: true,
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

      await whereCommand.parseAsync(['node', 'where', '--fzf'])

      const fzfInput = mockFzfProcess.stdin.write.mock.calls[0][0]
      expect(fzfInput).toContain('[ロック]')
      expect(fzfInput).toContain('[削除可能]')
    })
  })
})

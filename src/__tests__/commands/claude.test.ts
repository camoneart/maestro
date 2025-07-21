import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { claudeCommand } from '../../commands/claude.js'
import { GitWorktreeManager } from '../../core/git.js'
import { execa } from 'execa'
import fs from 'fs/promises'
import chalk from 'chalk'

vi.mock('../../core/git.js')
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }),
}))

describe('claude command', () => {
  let mockGitManager: any
  let consoleLogSpy: any
  let consoleErrorSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([
        { path: '.git/orchestrations/feature-1', branch: 'refs/heads/feature-1' },
        { path: '.git/orchestrations/feature-2', branch: 'refs/heads/feature-2' },
      ]),
    }

    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)
    vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('list subcommand', () => {
    it('should list running Claude Code instances', async () => {
      vi.mocked(execa).mockImplementation((cmd, args) => {
        if (cmd === 'pgrep' && args?.[0] === '-f') {
          // feature-1 is running
          if (args[1]?.includes('feature-1')) {
            return Promise.resolve({ exitCode: 0 } as any)
          }
          // feature-2 is not running
          return Promise.reject(new Error('Not found'))
        }
        return Promise.resolve({ exitCode: 0 } as any)
      })

      await claudeCommand.parseAsync(['node', 'test', 'list'])

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.bold('\n🤖 Claude Code インスタンス:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('feature-1'))
    })

    it('should handle no running instances', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('Not found'))

      await claudeCommand.parseAsync(['node', 'test', 'list'])

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('実行中のインスタンスはありません'))
    })
  })

  describe('start subcommand', () => {
    it('should start Claude Code for a specific branch', async () => {
      vi.mocked(execa).mockImplementation((cmd, args) => {
        if (cmd === 'pgrep') {
          return Promise.reject(new Error('Not running'))
        }
        if (cmd === 'claude') {
          const mockProcess = {
            pid: 12345,
            unref: vi.fn(),
          }
          return mockProcess as any
        }
        return Promise.resolve({ exitCode: 0 } as any)
      })

      await claudeCommand.parseAsync(['node', 'test', 'start', 'feature-1'])

      expect(execa).toHaveBeenCalledWith(
        'claude',
        [expect.stringContaining('feature-1')],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        })
      )
    })

    it('should start Claude Code for all branches with --all', async () => {
      vi.mocked(execa).mockImplementation(cmd => {
        if (cmd === 'pgrep') {
          return Promise.reject(new Error('Not running'))
        }
        if (cmd === 'claude') {
          const mockProcess = {
            pid: 12345,
            unref: vi.fn(),
          }
          return mockProcess as any
        }
        return Promise.resolve({ exitCode: 0 } as any)
      })

      await claudeCommand.parseAsync(['node', 'test', 'start', '--all'])

      expect(execa).toHaveBeenCalledWith('claude', expect.any(Array), expect.any(Object))
      expect(execa).toHaveBeenCalledTimes(4) // 2 pgrep + 2 claude
    })

    it('should not start if already running', async () => {
      vi.mocked(execa).mockImplementation(cmd => {
        if (cmd === 'pgrep') {
          return Promise.resolve({ exitCode: 0 } as any) // Already running
        }
        return Promise.resolve({ exitCode: 0 } as any)
      })

      await claudeCommand.parseAsync(['node', 'test', 'start', 'feature-1'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.yellow('Claude Code は既に feature-1 で起動しています')
      )
    })
  })

  describe('stop subcommand', () => {
    it('should stop Claude Code for a specific branch', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          'feature-1': { worktree: 'feature-1', pid: 12345, status: 'running' },
        })
      )
      vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as any)

      await claudeCommand.parseAsync(['node', 'test', 'stop', 'feature-1'])

      expect(execa).toHaveBeenCalledWith('kill', ['12345'])
      expect(fs.writeFile).toHaveBeenCalled()
    })

    it('should stop all Claude Code instances with --all', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          'feature-1': { worktree: 'feature-1', pid: 12345, status: 'running' },
          'feature-2': { worktree: 'feature-2', pid: 12346, status: 'running' },
        })
      )
      vi.mocked(execa).mockResolvedValue({ exitCode: 0 } as any)

      await claudeCommand.parseAsync(['node', 'test', 'stop', '--all'])

      expect(execa).toHaveBeenCalledWith('kill', ['12345'])
      expect(execa).toHaveBeenCalledWith('kill', ['12346'])
    })

    it('should handle stop when not running', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}))

      await claudeCommand.parseAsync(['node', 'test', 'stop', 'feature-1'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.yellow('Claude Code は feature-1 で起動していません')
      )
    })
  })

  describe('error handling', () => {
    it('should handle non-git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(claudeCommand.parseAsync(['node', 'test', 'list'])).rejects.toThrow(
        'process.exit'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('エラー: このディレクトリはGitリポジトリではありません')
      )
    })

    it('should handle missing branch name for start', async () => {
      await expect(claudeCommand.parseAsync(['node', 'test', 'start'])).rejects.toThrow(
        'process.exit'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('エラー: ブランチ名を指定するか --all オプションを使用してください')
      )
    })

    it('should handle missing branch name for stop', async () => {
      await expect(claudeCommand.parseAsync(['node', 'test', 'stop'])).rejects.toThrow(
        'process.exit'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('エラー: ブランチ名を指定するか --all オプションを使用してください')
      )
    })

    it('should handle worktree not found', async () => {
      await expect(
        claudeCommand.parseAsync(['node', 'test', 'start', 'non-existent'])
      ).rejects.toThrow('process.exit')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red("エラー: 演奏者 'non-existent' が見つかりません")
      )
    })
  })
})

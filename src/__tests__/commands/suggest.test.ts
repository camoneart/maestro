import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { suggestCommand } from '../../commands/suggest.js'
import { GitWorktreeManager } from '../../core/git.js'
import chalk from 'chalk'
import inquirer from 'inquirer'
import type { ParsedWorktreeInfo } from '../../types/index.js'

// モック設定
vi.mock('../../core/git.js')
vi.mock('inquirer')
vi.mock('execa', () => ({ execa: vi.fn() }))
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => ({ stop: vi.fn() })),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}))

describe.skip('suggest command', () => {
  let consoleLogSpy: any
  let consoleErrorSpy: any
  let mockGitManager: {
    isGitRepository: Mock
    getCommitLogs: Mock
    listBranches: Mock
    listWorktrees: Mock
  }

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      getCommitLogs: vi.fn().mockResolvedValue([]),
      listBranches: vi.fn().mockResolvedValue([]),
      listWorktrees: vi.fn().mockResolvedValue([]),
    }
    ;(GitWorktreeManager as any).mockImplementation(() => mockGitManager)

    // inquirerモック
    const mockPrompt = vi.fn().mockResolvedValue({
      suggestionType: '🌿 ブランチ名',
    })
    ;(inquirer as any).prompt = mockPrompt
  })

  describe('basic functionality', () => {
    it('should handle basic command execution', async () => {
      // execa mock for Claude check
      const { execa } = await import('execa')
      ;(execa as any).mockRejectedValue(new Error('which: claude: not found'))

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Claude Codeがインストールされていません')
      )
    })

    it('should handle --branch option', async () => {
      const { execa } = await import('execa')
      ;(execa as any).mockRejectedValue(new Error('which: claude: not found'))

      await suggestCommand.parseAsync(['node', 'suggest', '--branch'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Claude Codeがインストールされていません')
      )
    })

    it('should handle --description option', async () => {
      const { execa } = await import('execa')
      ;(execa as any).mockRejectedValue(new Error('which: claude: not found'))

      await suggestCommand.parseAsync(['node', 'suggest', '--description', 'test feature'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Claude Codeがインストールされていません')
      )
    })

    it('should validate git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(true)
      const { execa } = await import('execa')
      ;(execa as any).mockRejectedValue(new Error('which: claude: not found'))

      await suggestCommand.parseAsync(['node', 'suggest'])

      expect(mockGitManager.isGitRepository).toHaveBeenCalled()
    })

    it('should handle commit option', async () => {
      const { execa } = await import('execa')
      ;(execa as any).mockRejectedValue(new Error('which: claude: not found'))

      await suggestCommand.parseAsync(['node', 'suggest', '--commit'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Claude Codeがインストールされていません')
      )
    })
  })

  describe('error handling', () => {
    it('should handle not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
        throw new Error(`Process exited with code ${code}`)
      })

      await expect(suggestCommand.parseAsync(['node', 'suggest'])).rejects.toThrow(
        'Process exited with code 1'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('エラー: このディレクトリはGitリポジトリではありません')
      )
    })
  })
})

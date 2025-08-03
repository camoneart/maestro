import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git.js'
import { ConfigManager } from '../../core/config.js'
import fs from 'fs/promises'
import inquirer from 'inquirer'

// モック設定
vi.mock('fs/promises')
vi.mock('inquirer')
vi.mock('../../core/config.js')

// simple-gitのモックを設定
const mockGitInstance = {
  raw: vi.fn(),
  status: vi.fn().mockResolvedValue({ current: 'main' }),
  branch: vi.fn().mockResolvedValue({ all: [] }),
  branchLocal: vi.fn().mockResolvedValue({ all: [] }),
}

vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGitInstance),
}))

// ConsoleのモックでconsoleをanyとしてキャストしてTypeScriptエラーを回避
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}
;(global as any).console = mockConsole

describe('GitWorktreeManager - Directory Check Feature', () => {
  let gitManager: GitWorktreeManager
  let mockConfigManager: any

  beforeEach(() => {
    vi.clearAllMocks()

    // ConfigManagerのモック設定
    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockReturnValue({ directoryPrefix: '' }),
      getAll: vi.fn().mockReturnValue({}),
    }
    vi.mocked(ConfigManager).mockImplementation(() => mockConfigManager)

    gitManager = new GitWorktreeManager()
  })

  describe('createWorktree with existing directory', () => {
    const branchName = 'feature-test'

    beforeEach(() => {
      // リポジトリルートのモック
      mockGitInstance.raw.mockImplementation((args: string[]) => {
        if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
          return Promise.resolve('/test/repo')
        }
        if (args[0] === 'worktree' && args[1] === 'add') {
          return Promise.resolve('')
        }
        return Promise.resolve('')
      })
    })

    it('should prompt user when directory exists and delete it if chosen', async () => {
      // ディレクトリが存在する場合のモック
      vi.mocked(fs.stat).mockResolvedValueOnce({
        isDirectory: () => true,
      } as any)

      // ユーザーが「削除して作成」を選択
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        action: 'delete',
      })

      // fs.rmのモック
      vi.mocked(fs.rm).mockResolvedValueOnce(undefined)

      const result = await gitManager.createWorktree(branchName)

      // ディレクトリの削除が呼ばれたことを確認
      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining('feature-test'), {
        recursive: true,
        force: true,
      })

      // ワークツリーが作成されたことを確認
      expect(mockGitInstance.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        expect.stringContaining('feature-test'),
        'main',
      ])

      expect(result).toContain('feature-test')
    })

    it('should use alternative name when user chooses rename', async () => {
      // ディレクトリが存在する場合のモック
      vi.mocked(fs.stat).mockResolvedValueOnce({
        isDirectory: () => true,
      } as any)

      // ユーザーが「別名使用」を選択
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        action: 'rename',
      })

      // 2回目のディレクトリチェックでは存在しない
      vi.mocked(fs.stat).mockRejectedValueOnce(new Error('Not found'))

      const result = await gitManager.createWorktree(branchName)

      // 別名でワークツリーが作成されたことを確認
      expect(mockGitInstance.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'feature-test-1',
        expect.stringContaining('feature-test-1'),
        'main',
      ])

      expect(result).toContain('feature-test-1')
    })

    it('should throw error when user cancels', async () => {
      // ディレクトリが存在する場合のモック
      vi.mocked(fs.stat).mockResolvedValueOnce({
        isDirectory: () => true,
      } as any)

      // ユーザーが「キャンセル」を選択
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        action: 'cancel',
      })

      await expect(gitManager.createWorktree(branchName)).rejects.toThrow(
        'ワークツリーの作成がキャンセルされました'
      )

      // ワークツリーが作成されていないことを確認
      expect(mockGitInstance.raw).not.toHaveBeenCalledWith(
        expect.arrayContaining(['worktree', 'add'])
      )
    })

    it('should skip directory check when skipDirCheck is true', async () => {
      // ディレクトリの存在チェックはスキップされる
      const result = await gitManager.createWorktree(branchName, undefined, true)

      // fs.statが呼ばれていないことを確認
      expect(fs.stat).not.toHaveBeenCalled()

      // inquirerが呼ばれていないことを確認
      expect(inquirer.prompt).not.toHaveBeenCalled()

      // ワークツリーが直接作成されたことを確認
      expect(mockGitInstance.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        expect.stringContaining('feature-test'),
        'main',
      ])

      expect(result).toContain('feature-test')
    })

    it('should handle directory check errors gracefully', async () => {
      // fs.statがエラーを返す（ディレクトリが存在しない）
      vi.mocked(fs.stat).mockRejectedValueOnce(new Error('ENOENT'))

      const result = await gitManager.createWorktree(branchName)

      // inquirerが呼ばれていないことを確認
      expect(inquirer.prompt).not.toHaveBeenCalled()

      // ワークツリーが正常に作成されたことを確認
      expect(mockGitInstance.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        expect.stringContaining('feature-test'),
        'main',
      ])

      expect(result).toContain('feature-test')
    })
  })

  describe('attachWorktree with existing directory', () => {
    const existingBranch = 'feature/existing'
    const safeBranchName = 'feature-existing'

    beforeEach(() => {
      // リポジトリルートのモック
      mockGitInstance.raw.mockImplementation((args: string[]) => {
        if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
          return Promise.resolve('/test/repo')
        }
        if (args[0] === 'worktree' && args[1] === 'add') {
          return Promise.resolve('')
        }
        return Promise.resolve('')
      })
    })

    it('should handle existing directory for attach operation', async () => {
      // ディレクトリが存在する場合のモック
      vi.mocked(fs.stat).mockResolvedValueOnce({
        isDirectory: () => true,
      } as any)

      // ユーザーが「削除して作成」を選択
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        action: 'delete',
      })

      // fs.rmのモック
      vi.mocked(fs.rm).mockResolvedValueOnce(undefined)

      const result = await gitManager.attachWorktree(existingBranch)

      // ディレクトリの削除が呼ばれたことを確認
      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining(safeBranchName), {
        recursive: true,
        force: true,
      })

      // ワークツリーが作成されたことを確認
      expect(mockGitInstance.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        expect.stringContaining(safeBranchName),
        existingBranch,
      ])

      expect(result).toContain(safeBranchName)
    })

    it('should use alternative directory name for attach when rename is chosen', async () => {
      // ディレクトリが存在する場合のモック
      vi.mocked(fs.stat).mockResolvedValueOnce({
        isDirectory: () => true,
      } as any)

      // ユーザーが「別名使用」を選択
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        action: 'rename',
      })

      const result = await gitManager.attachWorktree(existingBranch)

      // 別名のディレクトリでワークツリーが作成されたことを確認
      expect(mockGitInstance.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        expect.stringContaining('feature-existing-1'),
        existingBranch,
      ])

      expect(result).toContain('feature-existing-1')
    })
  })

  describe('helper methods', () => {
    it('should generate alternative branch names correctly', () => {
      const allBranches = ['feature-1', 'feature-2', 'test-branch']

      // generateAlternativeBranchNameは公開メソッドではないので、
      // createWorktreeの動作を通じて間接的にテスト
      // ここでは、内部動作が期待通りであることを確認
      const originalName = 'feature'

      // GitWorktreeManagerのプライベートメソッドをテストするために
      // 新しいインスタンスを作成してモックを設定
      const result = (gitManager as any).generateAlternativeBranchName(originalName, allBranches)

      expect(result).toBe('feature-3')
    })
  })
})

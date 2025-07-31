import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { ConfigManager } from '../../core/config'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'

// モック設定
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('../../core/config')
vi.mock('simple-git', () => ({
  default: vi.fn(() => ({
    checkIsRepo: vi.fn().mockResolvedValue(true),
    branch: vi.fn().mockResolvedValue({ branches: {} }),
    branchLocal: vi.fn().mockResolvedValue({ all: [] }),
    raw: vi.fn().mockResolvedValue(''),
    status: vi.fn().mockResolvedValue({ current: 'main' }),
    fetch: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue({ latest: null }),
  })),
}))

describe('GitWorktreeManager', () => {
  let gitManager: GitWorktreeManager
  let mockConfigManager: ConfigManager

  beforeEach(() => {
    // ConfigManagerのモックを設定
    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockReturnValue({ directoryPrefix: '' }),
    } as any

    vi.mocked(ConfigManager).mockImplementation(() => mockConfigManager)

    // GitWorktreeManagerが使用するメソッドをモック
    vi.mocked(execa).mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
      failed: false,
      timedOut: false,
      isCanceled: false,
      killed: false,
    } as any)

    gitManager = new GitWorktreeManager()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isGitRepository', () => {
    it('should return true for a git repository', async () => {
      ;(gitManager as any).git.checkIsRepo = vi.fn().mockResolvedValue(true)
      const result = await gitManager.isGitRepository()
      expect(result).toBe(true)
    })
  })

  describe('listWorktrees', () => {
    it('should parse worktree list correctly', async () => {
      const mockOutput = `worktree /path/to/main
HEAD abcdef1234567890
branch refs/heads/main

worktree /path/to/feature
HEAD fedcba0987654321
branch refs/heads/feature-branch
locked reason`

      // git.raw()をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue(mockOutput)

      const worktrees = await gitManager.listWorktrees()

      expect(worktrees).toHaveLength(2)
      expect(worktrees[0]).toMatchObject({
        path: '/path/to/main',
        head: 'abcdef1234567890',
        branch: 'refs/heads/main',
        locked: false,
        prunable: false,
      })
      expect(worktrees[1]).toMatchObject({
        path: '/path/to/feature',
        head: 'fedcba0987654321',
        branch: 'refs/heads/feature-branch',
        locked: true,
        reason: 'reason',
        prunable: false,
      })
    })

    it('should handle empty worktree list', async () => {
      // git.raw()をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')

      const worktrees = await gitManager.listWorktrees()
      expect(worktrees).toEqual([])
    })
  })

  describe('createWorktree', () => {
    it('should create a new worktree with default empty prefix', async () => {
      const branchName = 'feature-test'
      const mockRepoRoot = '/test/repo'
      const expectedPath = path.resolve(mockRepoRoot, '..', branchName)

      // checkBranchNameCollisionをモック（衝突なし）
      vi.spyOn(gitManager, 'checkBranchNameCollision').mockResolvedValueOnce()
      // git.raw()をモック
      ;(gitManager as any).git.raw = vi
        .fn()
        .mockResolvedValueOnce(mockRepoRoot + '\n') // getRepositoryRoot()
        .mockResolvedValueOnce('') // worktree add
      ;(gitManager as any).git.status = vi.fn().mockResolvedValue({ current: 'main' })

      const result = await gitManager.createWorktree(branchName)

      expect(result).toBe(expectedPath)
      expect(mockConfigManager.loadProjectConfig).toHaveBeenCalled()
      expect(mockConfigManager.get).toHaveBeenCalledWith('worktrees')
      expect(gitManager.checkBranchNameCollision).toHaveBeenCalledWith(branchName)
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        path.join(mockRepoRoot, '..', 'feature-test'),
        'main',
      ])
    })

    it('should create a new worktree with custom prefix', async () => {
      const branchName = 'feature-test'
      const mockRepoRoot = '/test/repo'
      const customPrefix = 'maestro-'
      const expectedPath = path.resolve(mockRepoRoot, '..', `${customPrefix}${branchName}`)

      // カスタムプレフィックスを返すConfigManagerをモック
      mockConfigManager.get = vi.fn().mockReturnValue({ directoryPrefix: customPrefix })

      // checkBranchNameCollisionをモック（衝突なし）
      vi.spyOn(gitManager, 'checkBranchNameCollision').mockResolvedValueOnce()
      // git.raw()をモック
      ;(gitManager as any).git.raw = vi
        .fn()
        .mockResolvedValueOnce(mockRepoRoot + '\n') // getRepositoryRoot()
        .mockResolvedValueOnce('') // worktree add
      ;(gitManager as any).git.status = vi.fn().mockResolvedValue({ current: 'main' })

      const result = await gitManager.createWorktree(branchName)

      expect(result).toBe(expectedPath)
      expect(mockConfigManager.loadProjectConfig).toHaveBeenCalled()
      expect(mockConfigManager.get).toHaveBeenCalledWith('worktrees')
      expect(gitManager.checkBranchNameCollision).toHaveBeenCalledWith(branchName)
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        path.join(mockRepoRoot, '..', 'maestro-feature-test'),
        'main',
      ])
    })

    it('should use base branch if provided', async () => {
      const branchName = 'feature-test'
      const baseBranch = 'develop'
      const mockRepoRoot = '/test/repo'
      const expectedPath = path.resolve(mockRepoRoot, '..', branchName)

      // checkBranchNameCollisionをモック（衝突なし）
      vi.spyOn(gitManager, 'checkBranchNameCollision').mockResolvedValueOnce()
      // git.raw()をモック
      ;(gitManager as any).git.raw = vi
        .fn()
        .mockResolvedValueOnce(mockRepoRoot + '\n') // getRepositoryRoot()
        .mockResolvedValueOnce('') // worktree add

      const result = await gitManager.createWorktree(branchName, baseBranch)

      expect(result).toBe(expectedPath)
      expect(mockConfigManager.loadProjectConfig).toHaveBeenCalled()
      expect(mockConfigManager.get).toHaveBeenCalledWith('worktrees')
      expect(gitManager.checkBranchNameCollision).toHaveBeenCalledWith(branchName)
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        path.join(mockRepoRoot, '..', 'feature-test'),
        baseBranch,
      ])
    })

    it('should throw error if branch collision detected', async () => {
      const branchName = 'existing-branch'

      // checkBranchNameCollisionをモック（衝突あり）
      vi.spyOn(gitManager, 'checkBranchNameCollision').mockRejectedValueOnce(
        new Error("ブランチ 'existing-branch' は既に存在します")
      )

      await expect(gitManager.createWorktree(branchName)).rejects.toThrow(
        "ブランチ 'existing-branch' は既に存在します"
      )
    })

    it('should throw error if worktree creation fails after collision check', async () => {
      const branchName = 'valid-branch'
      const mockRepoRoot = '/test/repo'

      // checkBranchNameCollisionをモック（衝突なし）
      vi.spyOn(gitManager, 'checkBranchNameCollision').mockResolvedValueOnce()
      // git.raw()をモックしてエラーを発生させる
      ;(gitManager as any).git.raw = vi
        .fn()
        .mockResolvedValueOnce(mockRepoRoot + '\n') // getRepositoryRoot()
        .mockRejectedValueOnce(new Error('worktree creation failed')) // worktree add fails
      ;(gitManager as any).git.status = vi.fn().mockResolvedValue({ current: 'main' })

      await expect(gitManager.createWorktree(branchName)).rejects.toThrow(
        'worktree creation failed'
      )
    })
  })

  describe('attachWorktree', () => {
    it('should attach to an existing branch with default empty prefix', async () => {
      const branchName = 'existing-feature'
      const mockRepoRoot = '/test/repo'

      // getRepositoryRoot()をモック
      ;(gitManager as any).git.raw = vi
        .fn()
        .mockResolvedValueOnce(mockRepoRoot + '\n') // getRepositoryRoot()
        .mockResolvedValueOnce('') // worktree add

      const expectedPath = path.resolve(mockRepoRoot, '..', 'existing-feature')

      const result = await gitManager.attachWorktree(branchName)

      expect(result).toBe(expectedPath)
      expect(mockConfigManager.loadProjectConfig).toHaveBeenCalled()
      expect(mockConfigManager.get).toHaveBeenCalledWith('worktrees')
      expect((gitManager as any).git.raw).toHaveBeenNthCalledWith(2, [
        'worktree',
        'add',
        path.join(mockRepoRoot, '..', 'existing-feature'),
        branchName,
      ])
    })

    it('should attach to an existing branch with custom prefix', async () => {
      const branchName = 'existing-feature'
      const mockRepoRoot = '/test/repo'
      const customPrefix = 'maestro-'

      // カスタムプレフィックスを返すConfigManagerをモック
      mockConfigManager.get = vi.fn().mockReturnValue({ directoryPrefix: customPrefix })

      // getRepositoryRoot()をモック
      ;(gitManager as any).git.raw = vi
        .fn()
        .mockResolvedValueOnce(mockRepoRoot + '\n') // getRepositoryRoot()
        .mockResolvedValueOnce('') // worktree add

      const expectedPath = path.resolve(mockRepoRoot, '..', 'maestro-existing-feature')

      const result = await gitManager.attachWorktree(branchName)

      expect(result).toBe(expectedPath)
      expect(mockConfigManager.loadProjectConfig).toHaveBeenCalled()
      expect(mockConfigManager.get).toHaveBeenCalledWith('worktrees')
      expect((gitManager as any).git.raw).toHaveBeenNthCalledWith(2, [
        'worktree',
        'add',
        path.join(mockRepoRoot, '..', 'maestro-existing-feature'),
        branchName,
      ])
    })
  })

  describe('deleteWorktree', () => {
    it('should delete a worktree', async () => {
      const branchName = 'feature-to-delete'

      // listWorktreesをモック
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([
        {
          path: '/path/to/feature',
          head: 'abcdef1234567890',
          branch: 'refs/heads/feature-to-delete',
          isCurrentDirectory: false,
          detached: false,
          locked: false,
          prunable: false,
        },
      ])

      // git.rawをモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')

      await gitManager.deleteWorktree(branchName)

      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/path/to/feature',
      ])
    })

    it('should force delete when force option is true', async () => {
      const branchName = 'feature-to-force-delete'

      // listWorktreesをモック
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([
        {
          path: '/path/to/feature',
          head: 'abcdef1234567890',
          branch: 'refs/heads/feature-to-force-delete',
          isCurrentDirectory: false,
          detached: false,
          locked: false,
          prunable: false,
        },
      ])

      // git.rawをモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')

      await gitManager.deleteWorktree(branchName, true)

      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '--force',
        '/path/to/feature',
      ])
    })

    it('should throw error if worktree not found', async () => {
      const branchName = 'non-existent'

      // listWorktreesをモック（空の配列を返す）
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([])

      await expect(gitManager.deleteWorktree(branchName)).rejects.toThrow(
        "ワークツリー 'non-existent' が見つかりません"
      )
    })

    it('should delete local branch after removing worktree (issue #94)', async () => {
      const branchName = 'feature-to-delete'

      // listWorktreesをモック
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([
        {
          path: '/path/to/feature',
          head: 'abcdef1234567890',
          branch: 'refs/heads/feature-to-delete',
          isCurrentDirectory: false,
          detached: false,
          locked: false,
          prunable: false,
        },
      ])

      // git.rawをモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')
      ;(gitManager as any).git.branch = vi.fn().mockResolvedValue('')

      await gitManager.deleteWorktree(branchName)

      // worktreeの削除が呼び出されることを確認
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/path/to/feature',
      ])

      // ローカルブランチの削除も呼び出されることを確認（現在は失敗する）
      expect((gitManager as any).git.branch).toHaveBeenCalledWith(['-d', branchName])
    })

    it('should force delete local branch when regular deletion fails (issue #98)', async () => {
      const branchName = 'feature-not-fully-merged'
      // listWorktreesをモック
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([
        {
          path: '/path/to/feature',
          head: 'abcdef1234567890',
          branch: 'refs/heads/feature-not-fully-merged',
          isCurrentDirectory: false,
          detached: false,
          locked: false,
          prunable: false,
        },
      ])

      // git.rawをモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')

      // git.branchをモック - 最初の-dで失敗、-Dで成功するシナリオ
      const branchMock = vi
        .fn()
        .mockRejectedValueOnce(
          new Error("error: The branch 'feature-not-fully-merged' is not fully merged.")
        )
        .mockResolvedValueOnce('')
      ;(gitManager as any).git.branch = branchMock

      await gitManager.deleteWorktree(branchName)

      // worktreeの削除が呼び出されることを確認
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/path/to/feature',
      ])

      // ローカルブランチの削除が2回呼び出されることを確認
      expect(branchMock).toHaveBeenCalledTimes(2)
      expect(branchMock).toHaveBeenNthCalledWith(1, ['-d', branchName])
      expect(branchMock).toHaveBeenNthCalledWith(2, ['-D', branchName])
    })

    it('should cleanup empty parent directories after deleting worktree (issue #175)', async () => {
      const branchName = 'feature/api'
      const mockRepoRoot = '/test/repo'
      const worktreePath = '/test/feature/api'

      // listWorktreesをモック
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([
        {
          path: worktreePath,
          head: 'abcdef1234567890',
          branch: 'refs/heads/feature/api',
          isCurrentDirectory: false,
          detached: false,
          locked: false,
          prunable: false,
        },
      ])

      // getRepositoryRootをモック
      vi.spyOn(gitManager, 'getRepositoryRoot').mockResolvedValueOnce(mockRepoRoot)

      // git操作をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')
      ;(gitManager as any).git.branch = vi.fn().mockResolvedValue('')

      // ファイルシステム操作をモック
      vi.mocked(fs.readdir).mockResolvedValueOnce([]) // 親ディレクトリが空
      vi.mocked(fs.rmdir).mockResolvedValueOnce(undefined)

      await gitManager.deleteWorktree(branchName)

      // worktreeの削除が呼び出されることを確認
      expect((gitManager as any).git.raw).toHaveBeenCalledWith(['worktree', 'remove', worktreePath])

      // 空ディレクトリの確認と削除が呼び出されることを確認
      expect(fs.readdir).toHaveBeenCalledWith('/test/feature')
      expect(fs.rmdir).toHaveBeenCalledWith('/test/feature')
    })

    it('should not cleanup non-empty parent directories', async () => {
      const branchName = 'feature/api'
      const mockRepoRoot = '/test/repo'
      const worktreePath = '/test/feature/api'

      // listWorktreesをモック
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([
        {
          path: worktreePath,
          head: 'abcdef1234567890',
          branch: 'refs/heads/feature/api',
          isCurrentDirectory: false,
          detached: false,
          locked: false,
          prunable: false,
        },
      ])

      // getRepositoryRootをモック
      vi.spyOn(gitManager, 'getRepositoryRoot').mockResolvedValueOnce(mockRepoRoot)

      // git操作をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')
      ;(gitManager as any).git.branch = vi.fn().mockResolvedValue('')

      // ファイルシステム操作をモック - 親ディレクトリに他のファイルがある
      vi.mocked(fs.readdir).mockResolvedValueOnce(['other-file.txt'] as any)

      await gitManager.deleteWorktree(branchName)

      // 空でないディレクトリは削除されないことを確認
      expect(fs.readdir).toHaveBeenCalledWith('/test/feature')
      expect(fs.rmdir).not.toHaveBeenCalled()
    })

    it('should cleanup nested empty directories recursively', async () => {
      const branchName = 'feature/deep/nested/api'
      const mockRepoRoot = '/test/repo'
      const worktreePath = '/test/feature/deep/nested/api'

      // listWorktreesをモック
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([
        {
          path: worktreePath,
          head: 'abcdef1234567890',
          branch: 'refs/heads/feature/deep/nested/api',
          isCurrentDirectory: false,
          detached: false,
          locked: false,
          prunable: false,
        },
      ])

      // getRepositoryRootをモック
      vi.spyOn(gitManager, 'getRepositoryRoot').mockResolvedValueOnce(mockRepoRoot)

      // git操作をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')
      ;(gitManager as any).git.branch = vi.fn().mockResolvedValue('')

      // ファイルシステム操作をモック - すべての親ディレクトリが空
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce([]) // /test/feature/deep/nested
        .mockResolvedValueOnce([]) // /test/feature/deep
        .mockResolvedValueOnce([]) // /test/feature
        .mockResolvedValueOnce([]) // /test (baseDir)
      vi.mocked(fs.rmdir).mockResolvedValue(undefined)

      await gitManager.deleteWorktree(branchName)

      // 各レベルのディレクトリが確認・削除されることを確認
      expect(fs.readdir).toHaveBeenCalledWith('/test/feature/deep/nested')
      expect(fs.readdir).toHaveBeenCalledWith('/test/feature/deep')
      expect(fs.readdir).toHaveBeenCalledWith('/test/feature')
      expect(fs.rmdir).toHaveBeenCalledWith('/test/feature/deep/nested')
      expect(fs.rmdir).toHaveBeenCalledWith('/test/feature/deep')
      expect(fs.rmdir).toHaveBeenCalledWith('/test/feature')

      // ベースディレクトリ(/test)は削除されないことを確認
      expect(fs.rmdir).not.toHaveBeenCalledWith('/test')
    })

    it('should stop at base directory and not go above it', async () => {
      const branchName = 'single-level'
      const mockRepoRoot = '/test/repo'
      const worktreePath = '/test/single-level'

      // listWorktreesをモック
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([
        {
          path: worktreePath,
          head: 'abcdef1234567890',
          branch: 'refs/heads/single-level',
          isCurrentDirectory: false,
          detached: false,
          locked: false,
          prunable: false,
        },
      ])

      // getRepositoryRootをモック
      vi.spyOn(gitManager, 'getRepositoryRoot').mockResolvedValueOnce(mockRepoRoot)

      // git操作をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')
      ;(gitManager as any).git.branch = vi.fn().mockResolvedValue('')

      await gitManager.deleteWorktree(branchName)

      // ベースディレクトリ(/test)は確認も削除もされないことを確認
      expect(fs.readdir).not.toHaveBeenCalled()
      expect(fs.rmdir).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully during cleanup', async () => {
      const branchName = 'feature/error-case'
      const mockRepoRoot = '/test/repo'
      const worktreePath = '/test/feature/error-case'

      // listWorktreesをモック
      vi.spyOn(gitManager, 'listWorktrees').mockResolvedValueOnce([
        {
          path: worktreePath,
          head: 'abcdef1234567890',
          branch: 'refs/heads/feature/error-case',
          isCurrentDirectory: false,
          detached: false,
          locked: false,
          prunable: false,
        },
      ])

      // getRepositoryRootをモック
      vi.spyOn(gitManager, 'getRepositoryRoot').mockResolvedValueOnce(mockRepoRoot)

      // git操作をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')
      ;(gitManager as any).git.branch = vi.fn().mockResolvedValue('')

      // ファイルシステム操作をモック - readdirでエラーを発生させる
      vi.mocked(fs.readdir).mockRejectedValueOnce(new Error('Permission denied'))

      // エラーが発生してもdeleteWorktreeは成功することを確認
      await expect(gitManager.deleteWorktree(branchName)).resolves.toBeUndefined()

      // rmdirが呼ばれないことを確認
      expect(fs.rmdir).not.toHaveBeenCalled()
    })
  })

  describe('getAllBranches', () => {
    it('should list all branches', async () => {
      // git.branchLocal()をモック
      ;(gitManager as any).git.branchLocal = vi.fn().mockResolvedValue({
        all: ['main', 'feature-1', 'feature-2'],
      })

      // git.branch()をモック
      ;(gitManager as any).git.branch = vi.fn().mockResolvedValue({
        all: ['remotes/origin/main', 'remotes/origin/develop'],
      })

      const branches = await gitManager.getAllBranches()

      expect(branches.local).toEqual(['main', 'feature-1', 'feature-2'])
      expect(branches.remote).toEqual(['origin/main', 'origin/develop'])
    })

    it('should return empty arrays when no branches', async () => {
      ;(gitManager as any).git.branchLocal = vi.fn().mockResolvedValue({
        all: [],
      })
      ;(gitManager as any).git.branch = vi.fn().mockResolvedValue({
        all: [],
      })

      const branches = await gitManager.getAllBranches()

      expect(branches.local).toEqual([])
      expect(branches.remote).toEqual([])
    })
  })

  describe('checkBranchNameCollision', () => {
    it('should throw error for exact branch name match', async () => {
      // getAllBranchesをモック
      vi.spyOn(gitManager, 'getAllBranches').mockResolvedValueOnce({
        local: ['main', 'feature-test', 'develop'],
        remote: ['origin/main'],
      })

      await expect(gitManager.checkBranchNameCollision('feature-test')).rejects.toThrow(
        "ブランチ 'feature-test' は既に存在します"
      )
    })

    it('should throw error when new branch would be prefix of existing branch', async () => {
      // getAllBranchesをモック - feature/test/command-verification-parallel が存在する状況
      vi.spyOn(gitManager, 'getAllBranches').mockResolvedValueOnce({
        local: ['main', 'feature/test/command-verification-parallel'],
        remote: ['origin/main'],
      })

      await expect(gitManager.checkBranchNameCollision('feature/test')).rejects.toThrow(
        "ブランチ 'feature/test' を作成できません。以下の既存ブランチと競合します: feature/test/command-verification-parallel"
      )
    })

    it('should throw error when existing branch is prefix of new branch', async () => {
      // getAllBranchesをモック - feature/test が存在する状況
      vi.spyOn(gitManager, 'getAllBranches').mockResolvedValueOnce({
        local: ['main', 'feature/test'],
        remote: ['origin/main'],
      })

      await expect(gitManager.checkBranchNameCollision('feature/test/new-branch')).rejects.toThrow(
        "ブランチ 'feature/test/new-branch' を作成できません。以下の既存ブランチのサブブランチになります: feature/test"
      )
    })

    it('should handle multiple conflicting branches', async () => {
      // 複数の競合ブランチがある場合
      vi.spyOn(gitManager, 'getAllBranches').mockResolvedValueOnce({
        local: ['main', 'test/branch1', 'test/branch2', 'test/branch3', 'test/branch4'],
        remote: ['origin/main'],
      })

      await expect(gitManager.checkBranchNameCollision('test')).rejects.toThrow(
        "ブランチ 'test' を作成できません。以下の既存ブランチと競合します: test/branch1, test/branch2, test/branch3 など (4件)"
      )
    })

    it('should pass when no collision detected', async () => {
      // 衝突のない場合
      vi.spyOn(gitManager, 'getAllBranches').mockResolvedValueOnce({
        local: ['main', 'feature/other', 'develop'],
        remote: ['origin/main'],
      })

      await expect(gitManager.checkBranchNameCollision('feature/new')).resolves.toBeUndefined()
    })

    it('should handle remote branches correctly', async () => {
      // リモートブランチとの衝突も検知
      vi.spyOn(gitManager, 'getAllBranches').mockResolvedValueOnce({
        local: ['main'],
        remote: ['origin/feature/test/remote-branch'],
      })

      await expect(gitManager.checkBranchNameCollision('feature/test')).rejects.toThrow(
        "ブランチ 'feature/test' を作成できません。以下の既存ブランチと競合します: feature/test/remote-branch"
      )
    })
  })

  describe('generateAlternativeBranchName', () => {
    it('should generate alternative name with counter', () => {
      const allBranches = ['feature-test', 'feature-test-1', 'main']
      const result = gitManager.generateAlternativeBranchName('feature-test', allBranches)
      expect(result).toBe('feature-test-2')
    })

    it('should handle complex collision scenarios', () => {
      const allBranches = ['test', 'test-1', 'test-2', 'test/subranch', 'test-3/another']
      const result = gitManager.generateAlternativeBranchName('test', allBranches)
      expect(result).toBe('test-4')
    })

    it('should work with no existing branches', () => {
      const allBranches = ['main', 'develop']
      const result = gitManager.generateAlternativeBranchName('feature', allBranches)
      expect(result).toBe('feature-1')
    })
  })
})

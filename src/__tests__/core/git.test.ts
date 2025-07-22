import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'

// モック設定
vi.mock('execa')
vi.mock('fs/promises')
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

  beforeEach(() => {
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
    it('should create a new worktree', async () => {
      const branchName = 'feature-test'
      const expectedPath = path.resolve('.git/orchestrations/' + branchName)

      // checkBranchNameCollisionをモック（衝突なし）
      vi.spyOn(gitManager, 'checkBranchNameCollision').mockResolvedValueOnce()
      // git.raw()をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')
      ;(gitManager as any).git.status = vi.fn().mockResolvedValue({ current: 'main' })

      const result = await gitManager.createWorktree(branchName)

      expect(result).toBe(expectedPath)
      expect(gitManager.checkBranchNameCollision).toHaveBeenCalledWith(branchName)
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        '.git/orchestrations/feature-test',
        'main',
      ])
    })

    it('should use base branch if provided', async () => {
      const branchName = 'feature-test'
      const baseBranch = 'develop'
      const expectedPath = path.resolve('.git/orchestrations/' + branchName)

      // checkBranchNameCollisionをモック（衝突なし）
      vi.spyOn(gitManager, 'checkBranchNameCollision').mockResolvedValueOnce()
      // git.raw()をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')

      const result = await gitManager.createWorktree(branchName, baseBranch)

      expect(result).toBe(expectedPath)
      expect(gitManager.checkBranchNameCollision).toHaveBeenCalledWith(branchName)
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        '.git/orchestrations/feature-test',
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

      // checkBranchNameCollisionをモック（衝突なし）
      vi.spyOn(gitManager, 'checkBranchNameCollision').mockResolvedValueOnce()
      // git.raw()をモックしてエラーを発生させる
      ;(gitManager as any).git.raw = vi.fn().mockRejectedValue(new Error('worktree creation failed'))
      ;(gitManager as any).git.status = vi.fn().mockResolvedValue({ current: 'main' })

      await expect(gitManager.createWorktree(branchName)).rejects.toThrow('worktree creation failed')
    })
  })

  describe('attachWorktree', () => {
    it('should attach to an existing branch', async () => {
      const branchName = 'existing-feature'
      const expectedPath = path.resolve('.git/orchestrations/existing-feature')

      // git.raw()をモック
      ;(gitManager as any).git.raw = vi.fn().mockResolvedValue('')

      const result = await gitManager.attachWorktree(branchName)

      expect(result).toBe(expectedPath)
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '.git/orchestrations/existing-feature',
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
      const allBranches = [
        'test',
        'test-1',
        'test-2',
        'test/subranch',
        'test-3/another',
      ]
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

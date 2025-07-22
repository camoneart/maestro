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
      const mockRepoRoot = '/test/repo'
      const expectedPath = path.resolve(mockRepoRoot, '.git/orchestrations/' + branchName)

      // git.raw()をモック
      ;(gitManager as any).git.raw = vi
        .fn()
        .mockResolvedValueOnce(mockRepoRoot + '\n') // getRepositoryRoot()
        .mockResolvedValueOnce('') // worktree add
      ;(gitManager as any).git.status = vi.fn().mockResolvedValue({ current: 'main' })

      const result = await gitManager.createWorktree(branchName)

      expect(result).toBe(expectedPath)
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        path.join(mockRepoRoot, '.git/orchestrations/feature-test'),
        'main',
      ])
    })

    it('should use base branch if provided', async () => {
      const branchName = 'feature-test'
      const baseBranch = 'develop'
      const mockRepoRoot = '/test/repo'
      const expectedPath = path.resolve(mockRepoRoot, '.git/orchestrations/' + branchName)

      // git.raw()をモック
      ;(gitManager as any).git.raw = vi
        .fn()
        .mockResolvedValueOnce(mockRepoRoot + '\n') // getRepositoryRoot()
        .mockResolvedValueOnce('') // worktree add

      const result = await gitManager.createWorktree(branchName, baseBranch)

      expect(result).toBe(expectedPath)
      expect((gitManager as any).git.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        branchName,
        path.join(mockRepoRoot, '.git/orchestrations/feature-test'),
        baseBranch,
      ])
    })

    it('should throw error if worktree creation fails', async () => {
      const branchName = 'existing-branch'
      const mockRepoRoot = '/test/repo'

      // git.raw()をモックしてエラーを発生させる
      ;(gitManager as any).git.raw = vi
        .fn()
        .mockResolvedValueOnce(mockRepoRoot + '\n') // getRepositoryRoot()
        .mockRejectedValueOnce(new Error('branch already exists')) // worktree add fails
      ;(gitManager as any).git.status = vi.fn().mockResolvedValue({ current: 'main' })

      await expect(gitManager.createWorktree(branchName)).rejects.toThrow('branch already exists')
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
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitWorktreeManager } from '../../core/git.js'
import simpleGit from 'simple-git'

// モック設定
vi.mock('simple-git')

describe('GitWorktreeManager - coverage tests', () => {
  let gitManager: GitWorktreeManager
  let mockGit: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockGit = {
      status: vi.fn().mockResolvedValue({ current: 'main' }),
      raw: vi.fn().mockResolvedValue(''),
      branchLocal: vi.fn().mockResolvedValue({ all: ['main', 'feature/test'] }),
      branch: vi.fn().mockResolvedValue({ all: ['remotes/origin/main', 'remotes/origin/feature/test'] }),
      fetch: vi.fn().mockResolvedValue(undefined),
      log: vi.fn().mockResolvedValue({ 
        latest: { 
          date: '2023-01-01', 
          message: 'test commit', 
          hash: 'abc123456789' 
        } 
      })
    }
    
    vi.mocked(simpleGit).mockReturnValue(mockGit as any)
    gitManager = new GitWorktreeManager()
  })

  describe('createWorktree', () => {
    it('should create worktree with base branch', async () => {
      const result = await gitManager.createWorktree('feature/test', 'main')

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree', 'add', '-b', 'feature/test', 
        expect.stringContaining('feature/test'), 'main'
      ])
      expect(result).toContain('feature/test')
    })

    it('should create worktree with current branch as base', async () => {
      await gitManager.createWorktree('feature/test')

      expect(mockGit.status).toHaveBeenCalled()
      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree', 'add', '-b', 'feature/test', 
        expect.stringContaining('feature/test'), 'main'
      ])
    })

    it('should use main as fallback when current branch is null', async () => {
      mockGit.status.mockResolvedValue({ current: null })

      await gitManager.createWorktree('feature/test')

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree', 'add', '-b', 'feature/test', 
        expect.stringContaining('feature/test'), 'main'
      ])
    })
  })

  describe('attachWorktree', () => {
    it('should attach to existing branch', async () => {
      const result = await gitManager.attachWorktree('feature/existing')

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree', 'add', 
        expect.stringContaining('feature-existing'), 'feature/existing'
      ])
      expect(result).toContain('feature-existing')
    })

    it('should sanitize branch name for path', async () => {
      const result = await gitManager.attachWorktree('feature/test/sub')

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree', 'add', 
        expect.stringContaining('feature-test-sub'), 'feature/test/sub'
      ])
      expect(result).toContain('feature-test-sub')
    })
  })

  describe('listWorktrees', () => {
    it('should parse worktree list output', async () => {
      mockGit.raw.mockResolvedValue([
        'worktree /path/to/main',
        'HEAD abc123',
        'branch refs/heads/main',
        '',
        'worktree /path/to/feature',
        'HEAD def456',
        'branch refs/heads/feature/test',
        'locked work in progress',
        '',
        'worktree /path/to/detached',
        'HEAD ghi789',
        'detached'
      ].join('\n'))

      const result = await gitManager.listWorktrees()

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        path: '/path/to/main',
        head: 'abc123',
        branch: 'refs/heads/main',
        locked: false,
        detached: false,
        prunable: false
      })
      expect(result[1]).toMatchObject({
        path: '/path/to/feature',
        head: 'def456',
        branch: 'refs/heads/feature/test',
        locked: true,
        reason: 'work in progress'
      })
      expect(result[2]).toMatchObject({
        path: '/path/to/detached',
        head: 'ghi789',
        detached: true
      })
    })

    it('should handle prunable worktrees', async () => {
      mockGit.raw.mockResolvedValue([
        'worktree /path/to/prunable',
        'HEAD abc123',
        'branch refs/heads/old-branch',
        'prunable'
      ].join('\n'))

      const result = await gitManager.listWorktrees()

      expect(result[0]).toMatchObject({
        path: '/path/to/prunable',
        prunable: true
      })
    })

    it('should handle locked worktree without reason', async () => {
      mockGit.raw.mockResolvedValue([
        'worktree /path/to/locked',
        'HEAD abc123',
        'branch refs/heads/locked-branch',
        'locked'
      ].join('\n'))

      const result = await gitManager.listWorktrees()

      expect(result[0]).toMatchObject({
        path: '/path/to/locked',
        locked: true
      })
      expect(result[0].reason).toBeUndefined()
    })

    it('should handle empty worktree list', async () => {
      mockGit.raw.mockResolvedValue('')

      const result = await gitManager.listWorktrees()

      expect(result).toHaveLength(0)
    })
  })

  describe('deleteWorktree', () => {
    beforeEach(() => {
      mockGit.raw.mockImplementation(async (args) => {
        if (args[0] === 'worktree' && args[1] === 'list') {
          return [
            'worktree /path/to/main',
            'HEAD abc123',
            'branch refs/heads/main',
            '',
            'worktree /path/to/feature',
            'HEAD def456',
            'branch refs/heads/feature/test'
          ].join('\n')
        }
        return ''
      })
    })

    it('should delete worktree by branch name', async () => {
      await gitManager.deleteWorktree('feature/test')

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree', 'remove', '/path/to/feature'
      ])
    })

    it('should delete worktree with force flag', async () => {
      await gitManager.deleteWorktree('feature/test', true)

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree', 'remove', '--force', '/path/to/feature'
      ])
    })

    it('should throw error if worktree not found', async () => {
      await expect(gitManager.deleteWorktree('nonexistent')).rejects.toThrow(
        "ワークツリー 'nonexistent' が見つかりません"
      )
    })

    it('should handle branch with refs/heads/ prefix', async () => {
      mockGit.raw.mockImplementation(async (args) => {
        if (args[0] === 'worktree' && args[1] === 'list') {
          return [
            'worktree /path/to/feature',
            'HEAD def456',
            'branch refs/heads/feature/test'
          ].join('\n')
        }
        return ''
      })

      await gitManager.deleteWorktree('feature/test')

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree', 'remove', '/path/to/feature'
      ])
    })
  })

  describe('getCurrentBranch', () => {
    it('should return current branch', async () => {
      mockGit.status.mockResolvedValue({ current: 'feature/test' })

      const result = await gitManager.getCurrentBranch()

      expect(result).toBe('feature/test')
    })

    it('should return null if no current branch', async () => {
      mockGit.status.mockResolvedValue({ current: null })

      const result = await gitManager.getCurrentBranch()

      expect(result).toBeNull()
    })
  })

  describe('isGitRepository', () => {
    it('should return true for git repository', async () => {
      const result = await gitManager.isGitRepository()

      expect(result).toBe(true)
      expect(mockGit.status).toHaveBeenCalled()
    })

    it('should return false for non-git directory', async () => {
      mockGit.status.mockRejectedValue(new Error('not a git repository'))

      const result = await gitManager.isGitRepository()

      expect(result).toBe(false)
    })
  })

  describe('getAllBranches', () => {
    it('should return local and remote branches', async () => {
      mockGit.branchLocal.mockResolvedValue({ 
        all: ['main', 'feature/test'] 
      })
      mockGit.branch.mockResolvedValue({ 
        all: ['remotes/origin/main', 'remotes/origin/feature/test'] 
      })

      const result = await gitManager.getAllBranches()

      expect(result).toEqual({
        local: ['main', 'feature/test'],
        remote: ['origin/main', 'origin/feature/test']
      })
    })

    it('should filter out remotes from local branches', async () => {
      mockGit.branchLocal.mockResolvedValue({ 
        all: ['main', 'feature/test', 'remotes/origin/main'] 
      })
      mockGit.branch.mockResolvedValue({ 
        all: ['remotes/origin/main'] 
      })

      const result = await gitManager.getAllBranches()

      expect(result.local).toEqual(['main', 'feature/test'])
      expect(result.remote).toEqual(['origin/main'])
    })
  })

  describe('fetchAll', () => {
    it('should fetch all remotes', async () => {
      await gitManager.fetchAll()

      expect(mockGit.fetch).toHaveBeenCalledWith(['--all'])
    })
  })

  describe('getLastCommit', () => {
    it('should return last commit info', async () => {
      mockGit.log.mockResolvedValue({
        latest: {
          date: '2023-01-01',
          message: 'test commit',
          hash: 'abc123456789'
        }
      })

      const result = await gitManager.getLastCommit('/path/to/worktree')

      expect(result).toEqual({
        date: '2023-01-01',
        message: 'test commit',
        hash: 'abc1234'
      })
    })

    it('should return null if no commits', async () => {
      mockGit.log.mockResolvedValue({ latest: null })

      const result = await gitManager.getLastCommit('/path/to/worktree')

      expect(result).toBeNull()
    })

    it('should return null on error', async () => {
      mockGit.log.mockRejectedValue(new Error('git log failed'))

      const result = await gitManager.getLastCommit('/path/to/worktree')

      expect(result).toBeNull()
    })
  })

  describe('constructor', () => {
    it('should use provided base directory', () => {
      const manager = new GitWorktreeManager('/custom/path')

      expect(simpleGit).toHaveBeenCalledWith('/custom/path')
    })

    it('should use current directory by default', () => {
      const manager = new GitWorktreeManager()

      expect(simpleGit).toHaveBeenCalledWith(process.cwd())
    })
  })
})
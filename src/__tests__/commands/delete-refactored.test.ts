import { describe, it, expect, vi } from 'vitest'
import { 
  prepareWorktreeSelection, 
  validateWorktreeDeletion, 
  executeWorktreeDeletion 
} from '../../commands/delete.js'
import { Worktree } from '../../types/index.js'
import { GitWorktreeManager } from '../../core/git.js'

// GitWorktreeManagerをモック
vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn().mockImplementation(() => ({
    deleteWorktree: vi.fn()
  }))
}))

describe('delete.ts refactored functions', () => {
  const mockWorktrees: Worktree[] = [
    {
      path: '/project/.git/shadow-clones/feature-1',
      head: 'abc123',
      branch: 'refs/heads/feature-1',
      locked: false,
      prunable: false,
      detached: false
    },
    {
      path: '/project/.git/shadow-clones/feature-2',
      head: 'def456',
      branch: 'refs/heads/feature-2',
      locked: true,
      prunable: false,
      detached: false
    },
    {
      path: '/project/.',
      head: 'ghi789',
      branch: 'refs/heads/main',
      locked: false,
      prunable: false,
      detached: false
    }
  ]

  describe('prepareWorktreeSelection', () => {
    it('should filter out main worktree', () => {
      const result = prepareWorktreeSelection(mockWorktrees)
      
      expect(result.filteredWorktrees).toHaveLength(2)
      expect(result.filteredWorktrees.every(wt => !wt.path.endsWith('.'))).toBe(true)
    })

    it('should return empty when no shadow clones exist', () => {
      const mainOnlyWorktrees = [mockWorktrees[2]]
      const result = prepareWorktreeSelection(mainOnlyWorktrees)
      
      expect(result.filteredWorktrees).toHaveLength(0)
      expect(result.needsInteractiveSelection).toBe(false)
    })

    it('should find current worktree when --current option is used', () => {
      const originalCwd = process.cwd
      process.cwd = vi.fn().mockReturnValue('/project/.git/shadow-clones/feature-1')
      
      const result = prepareWorktreeSelection(mockWorktrees, undefined, { current: true })
      
      expect(result.filteredWorktrees).toHaveLength(1)
      expect(result.filteredWorktrees[0].branch).toBe('refs/heads/feature-1')
      expect(result.needsInteractiveSelection).toBe(false)
      
      process.cwd = originalCwd
    })

    it('should find specific branch when branch name is provided', () => {
      const result = prepareWorktreeSelection(mockWorktrees, 'feature-1')
      
      expect(result.filteredWorktrees).toHaveLength(1)
      expect(result.filteredWorktrees[0].branch).toBe('refs/heads/feature-1')
      expect(result.needsInteractiveSelection).toBe(false)
    })

    it('should require interactive selection when fzf is requested', () => {
      const result = prepareWorktreeSelection(mockWorktrees, undefined, { fzf: true })
      
      expect(result.filteredWorktrees).toHaveLength(2)
      expect(result.needsInteractiveSelection).toBe(true)
    })

    it('should handle branch name with refs/heads/ prefix', () => {
      const result = prepareWorktreeSelection(mockWorktrees, 'feature-1')
      
      expect(result.filteredWorktrees).toHaveLength(1)
      expect(result.filteredWorktrees[0].branch).toBe('refs/heads/feature-1')
    })
  })

  describe('validateWorktreeDeletion', () => {
    it('should validate normal worktree deletion', () => {
      const worktree = mockWorktrees[0]
      const result = validateWorktreeDeletion(worktree)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.requiresConfirmation).toBe(false)
    })

    it('should warn about locked worktree', () => {
      const worktree = mockWorktrees[1]
      const result = validateWorktreeDeletion(worktree)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('ロックされています')
      expect(result.requiresConfirmation).toBe(true)
    })

    it('should not require confirmation when force is used', () => {
      const worktree = mockWorktrees[1]
      const result = validateWorktreeDeletion(worktree, { force: true })
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.requiresConfirmation).toBe(false)
    })

    it('should warn about prunable worktree', () => {
      const prunableWorktree = {
        ...mockWorktrees[0],
        prunable: true
      }
      const result = validateWorktreeDeletion(prunableWorktree)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('削除可能')
      expect(result.requiresConfirmation).toBe(true)
    })

    it('should handle both locked and prunable worktree', () => {
      const complexWorktree = {
        ...mockWorktrees[0],
        locked: true,
        prunable: true
      }
      const result = validateWorktreeDeletion(complexWorktree)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(2)
      expect(result.requiresConfirmation).toBe(true)
    })
  })

  describe('executeWorktreeDeletion', () => {
    it('should execute worktree deletion successfully', async () => {
      const mockGitManager = new GitWorktreeManager()
      const worktree = mockWorktrees[0]
      
      vi.mocked(mockGitManager.deleteWorktree).mockResolvedValue(undefined)
      
      const result = await executeWorktreeDeletion(mockGitManager, worktree)
      
      expect(result.success).toBe(true)
      expect(result.branchName).toBe('feature-1')
      expect(mockGitManager.deleteWorktree).toHaveBeenCalledWith('feature-1', undefined)
    })

    it('should handle force deletion', async () => {
      const mockGitManager = new GitWorktreeManager()
      const worktree = mockWorktrees[1]
      
      vi.mocked(mockGitManager.deleteWorktree).mockResolvedValue(undefined)
      
      const result = await executeWorktreeDeletion(mockGitManager, worktree, { force: true })
      
      expect(result.success).toBe(true)
      expect(result.branchName).toBe('feature-2')
      expect(mockGitManager.deleteWorktree).toHaveBeenCalledWith('feature-2', true)
    })

    it('should handle branch name without refs/heads/ prefix', async () => {
      const mockGitManager = new GitWorktreeManager()
      const worktree = {
        ...mockWorktrees[0],
        branch: 'feature-1'
      }
      
      vi.mocked(mockGitManager.deleteWorktree).mockResolvedValue(undefined)
      
      const result = await executeWorktreeDeletion(mockGitManager, worktree)
      
      expect(result.success).toBe(true)
      expect(result.branchName).toBe('feature-1')
    })

    it('should throw error when deletion fails', async () => {
      const mockGitManager = new GitWorktreeManager()
      const worktree = mockWorktrees[0]
      
      vi.mocked(mockGitManager.deleteWorktree).mockRejectedValue(new Error('Git error'))
      
      await expect(executeWorktreeDeletion(mockGitManager, worktree)).rejects.toThrow('Git error')
    })

    it('should handle null branch name gracefully', async () => {
      const mockGitManager = new GitWorktreeManager()
      const worktree = {
        ...mockWorktrees[0],
        branch: null
      }
      
      vi.mocked(mockGitManager.deleteWorktree).mockResolvedValue(undefined)
      
      const result = await executeWorktreeDeletion(mockGitManager, worktree)
      
      expect(result.success).toBe(true)
      expect(result.branchName).toBeNull()
    })
  })
})
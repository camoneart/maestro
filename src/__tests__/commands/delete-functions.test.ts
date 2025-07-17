import { describe, expect, it } from 'vitest'
import { formatDirectorySize, createWorktreeDisplay } from '../../commands/delete.js'
import type { Worktree } from '../../types/index.js'

describe('delete command functions', () => {
  describe('formatDirectorySize', () => {
    it('should format different byte sizes correctly', () => {
      expect(formatDirectorySize(0)).toBe('0 B')
      expect(formatDirectorySize(512)).toBe('512 B')
      expect(formatDirectorySize(1024)).toBe('1.0 KB')
      expect(formatDirectorySize(1536)).toBe('1.5 KB')
      expect(formatDirectorySize(1024 * 1024)).toBe('1.0 MB')
      expect(formatDirectorySize(1024 * 1024 * 1024)).toBe('1.0 GB')
    })

    it('should handle very large numbers', () => {
      const largeNumber = 1024 * 1024 * 1024 * 1024 // 1TB in bytes
      expect(formatDirectorySize(largeNumber)).toBe('1024.0 GB')
    })

    it('should handle decimal values properly', () => {
      expect(formatDirectorySize(2560)).toBe('2.5 KB')
      expect(formatDirectorySize(1572864)).toBe('1.5 MB')
    })
  })

  describe('createWorktreeDisplay', () => {
    it('should display normal worktree correctly', () => {
      const worktree: Worktree = {
        path: '/test/path',
        branch: 'feature-branch',
        head: 'abc123',
        detached: false,
        prunable: false,
        locked: false,
      }
      expect(createWorktreeDisplay(worktree)).toBe('feature-branch')
    })

    it('should handle locked worktree', () => {
      const worktree: Worktree = {
        path: '/test/path',
        branch: 'feature-branch',
        head: 'abc123',
        detached: false,
        prunable: false,
        locked: true,
      }
      expect(createWorktreeDisplay(worktree)).toBe('🔒 feature-branch')
    })

    it('should handle detached worktree', () => {
      const worktree: Worktree = {
        path: '/test/path',
        branch: 'abc123',
        head: 'abc123',
        detached: true,
        prunable: false,
        locked: false,
      }
      expect(createWorktreeDisplay(worktree)).toBe('⚠️  abc123 (detached)')
    })

    it('should handle locked and detached worktree', () => {
      const worktree: Worktree = {
        path: '/test/path',
        branch: 'abc123',
        head: 'abc123',
        detached: true,
        prunable: false,
        locked: true,
      }
      // Implementation applies locked first, then detached
      expect(createWorktreeDisplay(worktree)).toBe('⚠️  🔒 abc123 (detached)')
    })

    it('should fall back to head when branch is empty', () => {
      const worktree: Worktree = {
        path: '/test/path',
        branch: '',
        head: 'def456',
        detached: false,
        prunable: false,
        locked: false,
      }
      expect(createWorktreeDisplay(worktree)).toBe('def456')
    })

    it('should handle unicode characters in branch names', () => {
      const worktree: Worktree = {
        path: '/test/path',
        branch: '🚀feature/unicode-test',
        head: 'abc123',
        detached: false,
        prunable: false,
        locked: false,
      }
      expect(createWorktreeDisplay(worktree)).toBe('🚀feature/unicode-test')
    })

    it('should handle very long branch names', () => {
      const longBranch = 'feature/' + 'very-long-branch-name-'.repeat(5)
      const worktree: Worktree = {
        path: '/test/path',
        branch: longBranch,
        head: 'abc123',
        detached: false,
        prunable: false,
        locked: false,
      }
      expect(createWorktreeDisplay(worktree)).toBe(longBranch)
    })

    it('should handle special characters in branch names', () => {
      const worktree: Worktree = {
        path: '/test/path',
        branch: 'feature/fix-$pecial-char$',
        head: 'abc123',
        detached: false,
        prunable: false,
        locked: false,
      }
      expect(createWorktreeDisplay(worktree)).toBe('feature/fix-$pecial-char$')
    })
  })

  describe('edge cases', () => {
    it('should handle null/undefined-like values safely', () => {
      const worktree: Worktree = {
        path: '/test/path',
        branch: '',
        head: '',
        detached: false,
        prunable: false,
        locked: false,
      }
      // Should fall back to head even if empty
      expect(createWorktreeDisplay(worktree)).toBe('')
    })

    it('should handle negative byte sizes (edge case)', () => {
      // This shouldn't happen in practice but test robustness
      expect(formatDirectorySize(-1024)).toBe('-1024 B')
    })

    it('should handle fractional byte sizes', () => {
      expect(formatDirectorySize(1024.5)).toBe('1.0 KB')
      expect(formatDirectorySize(1536.7)).toBe('1.5 KB')
    })
  })
})

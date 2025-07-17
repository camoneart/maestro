import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatDirectorySize,
  createWorktreeDisplay,
  getDirectorySize,
  deleteRemoteBranch,
} from '../../commands/delete.js'
import { execa } from 'execa'
import { Worktree } from '../../types/index.js'

// モック設定
vi.mock('execa')

describe('delete command - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('formatDirectorySize', () => {
    it('should format bytes', () => {
      expect(formatDirectorySize(500)).toBe('500 B')
    })

    it('should format kilobytes', () => {
      expect(formatDirectorySize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes', () => {
      expect(formatDirectorySize(1572864)).toBe('1.5 MB')
    })

    it('should format gigabytes', () => {
      expect(formatDirectorySize(1610612736)).toBe('1.5 GB')
    })

    it('should handle zero bytes', () => {
      expect(formatDirectorySize(0)).toBe('0 B')
    })

    it('should handle exact boundaries', () => {
      expect(formatDirectorySize(1024)).toBe('1.0 KB')
      expect(formatDirectorySize(1024 * 1024)).toBe('1.0 MB')
      expect(formatDirectorySize(1024 * 1024 * 1024)).toBe('1.0 GB')
    })
  })

  describe('createWorktreeDisplay', () => {
    it('should display normal worktree', () => {
      const worktree: Worktree = {
        path: '/path/to/worktree',
        branch: 'feature/test',
        head: 'abc123',
        locked: false,
        detached: false,
        prunable: false,
      }

      const result = createWorktreeDisplay(worktree)

      expect(result).toBe('feature/test')
    })

    it('should display locked worktree', () => {
      const worktree: Worktree = {
        path: '/path/to/worktree',
        branch: 'feature/test',
        head: 'abc123',
        locked: true,
        detached: false,
        prunable: false,
      }

      const result = createWorktreeDisplay(worktree)

      expect(result).toBe('🔒 feature/test')
    })

    it('should display detached worktree', () => {
      const worktree: Worktree = {
        path: '/path/to/worktree',
        branch: null,
        head: 'abc123',
        locked: false,
        detached: true,
        prunable: false,
      }

      const result = createWorktreeDisplay(worktree)

      expect(result).toBe('⚠️  abc123 (detached)')
    })

    it('should display locked and detached worktree', () => {
      const worktree: Worktree = {
        path: '/path/to/worktree',
        branch: null,
        head: 'abc123',
        locked: true,
        detached: true,
        prunable: false,
      }

      const result = createWorktreeDisplay(worktree)

      expect(result).toBe('⚠️  🔒 abc123 (detached)')
    })

    it('should handle null branch and head', () => {
      const worktree: Worktree = {
        path: '/path/to/worktree',
        branch: null,
        head: 'abc123',
        locked: false,
        detached: false,
        prunable: false,
      }

      const result = createWorktreeDisplay(worktree)

      expect(result).toBe('abc123')
    })

    it('should prefer branch over head', () => {
      const worktree: Worktree = {
        path: '/path/to/worktree',
        branch: 'feature/test',
        head: 'abc123',
        locked: false,
        detached: false,
        prunable: false,
      }

      const result = createWorktreeDisplay(worktree)

      expect(result).toBe('feature/test')
    })
  })

  describe('getDirectorySize', () => {
    it('should return directory size', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: '1.5M\t/path/to/dir',
      })

      const result = await getDirectorySize('/path/to/dir')

      expect(result).toBe('1.5M')
      expect(execa).toHaveBeenCalledWith('du', ['-sh', '/path/to/dir'])
    })

    it('should handle du command failure', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('du failed'))

      const result = await getDirectorySize('/path/to/dir')

      expect(result).toBe('unknown')
    })

    it('should handle empty output', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: '',
      })

      const result = await getDirectorySize('/path/to/dir')

      expect(result).toBe('unknown')
    })

    it('should handle malformed output', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: 'malformed output',
      })

      const result = await getDirectorySize('/path/to/dir')

      expect(result).toBe('malformed output')
    })
  })

  describe('deleteRemoteBranch', () => {
    it('should delete remote branch successfully', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'git' && args?.[0] === 'branch' && args?.[1] === '-r') {
          return { stdout: 'origin/main\norigin/feature/test\norigin/develop' }
        }
        if (
          cmd === 'git' &&
          args?.[0] === 'push' &&
          args?.[1] === 'origin' &&
          args?.[2] === '--delete'
        ) {
          return { stdout: 'deleted' }
        }
        return { stdout: '' }
      })

      await deleteRemoteBranch('feature/test')

      expect(execa).toHaveBeenCalledWith('git', ['branch', '-r'])
      expect(execa).toHaveBeenCalledWith('git', ['push', 'origin', '--delete', 'feature/test'])
    })

    it('should handle remote branch not found', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'git' && args?.[0] === 'branch' && args?.[1] === '-r') {
          return { stdout: 'origin/main\norigin/develop' }
        }
        return { stdout: '' }
      })

      await deleteRemoteBranch('feature/nonexistent')

      expect(execa).toHaveBeenCalledWith('git', ['branch', '-r'])
      expect(execa).not.toHaveBeenCalledWith('git', [
        'push',
        'origin',
        '--delete',
        'feature/nonexistent',
      ])
    })

    it('should handle git branch list failure', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'git' && args?.[0] === 'branch' && args?.[1] === '-r') {
          throw new Error('git branch failed')
        }
        return { stdout: '' }
      })

      await expect(deleteRemoteBranch('feature/test')).rejects.toThrow('git branch failed')
    })

    it('should handle git push delete failure', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'git' && args?.[0] === 'branch' && args?.[1] === '-r') {
          return { stdout: 'origin/feature/test' }
        }
        if (
          cmd === 'git' &&
          args?.[0] === 'push' &&
          args?.[1] === 'origin' &&
          args?.[2] === '--delete'
        ) {
          throw new Error('push delete failed')
        }
        return { stdout: '' }
      })

      await expect(deleteRemoteBranch('feature/test')).rejects.toThrow('push delete failed')
    })

    it('should handle protected branch deletion', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'git' && args?.[0] === 'branch' && args?.[1] === '-r') {
          return { stdout: 'origin/main\norigin/feature/test' }
        }
        if (
          cmd === 'git' &&
          args?.[0] === 'push' &&
          args?.[1] === 'origin' &&
          args?.[2] === '--delete'
        ) {
          throw new Error('remote: error: refusing to delete protected branch')
        }
        return { stdout: '' }
      })

      await expect(deleteRemoteBranch('feature/test')).rejects.toThrow('protected branch')
    })

    it('should handle authentication failure', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'git' && args?.[0] === 'branch' && args?.[1] === '-r') {
          return { stdout: 'origin/feature/test' }
        }
        if (
          cmd === 'git' &&
          args?.[0] === 'push' &&
          args?.[1] === 'origin' &&
          args?.[2] === '--delete'
        ) {
          throw new Error('Authentication failed')
        }
        return { stdout: '' }
      })

      await expect(deleteRemoteBranch('feature/test')).rejects.toThrow('Authentication failed')
    })

    it('should handle network error', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'git' && args?.[0] === 'branch' && args?.[1] === '-r') {
          return { stdout: 'origin/feature/test' }
        }
        if (
          cmd === 'git' &&
          args?.[0] === 'push' &&
          args?.[1] === 'origin' &&
          args?.[2] === '--delete'
        ) {
          throw new Error('Network error')
        }
        return { stdout: '' }
      })

      await expect(deleteRemoteBranch('feature/test')).rejects.toThrow('Network error')
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectWorktreeWithFzf, isFzfAvailable } from '../../utils/fzf.js'
import { Worktree } from '../../types/index.js'

// spawn をモック
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

describe('fzf utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isFzfAvailable', () => {
    it('should return true when fzf is available', async () => {
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0) // exit code 0 means success
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      const result = await isFzfAvailable()
      expect(result).toBe(true)
    })

    it('should return false when fzf is not available', async () => {
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1) // non-zero exit code means failure
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      const result = await isFzfAvailable()
      expect(result).toBe(false)
    })

    it('should return false when spawn throws error', async () => {
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Command not found'))
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      const result = await isFzfAvailable()
      expect(result).toBe(false)
    })
  })

  describe('selectWorktreeWithFzf', () => {
    const mockWorktrees: Worktree[] = [
      {
        path: '/repo/worktrees/feature-auth',
        branch: 'refs/heads/feature-auth',
        head: 'abc123',
        detached: false,
        prunable: false,
        locked: false,
      },
      {
        path: '/repo/worktrees/feature-ui',
        branch: 'refs/heads/feature-ui',
        head: 'def456',
        detached: false,
        prunable: false,
        locked: true,
      },
      {
        path: '/repo/worktrees/hotfix',
        branch: 'refs/heads/hotfix',
        head: 'ghi789',
        detached: false,
        prunable: true,
        locked: false,
      },
    ]

    it('should return selected branch name when user selects', async () => {
      const mockStdin = {
        write: vi.fn(),
        end: vi.fn(),
      }
      
      const mockStdout = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('feature-auth | /repo/worktrees/feature-auth\n'))
          }
        }),
      }

      const mockSpawn = vi.fn().mockReturnValue({
        stdin: mockStdin,
        stdout: mockStdout,
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0) // successful selection
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      const result = await selectWorktreeWithFzf(mockWorktrees, 'Test header')
      
      expect(result).toBe('feature-auth')
      expect(mockSpawn).toHaveBeenCalledWith(
        'fzf',
        [
          '--ansi',
          '--header', 'Test header',
          '--preview',
          'echo {} | cut -d"|" -f2 | xargs ls -la',
          '--preview-window=right:50%:wrap',
        ],
        { stdio: ['pipe', 'pipe', 'inherit'] }
      )
    })

    it('should return null when user cancels', async () => {
      const mockStdin = {
        write: vi.fn(),
        end: vi.fn(),
      }
      
      const mockStdout = {
        on: vi.fn(),
      }

      const mockSpawn = vi.fn().mockReturnValue({
        stdin: mockStdin,
        stdout: mockStdout,
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1) // cancelled (Ctrl-C)
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      const result = await selectWorktreeWithFzf(mockWorktrees)
      
      expect(result).toBeNull()
    })

    it('should format worktree entries correctly with status indicators', async () => {
      const mockStdin = {
        write: vi.fn(),
        end: vi.fn(),
      }
      
      const mockStdout = {
        on: vi.fn(),
      }

      const mockSpawn = vi.fn().mockReturnValue({
        stdin: mockStdin,
        stdout: mockStdout,
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1) // cancelled to avoid complex selection logic in test
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      await selectWorktreeWithFzf(mockWorktrees)
      
      // Check that fzf input contains formatted entries
      expect(mockStdin.write).toHaveBeenCalledWith(
        expect.stringContaining('feature-auth | /repo/worktrees/feature-auth')
      )
      expect(mockStdin.write).toHaveBeenCalledWith(
        expect.stringContaining('feature-ui')
      )
      expect(mockStdin.write).toHaveBeenCalledWith(
        expect.stringContaining('hotfix')
      )
    })
  })
})
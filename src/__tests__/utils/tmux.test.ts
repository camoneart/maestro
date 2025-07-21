import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isInTmuxSession,
  executeTmuxCommand,
  startTmuxShell,
  executeTmuxCommandInPane,
} from '../../utils/tmux.js'

// spawn をモック
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

describe('tmux utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TMUX
  })

  describe('isInTmuxSession', () => {
    it('should return true when TMUX environment variable is set', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,1234,0'
      const result = await isInTmuxSession()
      expect(result).toBe(true)
    })

    it('should return false when TMUX environment variable is not set', async () => {
      const result = await isInTmuxSession()
      expect(result).toBe(false)
    })
  })

  describe('executeTmuxCommand', () => {
    it('should throw error if not in tmux session', async () => {
      await expect(
        executeTmuxCommand(['echo', 'test'])
      ).rejects.toThrow('tmuxオプションを使用するにはtmuxセッション内にいる必要があります')
    })

    it('should create new window command when in tmux session', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,1234,0'
      
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            callback(0)
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      await executeTmuxCommand(['echo', 'test'], {
        paneType: 'new-window',
        sessionName: 'test-session',
      })

      expect(mockSpawn).toHaveBeenCalledWith(
        'tmux',
        ['new-window', '-n', 'test-session', 'echo', 'test'],
        expect.objectContaining({
          stdio: 'inherit',
        })
      )
    })

    it('should create vertical split command', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,1234,0'
      
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            callback(0)
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      await executeTmuxCommand(['echo', 'test'], {
        paneType: 'vertical-split',
        cwd: '/test/path',
      })

      expect(mockSpawn).toHaveBeenCalledWith(
        'tmux',
        ['split-window', '-v', '-c', '/test/path', 'echo', 'test'],
        expect.objectContaining({
          stdio: 'inherit',
        })
      )
    })

    it('should create horizontal split command', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,1234,0'
      
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            callback(0)
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      await executeTmuxCommand(['echo', 'test'], {
        paneType: 'horizontal-split',
      })

      expect(mockSpawn).toHaveBeenCalledWith(
        'tmux',
        ['split-window', '-h', 'echo', 'test'],
        expect.objectContaining({
          stdio: 'inherit',
        })
      )
    })
  })

  describe('startTmuxShell', () => {
    it('should start shell with correct environment variables', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,1234,0'
      process.env.SHELL = '/bin/zsh'
      
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            callback(0)
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      await startTmuxShell({
        cwd: '/test/path',
        branchName: 'feature-test',
        paneType: 'new-window',
      })

      expect(mockSpawn).toHaveBeenCalledWith(
        'tmux',
        expect.arrayContaining(['new-window', '-n', 'feature-test', '-c', '/test/path', '/bin/zsh']),
        expect.objectContaining({
          stdio: 'inherit',
          env: expect.objectContaining({
            MAESTRO: '1',
            MAESTRO_NAME: 'feature-test',
            MAESTRO_PATH: '/test/path',
          }),
        })
      )
    })
  })

  describe('executeTmuxCommandInPane', () => {
    it('should execute command in pane with correct environment', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,1234,0'
      
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            callback(0)
          }
        }),
      })
      
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockImplementation(mockSpawn)

      await executeTmuxCommandInPane('npm test', {
        cwd: '/test/path',
        branchName: 'feature-test',
        paneType: 'vertical-split',
      })

      expect(mockSpawn).toHaveBeenCalledWith(
        'tmux',
        ['split-window', '-v', '-c', '/test/path', 'sh', '-c', 'npm test'],
        expect.objectContaining({
          stdio: 'inherit',
          env: expect.objectContaining({
            MAESTRO: '1',
            MAESTRO_BRANCH: 'feature-test',
            MAESTRO_PATH: '/test/path',
          }),
        })
      )
    })
  })
})
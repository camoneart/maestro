import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import { spawn } from 'child_process'
import { NativeTmuxHelper } from '../../utils/nativeTmux.js'

// Mock dependencies
vi.mock('execa')
vi.mock('child_process')

const mockedExeca = vi.mocked(execa)
const mockedSpawn = vi.mocked(spawn)

describe('NativeTmuxHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sessionExists', () => {
    it('should return true when session exists', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      const result = await NativeTmuxHelper.sessionExists('test-session')
      expect(result).toBe(true)
      expect(mockedExeca).toHaveBeenCalledWith('tmux', ['has-session', '-t', 'test-session'])
    })

    it('should return false when session does not exist', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('Session not found'))

      const result = await NativeTmuxHelper.sessionExists('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('listSessions', () => {
    it('should return empty array when no sessions exist', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('No sessions'))

      const result = await NativeTmuxHelper.listSessions()
      expect(result).toEqual([])
    })

    it('should parse session list correctly', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: 'session1:1\nsession2:0\nsession3:1',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      const result = await NativeTmuxHelper.listSessions()
      expect(result).toEqual([
        { name: 'session1', attached: true },
        { name: 'session2', attached: false },
        { name: 'session3', attached: true },
      ])
    })

    it('should handle malformed session output', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '::\nvalid-session:1\n:',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      const result = await NativeTmuxHelper.listSessions()
      expect(result).toEqual([
        { name: 'unknown', attached: false },
        { name: 'valid-session', attached: true },
        { name: 'unknown', attached: false },
      ])
    })
  })

  describe('switchClient', () => {
    beforeEach(() => {
      // Mock environment variable
      process.env.TMUX = 'test-session'
    })

    afterEach(() => {
      delete process.env.TMUX
    })

    it('should throw error when not in tmux', async () => {
      delete process.env.TMUX

      await expect(NativeTmuxHelper.switchClient('test')).rejects.toThrow(
        'switch-client can only be used from within tmux'
      )
    })

    it('should throw error when session does not exist', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('Session not found'))

      await expect(NativeTmuxHelper.switchClient('non-existent')).rejects.toThrow(
        "Tmux session 'non-existent' does not exist"
      )
    })

    it('should switch client successfully', async () => {
      // Mock session existence check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      // Mock helper script execution
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      await expect(NativeTmuxHelper.switchClient('test-session')).resolves.toBeUndefined()
    })

    it('should throw error when helper script execution fails', async () => {
      // Mock session existence check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      // Mock helper script execution failure
      mockedExeca.mockRejectedValueOnce(new Error('Helper failed'))

      await expect(NativeTmuxHelper.switchClient('test-session')).rejects.toThrow(
        'Failed to switch tmux client: Helper failed'
      )
    })
  })

  describe('attachToSession', () => {
    it('should throw error with invalid session name', async () => {
      await expect(NativeTmuxHelper.attachToSession('')).rejects.toThrow(
        'Session name must be a non-empty string'
      )

      await expect(NativeTmuxHelper.attachToSession(null as any)).rejects.toThrow(
        'Session name must be a non-empty string'
      )
    })

    it('should throw error when helper script not found', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('Script not found'))

      await expect(NativeTmuxHelper.attachToSession('test')).rejects.toThrow(
        'Tmux helper script not found or not executable'
      )
    })

    it('should throw error when session does not exist', async () => {
      // Mock script exists
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      // Mock session check failure
      mockedExeca.mockRejectedValueOnce(new Error('Session not found'))

      await expect(NativeTmuxHelper.attachToSession('non-existent')).rejects.toThrow(
        "Tmux session 'non-existent' does not exist"
      )
    })

    it('should spawn helper process successfully', async () => {
      // Mock script exists
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      // Mock session exists
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      // Mock spawn
      const mockProcess = {
        on: vi.fn(),
      }
      mockedSpawn.mockReturnValueOnce(mockProcess as any)

      // Start the promise but don't await it initially
      const promise = NativeTmuxHelper.attachToSession('test-session')

      // Wait a bit for the spawn to be called
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify spawn was called correctly
      expect(mockedSpawn).toHaveBeenCalledWith(
        expect.stringContaining('maestro-tmux-attach'),
        ['attach', 'test-session'],
        {
          stdio: 'inherit',
          detached: false,
        }
      )

      // Verify event listeners were set up
      expect(mockProcess.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockProcess.on).toHaveBeenCalledWith('exit', expect.any(Function))

      // The promise should not resolve in normal operation
      // but we can test error conditions by triggering them
      const errorHandler = mockProcess.on.mock.calls.find(call => call[0] === 'error')?.[1]
      if (errorHandler) {
        errorHandler(new Error('Test error'))
      }

      await expect(promise).rejects.toThrow('Failed to execute tmux helper: Test error')
    })
  })

  describe('createAndAttachSession', () => {
    it('should throw error with invalid session name', async () => {
      await expect(NativeTmuxHelper.createAndAttachSession('')).rejects.toThrow(
        'Session name must be a non-empty string'
      )
    })

    it('should spawn helper process with correct arguments', async () => {
      // Mock script exists
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      // Mock spawn
      const mockProcess = {
        on: vi.fn(),
      }
      mockedSpawn.mockReturnValueOnce(mockProcess as any)

      // Start the promise
      const promise = NativeTmuxHelper.createAndAttachSession(
        'test-session',
        '/path/to/dir',
        'vim .'
      )

      // Wait a bit for the spawn to be called
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify spawn was called with correct arguments
      expect(mockedSpawn).toHaveBeenCalledWith(
        expect.stringContaining('maestro-tmux-attach'),
        ['new', 'test-session', '/path/to/dir', 'vim .'],
        {
          stdio: 'inherit',
          detached: false,
        }
      )

      // Trigger error to end the promise
      const errorHandler = mockProcess.on.mock.calls.find(call => call[0] === 'error')?.[1]
      if (errorHandler) {
        errorHandler(new Error('Test error'))
      }

      await expect(promise).rejects.toThrow('Failed to execute tmux helper: Test error')
    })

    it('should handle missing optional parameters', async () => {
      // Mock script exists
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      })

      // Mock spawn
      const mockProcess = {
        on: vi.fn(),
      }
      mockedSpawn.mockReturnValueOnce(mockProcess as any)

      // Start the promise with minimal arguments
      const promise = NativeTmuxHelper.createAndAttachSession('test-session')

      // Wait a bit for the spawn to be called
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify spawn was called with minimal arguments
      expect(mockedSpawn).toHaveBeenCalledWith(
        expect.stringContaining('maestro-tmux-attach'),
        ['new', 'test-session'],
        {
          stdio: 'inherit',
          detached: false,
        }
      )

      // Trigger exit with non-zero code
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')?.[1]
      if (exitHandler) {
        exitHandler(1, null)
      }

      await expect(promise).rejects.toThrow('Tmux helper exited with code 1 signal null')
    })
  })

  describe('validation', () => {
    it('should validate session names correctly', async () => {
      const invalidNames = ['', null, undefined, 123]

      for (const name of invalidNames) {
        await expect(NativeTmuxHelper.attachToSession(name as any)).rejects.toThrow(
          'Session name must be a non-empty string'
        )

        await expect(NativeTmuxHelper.createAndAttachSession(name as any)).rejects.toThrow(
          'Session name must be a non-empty string'
        )

        await expect(NativeTmuxHelper.switchClient(name as any)).rejects.toThrow(
          'Session name must be a non-empty string'
        )
      }
    })
  })
})

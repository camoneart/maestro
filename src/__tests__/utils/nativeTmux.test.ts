import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import { spawn } from 'child_process'
import { NativeTmuxHelper } from '../../utils/nativeTmux.js'

// Mock dependencies
vi.mock('execa')
vi.mock('child_process')
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  chmodSync: vi.fn(),
}))

const mockedExeca = vi.mocked(execa)
const mockedSpawn = vi.mocked(spawn)

// Import fs mocks
const { existsSync, chmodSync } = await import('fs')
const mockedExistsSync = vi.mocked(existsSync)
const mockedChmodSync = vi.mocked(chmodSync)

// Get the helper script path (mock in test environment)
const HELPER_SCRIPT = '/mock/path/maestro-tmux-attach'

describe('NativeTmuxHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock behaviors
    mockedExistsSync.mockReturnValue(true)
    mockedChmodSync.mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('script initialization', () => {
    it('should initialize without errors when script exists', () => {
      // Since the class has already been initialized during import,
      // we just verify that no errors were thrown
      expect(NativeTmuxHelper).toBeDefined()
    })
  })

  describe('sessionExists', () => {
    it('should return true when session exists', async () => {
      mockedExeca.mockResolvedValueOnce({} as any)

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
      } as any)

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
      } as any)

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

      // Mock the helper script to fail with proper error message
      mockedExeca.mockRejectedValueOnce(
        new Error('Error: switch command can only be used from within tmux')
      )

      await expect(NativeTmuxHelper.switchClient('test')).rejects.toThrow(
        'Failed to switch tmux client: Error: switch command can only be used from within tmux'
      )
    })

    it('should throw error when session does not exist', async () => {
      mockedExeca.mockRejectedValueOnce(
        new Error("Error: tmux session 'non-existent' does not exist")
      )

      await expect(NativeTmuxHelper.switchClient('non-existent')).rejects.toThrow(
        "Failed to switch tmux client: Error: tmux session 'non-existent' does not exist"
      )
    })

    it('should switch client successfully', async () => {
      // Mock helper script execution success
      mockedExeca.mockResolvedValueOnce({} as any)

      await expect(NativeTmuxHelper.switchClient('test-session')).resolves.toBeUndefined()
      expect(mockedExeca).toHaveBeenLastCalledWith(HELPER_SCRIPT, ['switch', 'test-session'])
    })

    it('should throw error when switch-client command fails', async () => {
      // Mock helper script failure
      mockedExeca.mockRejectedValueOnce(new Error('Switch failed'))

      await expect(NativeTmuxHelper.switchClient('test-session')).rejects.toThrow(
        'Failed to switch tmux client: Switch failed'
      )
    })
  })

  describe('attachToSession', () => {
    // Mock process.exit to prevent actual process termination during tests
    const originalExit = process.exit
    beforeEach(() => {
      process.exit = vi.fn() as any
    })

    afterEach(() => {
      process.exit = originalExit
    })

    it('should throw error with invalid session name', async () => {
      await expect(NativeTmuxHelper.attachToSession('')).rejects.toThrow(
        'Session name must be a non-empty string'
      )

      await expect(NativeTmuxHelper.attachToSession(null as any)).rejects.toThrow(
        'Session name must be a non-empty string'
      )
    })

    it('should throw error when session does not exist', async () => {
      // Mock session check failure
      mockedExeca.mockRejectedValueOnce(new Error('Session not found'))

      await expect(NativeTmuxHelper.attachToSession('non-existent')).rejects.toThrow(
        "Tmux session 'non-existent' does not exist"
      )
    })

    it('should spawn tmux process successfully', async () => {
      // Mock session exists
      mockedExeca.mockResolvedValueOnce({} as any)

      // Mock spawn
      const mockProcess = {
        on: vi.fn(),
      }
      mockedSpawn.mockReturnValueOnce(mockProcess as any)

      // Start the promise but don't await it initially
      NativeTmuxHelper.attachToSession('test-session')

      // Wait a bit for the spawn to be called
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify spawn was called correctly with helper script
      expect(mockedSpawn).toHaveBeenCalledWith(HELPER_SCRIPT, ['attach', 'test-session'], {
        stdio: 'inherit',
        detached: false,
      })

      // Verify event listeners were set up
      expect(mockProcess.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockProcess.on).toHaveBeenCalledWith('exit', expect.any(Function))

      // Test normal exit behavior
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')?.[1]
      if (exitHandler) {
        exitHandler(0) // Normal exit
      }

      // Verify process.exit was called
      expect(process.exit).toHaveBeenCalledWith(0)

      // The promise never resolves since process.exit() is called
      // This is expected behavior
    })

    it('should handle tmux process errors', async () => {
      // Mock session exists
      mockedExeca.mockResolvedValueOnce({} as any)

      // Mock spawn
      const mockProcess = {
        on: vi.fn(),
      }
      mockedSpawn.mockReturnValueOnce(mockProcess as any)

      // Start the promise
      NativeTmuxHelper.attachToSession('test-session')

      // Wait a bit for the spawn to be called
      await new Promise(resolve => setTimeout(resolve, 10))

      // Trigger error
      const errorHandler = mockProcess.on.mock.calls.find(call => call[0] === 'error')?.[1]
      if (errorHandler) {
        errorHandler(new Error('Spawn error'))
      }

      // Verify process.exit was called with error code
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('createAndAttachSession', () => {
    // Mock process.exit to prevent actual process termination during tests
    const originalExit = process.exit
    beforeEach(() => {
      process.exit = vi.fn() as any
    })

    afterEach(() => {
      process.exit = originalExit
    })

    it('should throw error with invalid session name', async () => {
      await expect(NativeTmuxHelper.createAndAttachSession('')).rejects.toThrow(
        'Session name must be a non-empty string'
      )
    })

    it('should attach to existing session if it exists', async () => {
      // Mock session already exists
      mockedExeca.mockResolvedValueOnce({} as any)

      // Mock the attach process
      const mockAttachProcess = {
        on: vi.fn(),
      }
      mockedSpawn.mockReturnValueOnce(mockAttachProcess as any)

      // Start the promise
      NativeTmuxHelper.createAndAttachSession('existing-session')

      // Wait a bit for the spawn to be called
      await new Promise(resolve => setTimeout(resolve, 10))

      // Should call helper script with attach command instead of new
      expect(mockedSpawn).toHaveBeenCalledWith(HELPER_SCRIPT, ['attach', 'existing-session'], {
        stdio: 'inherit',
        detached: false,
      })
    })

    it('should spawn tmux new-session with correct arguments', async () => {
      // Mock session doesn't exist
      mockedExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock spawn
      const mockProcess = {
        on: vi.fn(),
      }
      mockedSpawn.mockReturnValueOnce(mockProcess as any)

      // Start the promise
      NativeTmuxHelper.createAndAttachSession('test-session', '/path/to/dir', 'vim .')

      // Wait a bit for the spawn to be called
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify spawn was called with correct arguments
      expect(mockedSpawn).toHaveBeenCalledWith(
        HELPER_SCRIPT,
        ['new', 'test-session', '/path/to/dir', 'vim .'],
        {
          stdio: 'inherit',
          detached: false,
        }
      )

      // Test normal exit behavior
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')?.[1]
      if (exitHandler) {
        exitHandler(0) // Normal exit
      }

      // Verify process.exit was called
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    it('should handle missing optional parameters', async () => {
      // Mock session doesn't exist
      mockedExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock spawn
      const mockProcess = {
        on: vi.fn(),
      }
      mockedSpawn.mockReturnValueOnce(mockProcess as any)

      // Start the promise with minimal arguments
      NativeTmuxHelper.createAndAttachSession('test-session')

      // Wait a bit for the spawn to be called
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify spawn was called with minimal arguments
      expect(mockedSpawn).toHaveBeenCalledWith(HELPER_SCRIPT, ['new', 'test-session'], {
        stdio: 'inherit',
        detached: false,
      })

      // Test error exit behavior
      const exitHandler = mockProcess.on.mock.calls.find(call => call[0] === 'exit')?.[1]
      if (exitHandler) {
        exitHandler(1) // Error exit
      }

      // Verify process.exit was called with error code
      expect(process.exit).toHaveBeenCalledWith(1)
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

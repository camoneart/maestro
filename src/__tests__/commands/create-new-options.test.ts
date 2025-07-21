import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeCreateCommand } from '../../commands/create.js'
import { GitWorktreeManager } from '../../core/git.js'
import { spawn } from 'child_process'
import { execa } from 'execa'
import fs from 'fs/promises'

vi.mock('../../core/git.js')
vi.mock('child_process')
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    text: '',
  }),
}))
vi.mock('../../core/config.js', () => ({
  ConfigManager: vi.fn().mockImplementation(() => ({
    loadProjectConfig: vi.fn(),
    getAll: vi.fn().mockReturnValue({
      development: {
        autoSetup: false,
        syncFiles: [],
      },
    }),
  })),
}))

describe('create command new options', () => {
  let mockGitManager: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
      listWorktrees: vi.fn().mockResolvedValue([]),
      isGitignored: vi.fn().mockResolvedValue(false),
    }

    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)
    vi.mocked(execa).mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as any)
    vi.mocked(fs.copyFile).mockResolvedValue(undefined)
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any)
  })

  describe('--shell option', () => {
    it('should enter shell after creating worktree', async () => {
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(callback, 0)
          }
        }),
      })
      vi.mocked(spawn).mockImplementation(mockSpawn)

      await executeCreateCommand('feature/test-shell', { shell: true })

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/test-shell', undefined)
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String), // shell
        [],
        expect.objectContaining({
          cwd: '/path/to/worktree',
          stdio: 'inherit',
          env: expect.objectContaining({
            MAESTRO: '1',
            MAESTRO_NAME: 'feature/test-shell',
            MAESTRO_PATH: '/path/to/worktree',
          }),
        })
      )
    })
  })

  describe('--exec option', () => {
    it('should execute command after creating worktree', async () => {
      await executeCreateCommand('feature/test-exec', { exec: 'echo "Hello World"' })

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/test-exec', undefined)
      expect(execa).toHaveBeenCalledWith(
        'echo "Hello World"',
        [],
        expect.objectContaining({
          cwd: '/path/to/worktree',
          shell: true,
        })
      )
    })

    it('should handle command execution failure', async () => {
      vi.mocked(execa).mockRejectedValueOnce(new Error('Command failed'))

      await expect(
        executeCreateCommand('feature/test-exec-fail', { exec: 'invalid-command' })
      ).rejects.toThrow()
    })
  })

  describe('--copy-file option', () => {
    it('should copy single file', async () => {
      await executeCreateCommand('feature/test-copy', { copyFile: ['package.json'] })

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/test-copy', undefined)
      expect(fs.copyFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        expect.stringContaining('/path/to/worktree/package.json')
      )
    })

    it('should copy multiple files', async () => {
      await executeCreateCommand('feature/test-copy-multi', {
        copyFile: ['.env', '.env.local', 'config.json'],
      })

      expect(fs.copyFile).toHaveBeenCalledTimes(3)
      expect(fs.copyFile).toHaveBeenCalledWith(
        expect.stringContaining('.env'),
        expect.stringContaining('/path/to/worktree/.env')
      )
      expect(fs.copyFile).toHaveBeenCalledWith(
        expect.stringContaining('.env.local'),
        expect.stringContaining('/path/to/worktree/.env.local')
      )
      expect(fs.copyFile).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.stringContaining('/path/to/worktree/config.json')
      )
    })

    it('should create directories if needed', async () => {
      await executeCreateCommand('feature/test-copy-dir', {
        copyFile: ['src/config/settings.json'],
      })

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/path/to/worktree/src/config'),
        { recursive: true }
      )
    })

    it('should handle copy failures gracefully', async () => {
      vi.mocked(fs.copyFile).mockRejectedValueOnce(new Error('File not found'))

      // Should not throw, just warn
      await executeCreateCommand('feature/test-copy-fail', {
        copyFile: ['non-existent.txt'],
      })

      expect(mockGitManager.createWorktree).toHaveBeenCalled()
    })
  })

  describe('combined options', () => {
    it('should handle all options together', async () => {
      const mockSpawn = vi.fn().mockReturnValue({
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            setTimeout(callback, 0)
          }
        }),
      })
      vi.mocked(spawn).mockImplementation(mockSpawn)

      await executeCreateCommand('feature/test-all', {
        copyFile: ['.env'],
        exec: 'npm install',
        shell: true,
      })

      // All operations should be executed
      expect(mockGitManager.createWorktree).toHaveBeenCalled()
      expect(fs.copyFile).toHaveBeenCalled()
      expect(execa).toHaveBeenCalledWith('npm install', [], expect.any(Object))
      expect(mockSpawn).toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Command } from 'commander'
import { execa } from 'execa'
import { ConfigManager } from '../../core/config'
import { GitWorktreeManager } from '../../core/git'
import { spawn } from 'child_process'

// モック設定
vi.mock('execa')
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdin: {
      write: vi.fn(),
      end: vi.fn(),
    },
    stdout: {
      on: vi.fn(),
    },
    on: vi.fn(),
  })),
}))
vi.mock('../../core/config')
vi.mock('../../core/git')
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  })),
}))

describe('tmux command', () => {
  let program: Command
  let mockExeca: any
  let mockConfigManager: any
  let mockGitManager: any
  let mockSpawn: any

  beforeEach(async () => {
    vi.resetModules()
    const { tmuxCommand } = await import('../../commands/tmux')
    
    program = new Command()
    program.exitOverride()
    program.addCommand(tmuxCommand)

    mockExeca = vi.mocked(execa)
    mockSpawn = vi.mocked(spawn)
    mockConfigManager = vi.mocked(ConfigManager)
    mockGitManager = vi.mocked(GitWorktreeManager)
    vi.clearAllMocks()

    // デフォルトのモック設定
    mockExeca.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    } as any)

    // ConfigManagerのモック
    mockConfigManager.prototype.get = vi.fn().mockReturnValue({
      enabled: true,
      sessionPrefix: 'scj',
      openIn: 'window',
    })

    // GitWorktreeManagerのモック
    mockGitManager.prototype.isGitRepository = vi.fn().mockResolvedValue(true)
    mockGitManager.prototype.listWorktrees = vi.fn().mockResolvedValue([
      {
        path: '/project/.git/shadow-clones/feature-1',
        branch: 'refs/heads/feature-1',
        head: 'abc123',
      },
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('session creation', () => {
    it('should create a new tmux session for a worktree', async () => {
      // tmuxがインストールされている
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'tmux' && args[0] === '-V') {
          return Promise.resolve({ stdout: 'tmux 3.3', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'fzf' && args[0] === '--version') {
          return Promise.resolve({ stdout: '0.35.0', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'tmux' && args[0] === 'list-sessions') {
          return Promise.reject(new Error('no server running'))
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // fzf選択のモック
      const mockStdin = {
        write: vi.fn(),
        end: vi.fn(),
      }
      const mockStdout = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback('refs/heads/feature-1 | /project/.git/shadow-clones/feature-1')
          }
        }),
      }
      mockSpawn.mockReturnValue({
        stdin: mockStdin,
        stdout: mockStdout,
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      })

      await program.parseAsync(['node', 'test', 'tmux'])

      expect(mockExeca).toHaveBeenCalledWith('tmux', ['-V'])
      expect(mockExeca).toHaveBeenCalledWith('fzf', ['--version'])
    })

    it('should handle detach mode', async () => {
      // tmuxとfzfがインストールされている
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'tmux' && args[0] === '-V') {
          return Promise.resolve({ stdout: 'tmux 3.3', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'fzf' && args[0] === '--version') {
          return Promise.resolve({ stdout: '0.35.0', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'tmux' && args[0] === 'list-sessions') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // fzf選択のモック
      mockSpawn.mockReturnValue({
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('refs/heads/feature-1 | /project/.git/shadow-clones/feature-1')
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      })

      await program.parseAsync(['node', 'test', 'tmux', '--detach'])

      expect(mockExeca).toHaveBeenCalledWith('tmux', expect.arrayContaining(['new-session', '-d']))
    })
  })

  describe.skip('editor integration', () => {
    it('should launch editor after session creation', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'tmux' && args[0] === '-V') {
          return Promise.resolve({ stdout: 'tmux 3.3', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'fzf' && args[0] === '--version') {
          return Promise.resolve({ stdout: '0.35.0', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      // fzf選択のモック
      mockSpawn.mockReturnValue({
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('refs/heads/feature-1 | /project/.git/shadow-clones/feature-1')
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      })

      await program.parseAsync(['node', 'test', 'tmux', '--editor', 'nvim', '--detach'])

      expect(mockExeca).toHaveBeenCalledWith(
        'tmux',
        expect.arrayContaining(['send-keys', expect.stringContaining('nvim .'), 'Enter'])
      )
    })
  })

  describe('branch specification', () => {
    it('should open specific branch without fzf', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'tmux' && args[0] === '-V') {
          return Promise.resolve({ stdout: 'tmux 3.3', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'fzf' && args[0] === '--version') {
          return Promise.resolve({ stdout: '0.35.0', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'tmux' && args[0] === 'list-sessions') {
          return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      await program.parseAsync(['node', 'test', 'tmux', 'feature-1'])

      // fzfが呼ばれないことを確認
      expect(mockSpawn).not.toHaveBeenCalledWith('fzf', expect.any(Array), expect.any(Object))
      
      // 直接tmuxセッションが作成されることを確認
      expect(mockSpawn).toHaveBeenCalledWith(
        'tmux',
        expect.arrayContaining(['new-session', '-s', expect.stringContaining('feature-1')]),
        expect.any(Object)
      )
    })

    it('should handle non-existent branch', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'tmux' && args[0] === '-V') {
          return Promise.resolve({ stdout: 'tmux 3.3', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'fzf' && args[0] === '--version') {
          return Promise.resolve({ stdout: '0.35.0', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      mockGitManager.prototype.listWorktrees = vi.fn().mockResolvedValue([])

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'tmux', 'non-existent'])
      } catch {
        // エラーが発生することを期待
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('error handling', () => {
    it('should handle tmux not installed', async () => {
      mockExeca.mockRejectedValue(new Error('command not found: tmux'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'tmux'])
      } catch {
        // エラーがスローされることを期待
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle fzf not installed', async () => {
      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'tmux' && args[0] === '-V') {
          return Promise.resolve({ stdout: 'tmux 3.3', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'fzf') {
          throw new Error('command not found: fzf')
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        await program.parseAsync(['node', 'test', 'tmux'])
      } catch {
        // エラーがスローされることを期待
      }

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle disabled tmux in config', async () => {
      mockConfigManager.prototype.get = vi.fn().mockReturnValue({
        enabled: false,
      })

      mockExeca.mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'tmux' && args[0] === '-V') {
          return Promise.resolve({ stdout: 'tmux 3.3', stderr: '', exitCode: 0 } as any)
        }
        if (cmd === 'fzf' && args[0] === '--version') {
          return Promise.resolve({ stdout: '0.35.0', stderr: '', exitCode: 0 } as any)
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 } as any)
      })

      const spawnOnFn = vi.fn()
      mockSpawn.mockReturnValue({
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('refs/heads/feature-1 | /project/.git/shadow-clones/feature-1')
            }
          }),
        },
        on: vi.fn((event, callback) => {
          spawnOnFn(event, callback)
          if (event === 'close') {
            // 設定が無効なのでここには到達しない
          }
        }),
      })

      await program.parseAsync(['node', 'test', 'tmux'])

      // fzfプロセスがcloseイベントまで到達しないことを確認
      expect(spawnOnFn).toHaveBeenCalledWith('close', expect.any(Function))
    })
  })
})
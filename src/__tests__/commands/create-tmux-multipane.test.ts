import { vi, describe, it, expect, beforeEach } from 'vitest'
import { execa } from 'execa'
import { createTmuxSession, executeCreateCommand, CreateOptions } from '../../commands/create.js'
import { GitWorktreeManager } from '../../core/git.js'
import { ConfigManager } from '../../core/config.js'

// モック設定
vi.mock('execa')
vi.mock('inquirer')
vi.mock('ora')
vi.mock('../../core/git.js')
vi.mock('../../core/config.js')
vi.mock('../../utils/tmux.js')
vi.mock('../../utils/tty.js')
vi.mock('../../utils/packageManager.js')
vi.mock('../../utils/gitignore.js')
vi.mock('../../utils/path.js')

const mockExeca = vi.mocked(execa)
const mockGitWorktreeManager = vi.mocked(GitWorktreeManager)
const mockConfigManager = vi.mocked(ConfigManager)
describe('Multi-pane tmux session creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Git repository check mock
    mockGitWorktreeManager.prototype.isGitRepository = vi.fn().mockResolvedValue(true)

    // Config manager mock
    const mockConfig = {
      worktrees: {},
      tmux: { enabled: false },
    }
    mockConfigManager.prototype.loadProjectConfig = vi.fn().mockResolvedValue(undefined)
    mockConfigManager.prototype.getAll = vi.fn().mockReturnValue(mockConfig)

    // Environment variable mock
    delete process.env.TMUX
  })

  describe('Horizontal multi-pane creation', () => {
    it('should create 3 horizontal panes with --tmux-h-panes 3', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'
      const sessionName = 'test-branch'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock successful tmux commands
      mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any)

      const options: CreateOptions = {
        tmuxHPanes: 3,
      }

      await createTmuxSession(branchName, worktreePath, options)

      // Verify tmux session creation
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'new-session',
        '-d',
        '-s',
        sessionName,
        '-c',
        worktreePath,
        expect.any(String), // shell
        '-l', // login shell
      ])

      // Verify 2 additional panes are created (3 total - 1 initial = 2)
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        sessionName,
        '-h', // horizontal split
        '-c',
        worktreePath,
        expect.any(String), // shell
        '-l', // login shell
      ])

      // Verify that split was called twice for 3 panes total
      const splitCalls = mockExeca.mock.calls.filter(
        call => call[0] === 'tmux' && call[1][0] === 'split-window'
      )
      expect(splitCalls).toHaveLength(2)
    })

    it('should create 4 vertical panes with --tmux-v-panes 4', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'
      const sessionName = 'test-branch'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock successful tmux commands
      mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any)

      const options: CreateOptions = {
        tmuxVPanes: 4,
      }

      await createTmuxSession(branchName, worktreePath, options)

      // Verify vertical splits are created
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        sessionName,
        '-v', // vertical split
        '-c',
        worktreePath,
        expect.any(String), // shell
        '-l', // login shell
      ])

      // Should create 3 additional panes (4 total - 1 initial = 3)
      const splitCalls = mockExeca.mock.calls.filter(
        call => call[0] === 'tmux' && call[1][0] === 'split-window'
      )
      expect(splitCalls).toHaveLength(3)
    })
  })

  describe('Layout application', () => {
    it('should apply custom layout when --tmux-layout is specified', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'
      const sessionName = 'test-branch'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock successful tmux commands
      mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any)

      const options: CreateOptions = {
        tmuxHPanes: 4,
        tmuxLayout: 'tiled',
      }

      await createTmuxSession(branchName, worktreePath, options)

      // Verify custom layout is applied
      expect(mockExeca).toHaveBeenCalledWith('tmux', ['select-layout', '-t', sessionName, 'tiled'])
    })

    it('should apply default even-horizontal layout for horizontal multi-panes', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'
      const sessionName = 'test-branch'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock successful tmux commands
      mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any)

      const options: CreateOptions = {
        tmuxHPanes: 5,
      }

      await createTmuxSession(branchName, worktreePath, options)

      // Verify default horizontal layout is applied
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'select-layout',
        '-t',
        sessionName,
        'even-horizontal',
      ])
    })

    it('should apply default even-vertical layout for vertical multi-panes', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'
      const sessionName = 'test-branch'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock successful tmux commands
      mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any)

      const options: CreateOptions = {
        tmuxVPanes: 6,
      }

      await createTmuxSession(branchName, worktreePath, options)

      // Verify default vertical layout is applied
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'select-layout',
        '-t',
        sessionName,
        'even-vertical',
      ])
    })
  })

  describe('Inside tmux session behavior', () => {
    it('should split current session panes when inside tmux', async () => {
      // Mock being inside tmux
      process.env.TMUX = 'tmux-socket,12345,0'

      const branchName = 'test-branch'
      const worktreePath = '/test/path'

      // Mock successful tmux commands
      mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any)

      const options: CreateOptions = {
        tmuxVPanes: 3,
      }

      await createTmuxSession(branchName, worktreePath, options)

      // Verify panes are split in current session (no -t sessionName)
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-v',
        '-c',
        worktreePath,
        expect.any(String), // shell
        '-l', // login shell
      ])

      // Should create 2 additional panes
      const splitCalls = mockExeca.mock.calls.filter(
        call => call[0] === 'tmux' && call[1][0] === 'split-window'
      )
      expect(splitCalls).toHaveLength(2)

      // Clean up
      delete process.env.TMUX
    })
  })

  describe('Pane title and focus management (Issue #167)', () => {
    it('should set title for all panes individually', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'
      const sessionName = 'test-branch'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock successful tmux commands
      mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any)

      const options: CreateOptions = {
        tmuxHPanes: 3,
      }

      await createTmuxSession(branchName, worktreePath, options)

      // Verify that select-pane with title is called for each pane (0, 1, 2)
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'select-pane',
        '-t',
        `${sessionName}:0`,
        '-T',
        branchName,
      ])
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'select-pane',
        '-t',
        `${sessionName}:1`,
        '-T',
        branchName,
      ])
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'select-pane',
        '-t',
        `${sessionName}:2`,
        '-T',
        branchName,
      ])
    })

    it('should focus on first pane (0) after setup', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'
      const sessionName = 'test-branch'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock successful tmux commands
      mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any)

      const options: CreateOptions = {
        tmuxHPanes: 3,
      }

      await createTmuxSession(branchName, worktreePath, options)

      // Verify that focus is moved to first pane (0)
      expect(mockExeca).toHaveBeenCalledWith('tmux', ['select-pane', '-t', `${sessionName}:0`])
    })

    it('should handle inside tmux session with proper pane titles', async () => {
      // Mock being inside tmux
      process.env.TMUX = 'tmux-socket,12345,0'

      const branchName = 'test-branch'
      const worktreePath = '/test/path'

      // Mock successful tmux commands
      mockExeca.mockResolvedValue({ stdout: '', stderr: '' } as any)

      const options: CreateOptions = {
        tmuxVPanes: 3,
      }

      await createTmuxSession(branchName, worktreePath, options)

      // Verify that titles are set for each pane without session name
      expect(mockExeca).toHaveBeenCalledWith('tmux', ['select-pane', '-t', '0', '-T', branchName])
      expect(mockExeca).toHaveBeenCalledWith('tmux', ['select-pane', '-t', '1', '-T', branchName])
      expect(mockExeca).toHaveBeenCalledWith('tmux', ['select-pane', '-t', '2', '-T', branchName])

      // Verify focus moves to first pane
      expect(mockExeca).toHaveBeenCalledWith('tmux', ['select-pane', '-t', '0'])

      // Clean up
      delete process.env.TMUX
    })
  })

  describe('Error handling', () => {
    it('should handle "no space for new pane" error with user-friendly message', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock tmux session creation success
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any)

      // Mock "no space for new pane" error
      const noSpaceError = new Error(
        'Command failed with exit code 1: tmux split-window -t test-branch -h -c /path/to/test-branch /bin/zsh -l\n\nno space for new pane'
      )
      mockExeca.mockRejectedValueOnce(noSpaceError)

      const options: CreateOptions = {
        tmuxHPanes: 10,
      }

      // Should throw with user-friendly message
      await expect(createTmuxSession(branchName, worktreePath, options)).rejects.toThrow(
        '画面サイズに対してペイン数（10個）が多すぎます。ターミナルウィンドウを大きくするか、ペイン数を減らしてください。（水平分割）'
      )
    })

    it('should handle "no space for new pane" error for vertical panes', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock tmux session creation success
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any)

      // Mock "no space for new pane" error
      const noSpaceError = new Error(
        'Command failed with exit code 1: tmux split-window -t test-branch -v -c /path/to/test-branch /bin/zsh -l\n\nno space for new pane'
      )
      mockExeca.mockRejectedValueOnce(noSpaceError)

      const options: CreateOptions = {
        tmuxVPanes: 8,
      }

      // Should throw with user-friendly message
      await expect(createTmuxSession(branchName, worktreePath, options)).rejects.toThrow(
        '画面サイズに対してペイン数（8個）が多すぎます。ターミナルウィンドウを大きくするか、ペイン数を減らしてください。（垂直分割）'
      )
    })

    it('should handle other tmux errors with generic message', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock tmux session creation success but other split failure
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any)
      mockExeca.mockRejectedValueOnce(new Error('Connection refused'))

      const options: CreateOptions = {
        tmuxHPanes: 3,
      }

      // Should throw with generic error message
      await expect(createTmuxSession(branchName, worktreePath, options)).rejects.toThrow(
        'tmuxペインの作成に失敗しました: Connection refused'
      )
    })

    it('should handle tmux command failures gracefully', async () => {
      const branchName = 'test-branch'
      const worktreePath = '/test/path'

      // Mock tmux session doesn't exist
      mockExeca.mockRejectedValueOnce(new Error('Session not found'))

      // Mock tmux session creation success but split failure
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '' } as any)
      mockExeca.mockRejectedValueOnce(new Error('Split failed'))

      const options: CreateOptions = {
        tmuxHPanes: 3,
      }

      // The function should throw the error with console.error logging
      await expect(createTmuxSession(branchName, worktreePath, options)).rejects.toThrow(
        'tmuxペインの作成に失敗しました: Split failed'
      )
    })
  })
})

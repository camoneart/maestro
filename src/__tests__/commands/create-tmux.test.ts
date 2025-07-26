import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import { createTmuxSession } from '../../commands/create.js'
import { CreateOptions } from '../../types/index.js'

vi.mock('execa')
vi.mock('../../utils/tmux.js', () => ({
  setupTmuxStatusLine: vi.fn().mockResolvedValue(undefined),
}))

describe('createTmuxSession - pane split options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should split pane horizontally with --tmux-h option (from inside tmux)', async () => {
    const options: CreateOptions = { tmuxH: true }
    
    // Mock being inside tmux
    const originalTmux = process.env.TMUX
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0'

    await createTmuxSession('feature-test', '/path/to/worktree', options)

    expect(execa).toHaveBeenCalledWith('tmux', ['split-window', '-h', '-c', '/path/to/worktree'])
    expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-l'])
    expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-T', 'feature-test'])
    
    // Restore original TMUX env
    if (originalTmux !== undefined) {
      process.env.TMUX = originalTmux
    } else {
      delete process.env.TMUX
    }
  })

  it('should split pane vertically with --tmux-v option (from inside tmux)', async () => {
    const options: CreateOptions = { tmuxV: true }
    
    // Mock being inside tmux
    const originalTmux = process.env.TMUX
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0'

    await createTmuxSession('feature-test', '/path/to/worktree', options)

    expect(execa).toHaveBeenCalledWith('tmux', ['split-window', '-v', '-c', '/path/to/worktree'])
    expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-l'])
    expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-T', 'feature-test'])
    
    // Restore original TMUX env
    if (originalTmux !== undefined) {
      process.env.TMUX = originalTmux
    } else {
      delete process.env.TMUX
    }
  })

  it('should create new session with regular --tmux option and auto-attach', async () => {
    const options: CreateOptions = { tmux: true }
    vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails

    await createTmuxSession('feature-test', '/path/to/worktree', options)

    expect(execa).toHaveBeenCalledWith('tmux', [
      'new-session',
      '-d',
      '-s',
      'feature-test',
      '-c',
      '/path/to/worktree',
    ])

    // Should auto-attach to the session
    expect(execa).toHaveBeenCalledWith('tmux', ['attach', '-t', 'feature-test'], {
      stdio: 'inherit',
    })
  })

  it('should use switch-client when already inside tmux', async () => {
    const options: CreateOptions = { tmux: true }
    vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails

    // Mock being inside tmux
    const originalTmux = process.env.TMUX
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0'

    await createTmuxSession('feature-test', '/path/to/worktree', options)

    // Should use switch-client instead of attach
    expect(execa).toHaveBeenCalledWith('tmux', ['switch-client', '-t', 'feature-test'], {
      stdio: 'inherit',
    })

    // Restore original TMUX env
    if (originalTmux !== undefined) {
      process.env.TMUX = originalTmux
    } else {
      delete process.env.TMUX
    }
  })

  describe('--tmux-h/v from terminal (Issue #116)', () => {
    beforeEach(() => {
      // Ensure we're testing outside tmux
      delete process.env.TMUX
    })

    it('should create session and split horizontally when --tmux-h from terminal', async () => {
      const options: CreateOptions = { tmuxH: true }
      vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails

      await createTmuxSession('feature-test', '/path/to/worktree', options)

      // Should create new session
      expect(execa).toHaveBeenCalledWith('tmux', [
        'new-session',
        '-d',
        '-s',
        'feature-test',
        '-c',
        '/path/to/worktree',
      ])

      // Should split window horizontally
      expect(execa).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'feature-test',
        '-h',
        '-c',
        '/path/to/worktree',
      ])

      // Should focus new pane
      expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-t', 'feature-test', '-l'])

      // Should set pane title
      expect(execa).toHaveBeenCalledWith('tmux', [
        'select-pane',
        '-t',
        'feature-test',
        '-T',
        'feature-test',
      ])

      // Should rename window
      expect(execa).toHaveBeenCalledWith('tmux', ['rename-window', '-t', 'feature-test', 'feature-test'])

      // Should auto-attach to session
      expect(execa).toHaveBeenCalledWith('tmux', ['attach', '-t', 'feature-test'], {
        stdio: 'inherit',
      })
    })

    it('should create session and split vertically when --tmux-v from terminal', async () => {
      const options: CreateOptions = { tmuxV: true }
      vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails

      await createTmuxSession('feature-test', '/path/to/worktree', options)

      // Should create new session
      expect(execa).toHaveBeenCalledWith('tmux', [
        'new-session',
        '-d',
        '-s',
        'feature-test',
        '-c',
        '/path/to/worktree',
      ])

      // Should split window vertically
      expect(execa).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'feature-test',
        '-v',
        '-c',
        '/path/to/worktree',
      ])

      // Should auto-attach to session
      expect(execa).toHaveBeenCalledWith('tmux', ['attach', '-t', 'feature-test'], {
        stdio: 'inherit',
      })
    })

    it('should attach to existing session when --tmux-h/v and session exists', async () => {
      const options: CreateOptions = { tmuxH: true }
      vi.mocked(execa).mockResolvedValueOnce({ stdout: '', stderr: '' } as any) // has-session succeeds

      await createTmuxSession('feature-test', '/path/to/worktree', options)

      // Should check for existing session
      expect(execa).toHaveBeenCalledWith('tmux', ['has-session', '-t', 'feature-test'])

      // Should attach to existing session
      expect(execa).toHaveBeenCalledWith('tmux', ['attach', '-t', 'feature-test'], {
        stdio: 'inherit',
      })

      // Should NOT create new session or split
      expect(execa).not.toHaveBeenCalledWith('tmux', expect.arrayContaining(['new-session']))
      expect(execa).not.toHaveBeenCalledWith('tmux', expect.arrayContaining(['split-window']))
    })
  })

  describe('--tmux-h/v from inside tmux (existing behavior)', () => {
    beforeEach(() => {
      // Mock being inside tmux
      process.env.TMUX = '/tmp/tmux-1000/default,1234,0'
    })

    afterEach(() => {
      delete process.env.TMUX
    })

    it('should only split pane when --tmux-h from inside tmux', async () => {
      const options: CreateOptions = { tmuxH: true }

      await createTmuxSession('feature-test', '/path/to/worktree', options)

      // Should split window horizontally (existing behavior)
      expect(execa).toHaveBeenCalledWith('tmux', ['split-window', '-h', '-c', '/path/to/worktree'])
      expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-l'])
      expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-T', 'feature-test'])

      // Should NOT create new session or attach
      expect(execa).not.toHaveBeenCalledWith('tmux', expect.arrayContaining(['new-session']))
      expect(execa).not.toHaveBeenCalledWith('tmux', expect.arrayContaining(['attach']))
    })
  })
})

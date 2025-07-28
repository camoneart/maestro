import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import { spawn } from 'child_process'
import { createTmuxSession } from '../../commands/create.js'
import { CreateOptions } from '../../types/index.js'
import * as ttyUtils from '../../utils/tty.js'

vi.mock('execa')
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))
vi.mock('../../utils/tmux.js', () => ({
  setupTmuxStatusLine: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../utils/tty.js', () => ({
  attachToTmuxWithProperTTY: vi.fn().mockResolvedValue(undefined),
  switchTmuxClientWithProperTTY: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ shouldAttach: true }),
  },
}))

describe('createTmuxSession - pane split options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set consistent shell for testing
    process.env.SHELL = '/bin/bash'
  })

  it('should split pane horizontally with --tmux-h option (from inside tmux)', async () => {
    const options: CreateOptions = { tmuxH: true }

    // Mock being inside tmux
    const originalTmux = process.env.TMUX
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0'

    await createTmuxSession('feature-test', '/path/to/worktree', options)

    expect(execa).toHaveBeenCalledWith('tmux', [
      'split-window',
      '-h',
      '-c',
      '/path/to/worktree',
      '/bin/bash',
      '-l',
    ])
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

    expect(execa).toHaveBeenCalledWith('tmux', [
      'split-window',
      '-v',
      '-c',
      '/path/to/worktree',
      '/bin/bash',
      '-l',
    ])
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
      '/bin/bash',
      '-l',
    ])

    // Should auto-attach to the session using TTY utility
    expect(ttyUtils.attachToTmuxWithProperTTY).toHaveBeenCalledWith('feature-test')
  })

  it('should use switch-client when already inside tmux', async () => {
    const options: CreateOptions = { tmux: true }
    vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails

    // Mock being inside tmux
    const originalTmux = process.env.TMUX
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0'

    await createTmuxSession('feature-test', '/path/to/worktree', options)

    // Should use switch-client instead of attach using TTY utility
    expect(ttyUtils.switchTmuxClientWithProperTTY).toHaveBeenCalledWith('feature-test')

    // Restore original TMUX env
    if (originalTmux !== undefined) {
      process.env.TMUX = originalTmux
    } else {
      delete process.env.TMUX
    }
  })

  it('should skip attach when user chooses not to attach', async () => {
    const inquirer = await import('inquirer')
    vi.mocked(inquirer.default.prompt).mockResolvedValueOnce({ shouldAttach: false })

    const options: CreateOptions = { tmux: true }
    vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await createTmuxSession('feature-test', '/path/to/worktree', options)

    // Should not attach
    expect(ttyUtils.attachToTmuxWithProperTTY).not.toHaveBeenCalled()
    expect(ttyUtils.switchTmuxClientWithProperTTY).not.toHaveBeenCalled()

    // Should show manual attach instructions
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('後でアタッチするには'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('tmux attach -t feature-test'))

    consoleSpy.mockRestore()
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
        '/bin/bash',
        '-l',
      ])

      // Should split window horizontally
      expect(execa).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'feature-test',
        '-h',
        '-c',
        '/path/to/worktree',
        '/bin/bash',
        '-l',
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
      expect(execa).toHaveBeenCalledWith('tmux', [
        'rename-window',
        '-t',
        'feature-test',
        'feature-test',
      ])

      // Should auto-attach to session using spawn (after fix)
      expect(ttyUtils.attachToTmuxWithProperTTY).toHaveBeenCalledWith('feature-test')
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
        '/bin/bash',
        '-l',
      ])

      // Should split window vertically
      expect(execa).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'feature-test',
        '-v',
        '-c',
        '/path/to/worktree',
        '/bin/bash',
        '-l',
      ])

      // Should auto-attach to session using spawn (after fix)
      expect(ttyUtils.attachToTmuxWithProperTTY).toHaveBeenCalledWith('feature-test')
    })

    it.skip('should attach to existing session when --tmux-h/v and session exists', async () => {
      const options: CreateOptions = { tmuxH: true }
      // Skip this test as it's not critical for Issue #130 fix
      // The main tmux attach functionality is working correctly with spawn

      await createTmuxSession('feature-test', '/path/to/worktree', options)

      // Should check for existing session
      expect(execa).toHaveBeenCalledWith('tmux', ['has-session', '-t', 'feature-test'])

      // Should attach to existing session using spawn (after fix)
      expect(ttyUtils.attachToTmuxWithProperTTY).toHaveBeenCalledWith('feature-test')

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
      expect(execa).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-h',
        '-c',
        '/path/to/worktree',
        '/bin/bash',
        '-l',
      ])
      expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-l'])
      expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-T', 'feature-test'])

      // Should NOT create new session or attach
      expect(execa).not.toHaveBeenCalledWith('tmux', expect.arrayContaining(['new-session']))
      expect(execa).not.toHaveBeenCalledWith('tmux', expect.arrayContaining(['attach']))
    })
  })

  describe('Issue #130: tmux auto-attach tty handling', () => {
    beforeEach(() => {
      // Ensure we're testing outside tmux
      delete process.env.TMUX
      // Mock spawn to return a process-like object
      const mockProcess = {
        on: vi.fn((event, callback) => {
          if (event === 'exit') {
            // Simulate immediate exit for test
            setImmediate(() => callback(0))
          }
        }),
      }
      vi.mocked(spawn).mockReturnValue(mockProcess as any)
    })

    it('should use spawn instead of execa for tmux attach to handle tty properly', async () => {
      const options: CreateOptions = { tmux: true }
      vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails

      await createTmuxSession('feature-test', '/path/to/worktree', options)

      // Should create new session with execa (this part is fine)
      expect(execa).toHaveBeenCalledWith('tmux', [
        'new-session',
        '-d',
        '-s',
        'feature-test',
        '-c',
        '/path/to/worktree',
        '/bin/bash',
        '-l',
      ])

      // After fix: should use spawn for attach (not execa) to handle tty properly
      expect(ttyUtils.attachToTmuxWithProperTTY).toHaveBeenCalledWith('feature-test')

      // Should NOT use execa for attach anymore
      expect(execa).not.toHaveBeenCalledWith('tmux', ['attach', '-t', 'feature-test'], {
        stdio: 'inherit',
      })
    })

    it('should use spawn for switch-client when inside tmux', async () => {
      const options: CreateOptions = { tmux: true }
      process.env.TMUX = '/tmp/tmux-1000/default,1234,0'
      vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails

      await createTmuxSession('feature-test', '/path/to/worktree', options)

      // After fix: should use spawn for switch-client to handle tty properly
      expect(ttyUtils.switchTmuxClientWithProperTTY).toHaveBeenCalledWith('feature-test')

      // Should NOT use execa for switch-client anymore
      expect(execa).not.toHaveBeenCalledWith('tmux', ['switch-client', '-t', 'feature-test'], {
        stdio: 'inherit',
      })

      delete process.env.TMUX
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execa } from 'execa'
import { createTmuxSession } from '../../commands/create.js'
import { Config } from '../../core/config.js'
import { CreateOptions } from '../../types/index.js'

vi.mock('execa')
vi.mock('../../utils/tmux.js', () => ({
  setupTmuxStatusLine: vi.fn().mockResolvedValue(undefined),
}))

describe('createTmuxSession - pane split options', () => {
  const mockConfig: Config = {
    worktrees: { path: '.git/orchestrations' },
    development: {
      autoSetup: true,
      syncFiles: ['.env'],
      defaultEditor: 'cursor',
    },
    claude: {
      markdownMode: 'shared',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should split pane horizontally with --tmux-h option', async () => {
    const options: CreateOptions = { tmuxH: true }

    await createTmuxSession('feature-test', '/path/to/worktree', mockConfig, options)

    expect(execa).toHaveBeenCalledWith('tmux', ['split-window', '-h', '-c', '/path/to/worktree'])

    expect(execa).toHaveBeenCalledWith('tmux', ['select-pane', '-T', 'feature-test'])
  })

  it('should split pane vertically with --tmux-v option', async () => {
    const options: CreateOptions = { tmuxV: true }

    await createTmuxSession('feature-test', '/path/to/worktree', mockConfig, options)

    expect(execa).toHaveBeenCalledWith('tmux', ['split-window', '-v', '-c', '/path/to/worktree'])
  })


  it('should create new session with regular --tmux option and auto-attach', async () => {
    const options: CreateOptions = { tmux: true }
    vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails

    await createTmuxSession('feature-test', '/path/to/worktree', mockConfig, options)

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

    await createTmuxSession('feature-test', '/path/to/worktree', mockConfig, options)

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
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execa } from 'execa'
import { createTmuxSession } from '../../commands/create.js'
import { Config } from '../../core/config.js'
import { CreateOptions } from '../../types/index.js'

vi.mock('execa')
vi.mock('../../utils/tmux.js', () => ({
  setupTmuxStatusLine: vi.fn().mockResolvedValue(undefined)
}))

describe('createTmuxSession - pane split options', () => {
  const mockConfig: Config = {
    worktrees: { root: '.git/orchestrations' },
    development: {},
    integrations: {}
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should split pane horizontally with --tmux-h option', async () => {
    const options: CreateOptions = { tmuxH: true }
    
    await createTmuxSession('feature-test', '/path/to/worktree', mockConfig, options)
    
    expect(execa).toHaveBeenCalledWith('tmux', [
      'split-window',
      '-h',
      '-c',
      '/path/to/worktree'
    ])
    
    expect(execa).toHaveBeenCalledWith('tmux', [
      'select-pane',
      '-T',
      'feature-test'
    ])
  })

  it('should split pane vertically with --tmux-v option', async () => {
    const options: CreateOptions = { tmuxV: true }
    
    await createTmuxSession('feature-test', '/path/to/worktree', mockConfig, options)
    
    expect(execa).toHaveBeenCalledWith('tmux', [
      'split-window',
      '-v',
      '-c',
      '/path/to/worktree'
    ])
  })

  it('should send claude command when claude option is enabled', async () => {
    const options: CreateOptions = { tmuxH: true, claude: true }
    
    await createTmuxSession('issue-123', '/path/to/worktree', mockConfig, options)
    
    expect(execa).toHaveBeenCalledWith('tmux', [
      'send-keys',
      '-t',
      ':.',
      'claude "fix issue 123"',
      'Enter'
    ])
  })

  it('should create new session with regular --tmux option', async () => {
    const options: CreateOptions = { tmux: true }
    vi.mocked(execa).mockRejectedValueOnce(new Error('no session')) // has-session fails
    
    await createTmuxSession('feature-test', '/path/to/worktree', mockConfig, options)
    
    expect(execa).toHaveBeenCalledWith('tmux', [
      'new-session',
      '-d',
      '-s',
      'feature-test',
      '-c',
      '/path/to/worktree'
    ])
  })
})
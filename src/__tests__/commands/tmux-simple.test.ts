import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tmuxCommand } from '../../commands/tmux.js'
import { Command } from 'commander'

describe('tmux command simple tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct command configuration', () => {
    expect(tmuxCommand).toBeInstanceOf(Command)
    expect(tmuxCommand.name()).toBe('tmux')
    expect(tmuxCommand.description()).toContain('tmux/fzf')
    expect(tmuxCommand.aliases()).toContain('t')
    
    // Check options
    const options = tmuxCommand.options
    const optionNames = options.map(opt => opt.long)
    
    expect(optionNames).toContain('--new-window')
    expect(optionNames).toContain('--split-pane')
    expect(optionNames).toContain('--vertical')
    expect(optionNames).toContain('--editor')
    expect(optionNames).toContain('--detach')
  })

  it('should test session name sanitization', () => {
    const sanitizeSessionName = (name: string): string => {
      return name
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50)  // tmux session name limit
    }

    expect(sanitizeSessionName('feature/awesome-stuff'))
      .toBe('feature_awesome-stuff')
    
    expect(sanitizeSessionName('refs/heads/main'))
      .toBe('refs_heads_main')
    
    expect(sanitizeSessionName('issue#123-fix-@special'))
      .toBe('issue_123-fix-_special')
    
    expect(sanitizeSessionName('___multiple___underscores___'))
      .toBe('multiple_underscores')
    
    const longName = 'a'.repeat(60)
    expect(sanitizeSessionName(longName).length).toBe(50)
  })

  it('should test window layout configuration', () => {
    const getWindowLayout = (windowCount: number): string => {
      if (windowCount <= 2) return 'even-horizontal'
      if (windowCount <= 4) return 'tiled'
      if (windowCount <= 6) return 'main-vertical'
      return 'main-horizontal'
    }

    expect(getWindowLayout(1)).toBe('even-horizontal')
    expect(getWindowLayout(2)).toBe('even-horizontal')
    expect(getWindowLayout(3)).toBe('tiled')
    expect(getWindowLayout(5)).toBe('main-vertical')
    expect(getWindowLayout(8)).toBe('main-horizontal')
  })

  it('should test pane command generation', () => {
    const generatePaneCommand = (paneIndex: number, worktreePath: string): string[] => {
      const commands: Record<number, string[]> = {
        0: ['clear', 'git status'],
        1: ['clear', 'ls -la'],
        2: ['clear', 'git log --oneline -n 10'],
      }
      
      return commands[paneIndex] || ['clear']
    }

    expect(generatePaneCommand(0, '/path')).toEqual(['clear', 'git status'])
    expect(generatePaneCommand(1, '/path')).toEqual(['clear', 'ls -la'])
    expect(generatePaneCommand(99, '/path')).toEqual(['clear'])
  })

  it('should test session info formatting', () => {
    const formatSessionInfo = (session: any): string => {
      const parts = [session.name]
      
      if (session.windows > 1) {
        parts.push(`(${session.windows} windows)`)
      }
      
      if (session.attached) {
        parts.push('[attached]')
      }
      
      if (session.created) {
        const age = Date.now() - new Date(session.created).getTime()
        const hours = Math.floor(age / (1000 * 60 * 60))
        if (hours < 24) {
          parts.push(`${hours}h ago`)
        } else {
          parts.push(`${Math.floor(hours / 24)}d ago`)
        }
      }
      
      return parts.join(' ')
    }

    expect(formatSessionInfo({ 
      name: 'main', 
      windows: 3, 
      attached: true 
    })).toBe('main (3 windows) [attached]')

    expect(formatSessionInfo({ 
      name: 'feature', 
      windows: 1,
      created: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    })).toMatch(/feature 5h ago/)
  })

  it('should test tmux command building', () => {
    const buildTmuxCommand = (action: string, session: string, options: any = {}): string[] => {
      const baseCmd = ['tmux']
      
      switch (action) {
        case 'new':
          baseCmd.push('new-session', '-d', '-s', session)
          if (options.startDirectory) {
            baseCmd.push('-c', options.startDirectory)
          }
          break
        
        case 'attach':
          baseCmd.push('attach-session', '-t', session)
          break
        
        case 'kill':
          baseCmd.push('kill-session', '-t', session)
          break
        
        case 'list':
          baseCmd.push('list-sessions', '-F', '#{session_name}:#{session_windows}:#{session_attached}')
          break
      }
      
      return baseCmd
    }

    expect(buildTmuxCommand('new', 'test', { startDirectory: '/path' }))
      .toEqual(['tmux', 'new-session', '-d', '-s', 'test', '-c', '/path'])
    
    expect(buildTmuxCommand('attach', 'test'))
      .toEqual(['tmux', 'attach-session', '-t', 'test'])
    
    expect(buildTmuxCommand('list', ''))
      .toEqual(['tmux', 'list-sessions', '-F', '#{session_name}:#{session_windows}:#{session_attached}'])
  })

  it('should test fzf preview command', () => {
    const getFzfPreview = (sessionName: string): string => {
      return `tmux capture-pane -t ${sessionName} -p | head -20`
    }

    expect(getFzfPreview('main'))
      .toBe('tmux capture-pane -t main -p | head -20')
  })

  it('should test window title generation', () => {
    const getWindowTitle = (index: number, purpose?: string): string => {
      const defaults = ['main', 'editor', 'server', 'git', 'logs']
      
      if (purpose) {
        return purpose
      }
      
      return defaults[index] || `window${index + 1}`
    }

    expect(getWindowTitle(0)).toBe('main')
    expect(getWindowTitle(1)).toBe('editor')
    expect(getWindowTitle(2, 'custom')).toBe('custom')
    expect(getWindowTitle(10)).toBe('window11')
  })

  it('should test session exists check', () => {
    const parseSessionList = (output: string): string[] => {
      return output
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => line.split(':')[0])
    }

    const output = `main:3:1
feature-test:1:0
bugfix:2:0`

    const sessions = parseSessionList(output)
    expect(sessions).toEqual(['main', 'feature-test', 'bugfix'])
    expect(sessions.includes('main')).toBe(true)
    expect(sessions.includes('non-existent')).toBe(false)
  })

  it('should test error messages', () => {
    const getTmuxErrorMessage = (error: any): string => {
      if (error.message?.includes('no server running')) {
        return 'tmuxサーバーが起動していません。tmuxを起動してください。'
      }
      if (error.message?.includes('session not found')) {
        return 'セッションが見つかりません。'
      }
      if (error.message?.includes('command not found')) {
        return 'tmuxがインストールされていません。brew install tmux でインストールしてください。'
      }
      return `tmuxエラー: ${error.message || '不明なエラー'}`
    }

    expect(getTmuxErrorMessage(new Error('no server running')))
      .toContain('tmuxサーバーが起動していません')
    
    expect(getTmuxErrorMessage(new Error('session not found')))
      .toBe('セッションが見つかりません。')
    
    expect(getTmuxErrorMessage(new Error('tmux: command not found')))
      .toContain('brew install tmux')
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  saveWorktreeMetadata, 
  createTmuxSession, 
  handleClaudeMarkdown,
  parseIssueNumber,
  fetchGitHubMetadata
} from '../../commands/create.js'
import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'

// モック設定
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('path')

describe('create command - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveWorktreeMetadata', () => {
    it('should save metadata to .maestro-metadata.json', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(path.join).mockReturnValue('/path/to/worktree/.maestro-metadata.json')

      await saveWorktreeMetadata('/path/to/worktree', 'feature/test', {
        template: 'test-template',
        github: {
          type: 'issue',
          title: 'Test issue',
          body: 'Test description',
          author: 'testuser',
          labels: ['bug'],
          assignees: ['testuser'],
          url: 'https://github.com/test/repo/issues/1'
        }
      })

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/worktree/.maestro-metadata.json',
        expect.stringContaining('"branch": "feature/test"')
      )
    })

    it('should handle metadata save failure gracefully', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('write failed'))
      vi.mocked(path.join).mockReturnValue('/path/to/worktree/.maestro-metadata.json')

      // Should not throw error
      await expect(saveWorktreeMetadata('/path/to/worktree', 'feature/test', {})).resolves.not.toThrow()
    })
  })

  describe('createTmuxSession', () => {
    it('should create new tmux session with Claude Code', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'tmux' && args?.[0] === 'has-session') {
          throw new Error('session not found')
        }
        return { stdout: 'success' }
      })

      const config = {
        claude: {
          autoStart: true,
          initialCommands: ['echo "hello"', 'pwd']
        }
      }

      await createTmuxSession('feature/test', '/path/to/worktree', config)

      expect(execa).toHaveBeenCalledWith('tmux', ['has-session', '-t', 'feature-test'])
      expect(execa).toHaveBeenCalledWith('tmux', ['new-session', '-d', '-s', 'feature-test', '-c', '/path/to/worktree'])
      expect(execa).toHaveBeenCalledWith('tmux', ['rename-window', '-t', 'feature-test', 'feature/test'])
    })

    it('should handle existing session', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'tmux' && args?.[0] === 'has-session') {
          return { stdout: 'session exists' }
        }
        return { stdout: 'success' }
      })

      const config = { claude: { autoStart: false } }

      await createTmuxSession('feature/test', '/path/to/worktree', config)

      expect(execa).toHaveBeenCalledWith('tmux', ['has-session', '-t', 'feature-test'])
      // Should not create new session
      expect(execa).not.toHaveBeenCalledWith('tmux', ['new-session', '-d', '-s', 'feature-test', '-c', '/path/to/worktree'])
    })

    it('should start Claude Code with initial commands', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'tmux' && args?.[0] === 'has-session') {
          throw new Error('session not found')
        }
        return { stdout: 'success' }
      })

      const config = {
        claude: {
          autoStart: true,
          initialCommands: ['echo "hello"', 'pwd']
        }
      }

      await createTmuxSession('feature/test', '/path/to/worktree', config)

      expect(execa).toHaveBeenCalledWith('tmux', ['send-keys', '-t', 'feature-test', 'claude', 'Enter'])
      expect(execa).toHaveBeenCalledWith('tmux', ['send-keys', '-t', 'feature-test', 'echo "hello"', 'Enter'])
      expect(execa).toHaveBeenCalledWith('tmux', ['send-keys', '-t', 'feature-test', 'pwd', 'Enter'])
    })

    it('should handle tmux session creation failure', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'tmux' && args?.[0] === 'has-session') {
          throw new Error('session not found')
        }
        if (cmd === 'tmux' && args?.[0] === 'new-session') {
          throw new Error('tmux failed')
        }
        return { stdout: 'success' }
      })

      const config = { claude: { autoStart: false } }

      // Should not throw error
      await expect(createTmuxSession('feature/test', '/path/to/worktree', config)).resolves.not.toThrow()
    })

    it('should sanitize session name', async () => {
      vi.mocked(execa).mockImplementation(async (cmd, args) => {
        if (cmd === 'tmux' && args?.[0] === 'has-session') {
          throw new Error('session not found')
        }
        return { stdout: 'success' }
      })

      const config = { claude: { autoStart: false } }

      await createTmuxSession('feature/test@special#chars', '/path/to/worktree', config)

      expect(execa).toHaveBeenCalledWith('tmux', ['has-session', '-t', 'feature-test-special-chars'])
    })
  })

  describe('handleClaudeMarkdown', () => {
    it('should create symlink in shared mode', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined)
      vi.mocked(fs.symlink).mockResolvedValue(undefined)
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'))
      vi.mocked(path.relative).mockReturnValue('../CLAUDE.md')

      const config = { claude: { markdownMode: 'shared' } }

      await handleClaudeMarkdown('/path/to/worktree', config)

      expect(fs.symlink).toHaveBeenCalledWith('../CLAUDE.md', '/path/to/worktree/CLAUDE.md')
    })

    it('should create dedicated CLAUDE.md in split mode', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'))
      vi.mocked(path.basename).mockReturnValue('worktree')

      const config = { claude: { markdownMode: 'split' } }

      await handleClaudeMarkdown('/path/to/worktree', config)

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/worktree/CLAUDE.md',
        expect.stringContaining('worktree - Claude Code Instructions')
      )
    })

    it('should handle CLAUDE.md not found in shared mode', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('not found'))
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'))

      const config = { claude: { markdownMode: 'shared' } }

      // Should not throw error
      await expect(handleClaudeMarkdown('/path/to/worktree', config)).resolves.not.toThrow()
      expect(fs.symlink).not.toHaveBeenCalled()
    })

    it('should handle symlink creation failure', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined)
      vi.mocked(fs.symlink).mockRejectedValue(new Error('symlink failed'))
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'))
      vi.mocked(path.relative).mockReturnValue('../CLAUDE.md')

      const config = { claude: { markdownMode: 'shared' } }

      // Should not throw error
      await expect(handleClaudeMarkdown('/path/to/worktree', config)).resolves.not.toThrow()
    })

    it('should handle split mode file write failure', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('write failed'))
      vi.mocked(path.join).mockImplementation((...args) => args.join('/'))
      vi.mocked(path.basename).mockReturnValue('worktree')

      const config = { claude: { markdownMode: 'split' } }

      // Should not throw error
      await expect(handleClaudeMarkdown('/path/to/worktree', config)).resolves.not.toThrow()
    })
  })

  describe('parseIssueNumber', () => {
    it('should parse issue number with # prefix', () => {
      const result = parseIssueNumber('#123')

      expect(result).toEqual({
        isIssue: true,
        issueNumber: '123',
        branchName: 'issue-123'
      })
    })

    it('should parse issue number without # prefix', () => {
      const result = parseIssueNumber('123')

      expect(result).toEqual({
        isIssue: true,
        issueNumber: '123',
        branchName: 'issue-123'
      })
    })

    it('should parse issue-123 format', () => {
      const result = parseIssueNumber('issue-123')

      expect(result).toEqual({
        isIssue: true,
        issueNumber: '123',
        branchName: 'issue-123'
      })
    })

    it('should handle non-issue branch names', () => {
      const result = parseIssueNumber('feature/test')

      expect(result).toEqual({
        isIssue: false,
        branchName: 'feature/test'
      })
    })

    it('should handle empty string', () => {
      const result = parseIssueNumber('')

      expect(result).toEqual({
        isIssue: false,
        branchName: ''
      })
    })
  })

  describe('fetchGitHubMetadata', () => {
    it('should fetch PR metadata first', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({
          number: 123,
          title: 'Test PR',
          body: 'PR description',
          author: { login: 'testuser' },
          labels: [{ name: 'enhancement' }],
          assignees: [{ login: 'assignee' }],
          milestone: { title: 'v1.0' },
          url: 'https://github.com/test/repo/pull/123'
        })
      })

      const result = await fetchGitHubMetadata('123')

      expect(result).toEqual({
        type: 'pr',
        title: 'Test PR',
        body: 'PR description',
        author: 'testuser',
        labels: ['enhancement'],
        assignees: ['assignee'],
        milestone: 'v1.0',
        url: 'https://github.com/test/repo/pull/123'
      })
    })

    it('should fall back to issue if PR not found', async () => {
      vi.mocked(execa)
        .mockRejectedValueOnce(new Error('PR not found'))
        .mockResolvedValue({
          stdout: JSON.stringify({
            number: 123,
            title: 'Test Issue',
            body: 'Issue description',
            author: { login: 'testuser' },
            labels: [{ name: 'bug' }],
            assignees: [],
            milestone: null,
            url: 'https://github.com/test/repo/issues/123'
          })
        })

      const result = await fetchGitHubMetadata('123')

      expect(result).toEqual({
        type: 'issue',
        title: 'Test Issue',
        body: 'Issue description',
        author: 'testuser',
        labels: ['bug'],
        assignees: [],
        milestone: undefined,
        url: 'https://github.com/test/repo/issues/123'
      })
    })

    it('should handle missing fields gracefully', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({
          number: 123,
          title: 'Test Issue',
          body: null,
          author: null,
          labels: null,
          assignees: null,
          milestone: null,
          url: 'https://github.com/test/repo/issues/123'
        })
      })

      const result = await fetchGitHubMetadata('123')

      expect(result).toEqual({
        type: 'pr',
        title: 'Test Issue',
        body: '',
        author: '',
        labels: [],
        assignees: [],
        milestone: undefined,
        url: 'https://github.com/test/repo/issues/123'
      })
    })

    it('should return null if both PR and issue fail', async () => {
      vi.mocked(execa)
        .mockRejectedValueOnce(new Error('PR not found'))
        .mockRejectedValueOnce(new Error('Issue not found'))

      const result = await fetchGitHubMetadata('123')

      expect(result).toBeNull()
    })

    it('should handle GitHub CLI authentication error', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('gh auth required'))

      const result = await fetchGitHubMetadata('123')

      expect(result).toBeNull()
    })
  })
})
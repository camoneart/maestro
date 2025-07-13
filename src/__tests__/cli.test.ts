import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { program } from '../cli.js'

// Mock all command modules
vi.mock('../commands/create.js', () => ({
  createCommand: {
    name: () => 'create',
  },
}))

vi.mock('../commands/delete.js', () => ({
  deleteCommand: {
    name: () => 'delete',
  },
}))

vi.mock('../commands/list.js', () => ({
  listCommand: {
    name: () => 'list',
  },
}))

vi.mock('../commands/attach.js', () => ({
  attachCommand: {
    name: () => 'attach',
  },
}))

vi.mock('../commands/where.js', () => ({
  whereCommand: {
    name: () => 'where',
  },
}))

vi.mock('../commands/shell.js', () => ({
  shellCommand: {
    name: () => 'shell',
  },
}))

vi.mock('../commands/exec.js', () => ({
  execCommand: {
    name: () => 'exec',
  },
}))

vi.mock('../commands/github.js', () => ({
  githubCommand: {
    name: () => 'github',
  },
}))

vi.mock('../commands/review.js', () => ({
  reviewCommand: {
    name: () => 'review',
  },
}))

vi.mock('../commands/issue.js', () => ({
  issueCommand: {
    name: () => 'issue',
  },
}))

vi.mock('../commands/tmux.js', () => ({
  tmuxCommand: {
    name: () => 'tmux',
  },
}))

vi.mock('../commands/batch.js', () => ({
  batchCommand: {
    name: () => 'batch',
  },
}))

vi.mock('../commands/sync.js', () => ({
  syncCommand: {
    name: () => 'sync',
  },
}))

vi.mock('../commands/graph.js', () => ({
  graphCommand: {
    name: () => 'graph',
  },
}))

vi.mock('../commands/template.js', () => ({
  templateCommand: {
    name: () => 'template',
  },
}))

vi.mock('../commands/history.js', () => ({
  historyCommand: {
    name: () => 'history',
  },
}))

vi.mock('../commands/suggest.js', () => ({
  suggestCommand: {
    name: () => 'suggest',
  },
}))

vi.mock('../commands/watch.js', () => ({
  watchCommand: {
    name: () => 'watch',
  },
}))

vi.mock('../commands/dashboard.js', () => ({
  dashboardCommand: {
    name: () => 'dashboard',
  },
}))

vi.mock('../commands/snapshot.js', () => ({
  snapshotCommand: {
    name: () => 'snapshot',
  },
}))

vi.mock('../commands/health.js', () => ({
  healthCommand: {
    name: () => 'health',
  },
}))

vi.mock('../commands/config.js', () => ({
  configCommand: {
    name: () => 'config',
  },
}))

vi.mock('../commands/completion.js', () => ({
  completionCommand: {
    name: () => 'completion',
  },
}))

vi.mock('../commands/mcp.js', () => ({
  mcpCommand: {
    name: () => 'mcp',
  },
}))

describe('CLI', () => {
  let consoleLogSpy: Mock
  let consoleErrorSpy: Mock

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('program configuration', () => {
    it('should have correct name and description', () => {
      expect(program.name()).toBe('scj')
      expect(program.description()).toContain('影分身の術')
    })

    it('should have version', () => {
      expect(program.version()).toBeDefined()
    })

    it('should have all commands registered', () => {
      const commands = program.commands.map(cmd => cmd.name())
      
      expect(commands).toContain('create')
      expect(commands).toContain('delete')
      expect(commands).toContain('list')
      expect(commands).toContain('attach')
      expect(commands).toContain('where')
      expect(commands).toContain('shell')
      expect(commands).toContain('exec')
      expect(commands).toContain('github')
      expect(commands).toContain('review')
      expect(commands).toContain('issue')
      expect(commands).toContain('tmux')
      expect(commands).toContain('batch')
      expect(commands).toContain('sync')
      expect(commands).toContain('graph')
      expect(commands).toContain('template')
      expect(commands).toContain('history')
      expect(commands).toContain('suggest')
      expect(commands).toContain('watch')
      expect(commands).toContain('dashboard')
      expect(commands).toContain('snapshot')
      expect(commands).toContain('health')
      expect(commands).toContain('config')
      expect(commands).toContain('completion')
      expect(commands).toContain('mcp')
    })
  })

  describe('help output', () => {
    it('should display help when no arguments', async () => {
      const outputHelpSpy = vi.spyOn(program, 'outputHelp').mockImplementation(() => {})
      
      await program.parseAsync(['node', 'scj'])
      
      expect(outputHelpSpy).toHaveBeenCalled()
    })

    it('should display ninja banner', async () => {
      await program.parseAsync(['node', 'scj'])
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🥷'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('影分身の術'))
    })
  })

  describe('error handling', () => {
    it('should handle parse errors gracefully', async () => {
      // Force an error by providing invalid command
      const mockError = new Error('Unknown command')
      vi.spyOn(program, 'parse').mockImplementation(() => {
        throw mockError
      })
      
      try {
        program.parse(['node', 'scj', 'invalid-command'])
      } catch (error) {
        // Expected to throw
        expect(error).toBe(mockError)
      }
    })
  })

  describe('command aliases', () => {
    it('should have aliases for common commands', () => {
      const listCmd = program.commands.find(cmd => cmd.name() === 'list')
      const deleteCmd = program.commands.find(cmd => cmd.name() === 'delete')
      const shellCmd = program.commands.find(cmd => cmd.name() === 'shell')
      
      expect(listCmd?.aliases()).toContain('ls')
      expect(deleteCmd?.aliases()).toContain('rm')
      expect(shellCmd?.aliases()).toContain('sh')
    })
  })
})
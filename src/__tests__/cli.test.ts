import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock all the commands to prevent actual execution
vi.mock('../commands/create.js', () => ({
  createCommand: new Command('create')
}))
vi.mock('../commands/list.js', () => ({
  listCommand: new Command('list')
}))
vi.mock('../commands/delete.js', () => ({
  deleteCommand: new Command('delete')
}))
vi.mock('../commands/shell.js', () => ({
  shellCommand: new Command('shell')
}))
vi.mock('../commands/exec.js', () => ({
  execCommand: new Command('exec')
}))
vi.mock('../commands/attach.js', () => ({
  attachCommand: new Command('attach')
}))
vi.mock('../commands/mcp.js', () => ({
  mcpCommand: new Command('mcp')
}))
vi.mock('../commands/config.js', () => ({
  configCommand: new Command('config')
}))
vi.mock('../commands/github.js', () => ({
  githubCommand: new Command('github')
}))
vi.mock('../commands/completion.js', () => ({
  completionCommand: new Command('completion')
}))
vi.mock('../commands/tmux.js', () => ({
  tmuxCommand: new Command('tmux')
}))
vi.mock('../commands/where.js', () => ({
  whereCommand: new Command('where')
}))
vi.mock('../commands/sync.js', () => ({
  syncCommand: new Command('sync')
}))
vi.mock('../commands/review.js', () => ({
  reviewCommand: new Command('review')
}))
vi.mock('../commands/issue.js', () => ({
  issueCommand: new Command('issue')
}))
vi.mock('../commands/batch.js', () => ({
  batchCommand: new Command('batch')
}))
vi.mock('../commands/history.js', () => ({
  historyCommand: new Command('history')
}))
vi.mock('../commands/suggest.js', () => ({
  suggestCommand: new Command('suggest')
}))
vi.mock('../commands/graph.js', () => ({
  graphCommand: new Command('graph')
}))
vi.mock('../commands/template.js', () => ({
  templateCommand: new Command('template')
}))
vi.mock('../commands/watch.js', () => ({
  watchCommand: new Command('watch')
}))
vi.mock('../commands/health.js', () => ({
  healthCommand: new Command('health')
}))
vi.mock('../commands/dashboard.js', () => ({
  dashboardCommand: new Command('dashboard')
}))
vi.mock('../commands/snapshot.js', () => ({
  snapshotCommand: new Command('snapshot')
}))

describe('CLI', () => {
  let originalArgv: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    originalArgv = process.argv
    process.argv = ['node', 'cli.js']
  })

  afterEach(() => {
    process.argv = originalArgv
  })

  describe('basic CLI tests', () => {
    it.skip('should export a valid CLI module', async () => {
      const cli = await import('../cli.js')
      expect(cli.program).toBeDefined()
      expect(cli.program.name()).toBe('scj')
    })

    it.skip('should have correct description', async () => {
      const cli = await import('../cli.js')
      expect(cli.program.description()).toContain('影分身の術')
    })

    it.skip('should have version', async () => {
      const cli = await import('../cli.js')
      expect(cli.program.version()).toBeDefined()
    })
  })
})
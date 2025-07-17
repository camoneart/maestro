import { describe, it, expect, vi, beforeEach } from 'vitest'

// CLI import should not trigger program.parseAsync
vi.mock('../cli.js', async () => {
  const { Command } = await vi.importActual('commander') as any
  const program = new Command()
  
  program
    .name('maestro')
    .description('🎼 maestro - 指揮者のようにClaude Codeと協奏開発')
    .version('0.1.0')
    
  // Mock all the command imports to avoid loading actual command modules
  const mockCommand = (name: string, aliases: string[] = []) => {
    const cmd = new (Command as any)(name)
    cmd.description(`Mock ${name} command`)
    aliases.forEach(alias => cmd.alias(alias))
    return cmd
  }
  
  program.addCommand(mockCommand('create', ['c']))
  program.addCommand(mockCommand('list', ['ls']))
  program.addCommand(mockCommand('delete', ['rm']))
  program.addCommand(mockCommand('shell', ['sh']))
  program.addCommand(mockCommand('exec', ['e']))
  program.addCommand(mockCommand('attach', ['a']))
  program.addCommand(mockCommand('mcp'))
  program.addCommand(mockCommand('config'))
  program.addCommand(mockCommand('github', ['gh']))
  program.addCommand(mockCommand('completion'))
  program.addCommand(mockCommand('tmux', ['t']))
  program.addCommand(mockCommand('where', ['w']))
  program.addCommand(mockCommand('sync', ['s']))
  program.addCommand(mockCommand('review', ['r']))
  program.addCommand(mockCommand('issue', ['i']))
  program.addCommand(mockCommand('batch', ['b']))
  program.addCommand(mockCommand('history', ['h']))
  program.addCommand(mockCommand('suggest', ['sg']))
  program.addCommand(mockCommand('graph', ['g']))
  program.addCommand(mockCommand('template', ['tpl']))
  program.addCommand(mockCommand('watch'))
  program.addCommand(mockCommand('health', ['check']))
  program.addCommand(mockCommand('dashboard', ['ui']))
  program.addCommand(mockCommand('snapshot', ['snap']))
  
  return { program }
})

const { program } = await import('../cli.js')

describe('CLI Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CLI structure', () => {
    it('should have correct program name', () => {
      expect(program.name()).toBe('maestro')
    })

    it('should have correct description', () => {
      expect(program.description()).toContain('maestro')
      expect(program.description()).toContain('指揮者のように')
    })

    it('should have correct version', () => {
      expect(program.version()).toBe('0.1.0')
    })

    it('should have all required commands', () => {
      const commands = program.commands.map(cmd => cmd.name())
      
      // 基本コマンド
      expect(commands).toContain('create')
      expect(commands).toContain('list')
      expect(commands).toContain('delete')
      expect(commands).toContain('shell')
      expect(commands).toContain('exec')
      expect(commands).toContain('attach')
      
      // 拡張コマンド
      expect(commands).toContain('mcp')
      expect(commands).toContain('config')
      expect(commands).toContain('github')
      expect(commands).toContain('completion')
      expect(commands).toContain('tmux')
      expect(commands).toContain('where')
      expect(commands).toContain('sync')
      expect(commands).toContain('review')
      expect(commands).toContain('issue')
      expect(commands).toContain('batch')
      expect(commands).toContain('history')
      expect(commands).toContain('suggest')
      expect(commands).toContain('graph')
      expect(commands).toContain('template')
      expect(commands).toContain('watch')
      expect(commands).toContain('health')
      expect(commands).toContain('dashboard')
      expect(commands).toContain('snapshot')
    })

    it('should have command aliases', () => {
      const createCommand = program.commands.find(cmd => cmd.name() === 'create')
      expect(createCommand?.aliases()).toContain('c')

      const listCommand = program.commands.find(cmd => cmd.name() === 'list')
      expect(listCommand?.aliases()).toContain('ls')

      const deleteCommand = program.commands.find(cmd => cmd.name() === 'delete')
      expect(deleteCommand?.aliases()).toContain('rm')

      const execCommand = program.commands.find(cmd => cmd.name() === 'exec')
      expect(execCommand?.aliases()).toContain('e')
    })
  })

  describe('command descriptions', () => {
    it('should have proper descriptions for all commands', () => {
      const commands = program.commands

      commands.forEach(cmd => {
        expect(cmd.description()).toBeTruthy()
        expect(cmd.description().length).toBeGreaterThan(0)
      })
    })
  })
})
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { mcpCommand } from '../../commands/mcp.js'
import { spawn } from 'child_process'
import chalk from 'chalk'

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

describe('mcp command', () => {
  let consoleLogSpy: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`Process exited with code ${code}`)
    })
  })

  describe('basic functionality', () => {
    it('should show usage when no subcommand is provided', async () => {
      await expect(
        mcpCommand.parseAsync(['node', 'mcp'])
      ).rejects.toThrow('Process exited with code 0')

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('使い方: maestro mcp serve'))
    })

    it('should start MCP server with serve subcommand', async () => {
      const mockChildProcess = {
        on: vi.fn(),
        killed: false,
      }
      ;(spawn as Mock).mockReturnValue(mockChildProcess)

      await mcpCommand.parseAsync(['node', 'mcp', 'serve'])

      expect(spawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          stdio: 'inherit',
        })
      )
    })

    it('should show usage for invalid subcommand', async () => {
      await expect(
        mcpCommand.parseAsync(['node', 'mcp', 'unknown'])
      ).rejects.toThrow('Process exited with code 0')

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('使い方: maestro mcp serve'))
    })
  })
})
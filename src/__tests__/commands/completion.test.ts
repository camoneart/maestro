import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { completionCommand } from '../../commands/completion.js'

describe('completion command', () => {
  let consoleLogSpy: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('shell completion', () => {
    it('should generate bash completion script', async () => {
      await completionCommand.parseAsync(['node', 'completion', 'bash'])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('#!/bin/bash'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('_maestro_completions'))
    })

    it('should generate zsh completion script', async () => {
      await completionCommand.parseAsync(['node', 'completion', 'zsh'])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('#compdef maestro'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('_maestro'))
    })

    it('should show installation guide when no shell is specified', async () => {
      await completionCommand.parseAsync(['node', 'completion'])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('セットアップ方法'))
    })

    it('should generate fish completion script', async () => {
      await completionCommand.parseAsync(['node', 'completion', 'fish'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('# maestro fish completion')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('complete -c maestro'))
    })
  })
})

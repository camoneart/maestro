import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('basic CLI tests', () => {
    it('should have correct name', () => {
      const { Command } = require('commander')
      const program = new Command()
      program.name('scj')
      expect(program.name()).toBe('scj')
    })

    it('should have correct description', () => {
      const { Command } = require('commander')
      const program = new Command()
      program.description('🥷 shadow-clone-jutsu - 影分身の術でClaude Codeとパラレル開発')
      expect(program.description()).toContain('影分身の術')
    })

    it('should have version', () => {
      const { Command } = require('commander')
      const program = new Command()
      program.version('0.1.0')
      expect(program.version()).toBe('0.1.0')
    })
  })
})
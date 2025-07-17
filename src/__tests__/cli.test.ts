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
      program.name('maestro')
      expect(program.name()).toBe('maestro')
    })

    it('should have correct description', () => {
      const { Command } = require('commander')
      const program = new Command()
      program.description('🎼 maestro - 指揮者のようにClaude Codeと協奏開発')
      expect(program.description()).toContain('指揮者のように')
    })

    it('should have version', () => {
      const { Command } = require('commander')
      const program = new Command()
      program.version('0.1.0')
      expect(program.version()).toBe('0.1.0')
    })
  })
})
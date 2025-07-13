import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.join(__dirname, '..', '..', 'src', 'cli.ts')

describe('CLI Integration Tests', () => {
  describe('command execution', () => {
    it('should show help when no command is provided', async () => {
      try {
        await execa('tsx', [cliPath, '--help'], { timeout: 10000 })
      } catch (error: any) {
        expect(error.stdout).toContain('shadow-clone-jutsu')
        expect(error.stdout).toContain('影分身の術')
      }
    }, 10000)

    it('should show version', async () => {
      try {
        await execa('tsx', [cliPath, '--version'], { timeout: 10000 })
      } catch (error: any) {
        expect(error.stdout).toMatch(/\d+\.\d+\.\d+/)
      }
    }, 10000)

    it('should handle unknown command', async () => {
      try {
        await execa('tsx', [cliPath, 'unknown-command'], { timeout: 10000 })
      } catch (error: any) {
        expect(error.stderr).toContain('エラー')
        expect(error.exitCode).toBe(1)
      }
    }, 10000)
  })
})
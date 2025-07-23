import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'
import path from 'path'
import { addToGitignore, isEntryInGitignore } from '../../utils/gitignore.js'

describe('gitignore utility', () => {
  const testDir = path.join(__dirname, 'test-gitignore')
  const gitignorePath = path.join(testDir, '.gitignore')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('addToGitignore', () => {
    it('should create .gitignore file if it does not exist', async () => {
      await addToGitignore(testDir, '.maestro-metadata.json')

      expect(existsSync(gitignorePath)).toBe(true)
      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toBe('.maestro-metadata.json\n')
    })

    it('should append entry to existing .gitignore file', async () => {
      writeFileSync(gitignorePath, 'node_modules/\n*.log\n', 'utf-8')

      await addToGitignore(testDir, '.maestro-metadata.json')

      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toBe('node_modules/\n*.log\n.maestro-metadata.json\n')
    })

    it('should not add duplicate entries', async () => {
      writeFileSync(gitignorePath, 'node_modules/\n.maestro-metadata.json\n', 'utf-8')

      await addToGitignore(testDir, '.maestro-metadata.json')

      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toBe('node_modules/\n.maestro-metadata.json\n')
    })

    it('should handle files without trailing newline', async () => {
      writeFileSync(gitignorePath, 'node_modules/', 'utf-8')

      await addToGitignore(testDir, '.maestro-metadata.json')

      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toBe('node_modules/\n.maestro-metadata.json\n')
    })

    it('should trim whitespace when checking for duplicates', async () => {
      writeFileSync(gitignorePath, 'node_modules/\n  .maestro-metadata.json  \n', 'utf-8')

      await addToGitignore(testDir, '.maestro-metadata.json')

      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toBe('node_modules/\n  .maestro-metadata.json  \n')
    })
  })

  describe('isEntryInGitignore', () => {
    it('should return false if .gitignore does not exist', () => {
      const result = isEntryInGitignore(testDir, '.maestro-metadata.json')
      expect(result).toBe(false)
    })

    it('should return true if entry exists in .gitignore', () => {
      writeFileSync(gitignorePath, 'node_modules/\n.maestro-metadata.json\n*.log\n', 'utf-8')

      const result = isEntryInGitignore(testDir, '.maestro-metadata.json')
      expect(result).toBe(true)
    })

    it('should return false if entry does not exist in .gitignore', () => {
      writeFileSync(gitignorePath, 'node_modules/\n*.log\n', 'utf-8')

      const result = isEntryInGitignore(testDir, '.maestro-metadata.json')
      expect(result).toBe(false)
    })

    it('should handle whitespace trimming when checking entries', () => {
      writeFileSync(gitignorePath, 'node_modules/\n  .maestro-metadata.json  \n', 'utf-8')

      const result = isEntryInGitignore(testDir, '.maestro-metadata.json')
      expect(result).toBe(true)
    })

    it('should return false for empty .gitignore file', () => {
      writeFileSync(gitignorePath, '', 'utf-8')

      const result = isEntryInGitignore(testDir, '.maestro-metadata.json')
      expect(result).toBe(false)
    })
  })

  describe('addToGitignore with comment', () => {
    it('should add entry with comment to .gitignore', async () => {
      writeFileSync(gitignorePath, 'node_modules/\n', 'utf-8')

      await addToGitignore(testDir, '.maestro-metadata.json', 'maestro metadata')

      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('# maestro metadata')
      expect(content).toContain('.maestro-metadata.json')
      expect(content.indexOf('# maestro metadata')).toBeLessThan(
        content.indexOf('.maestro-metadata.json')
      )
    })

    it('should not add comment for existing entry', async () => {
      writeFileSync(gitignorePath, 'node_modules/\n.maestro-metadata.json\n', 'utf-8')

      await addToGitignore(testDir, '.maestro-metadata.json', 'maestro metadata')

      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).not.toContain('# maestro metadata')
      expect(content.split('.maestro-metadata.json')).toHaveLength(2) // Only one occurrence
    })
  })
})

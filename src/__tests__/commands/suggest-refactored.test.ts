import { describe, it, expect, vi } from 'vitest'
import {
  createCommitPrompt,
  analyzeRepositoryInfo,
  formatSuggestions,
  parseClaudeResponse,
} from '../../commands/suggest.js'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

// fsモジュールをモック
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

describe('suggest.ts refactored functions', () => {
  describe('createCommitPrompt', () => {
    it('should create conventional commit prompt', () => {
      const diffContent = 'diff --git a/src/auth.js b/src/auth.js\n+function login() {}'
      const options = {
        type: 'conventional' as const,
        scope: 'auth',
        maxLength: 50,
      }

      const prompt = createCommitPrompt(diffContent, options)

      expect(prompt).toContain('Conventional Commits形式')
      expect(prompt).toContain('scope: auth')
      expect(prompt).toContain('最大50文字')
      expect(prompt).toContain(diffContent)
    })

    it('should create standard commit prompt', () => {
      const diffContent = 'diff --git a/README.md b/README.md\n+# Updated README'
      const options = {
        type: 'standard' as const,
        maxLength: 72,
      }

      const prompt = createCommitPrompt(diffContent, options)

      expect(prompt).not.toContain('Conventional Commits形式')
      expect(prompt).toContain('最大72文字')
      expect(prompt).toContain(diffContent)
    })

    it('should use default options when not provided', () => {
      const diffContent = 'diff --git a/test.js b/test.js\n+console.log("test")'

      const prompt = createCommitPrompt(diffContent, {})

      expect(prompt).toContain('Conventional Commits形式')
      expect(prompt).toContain('最大72文字')
      expect(prompt).toContain(diffContent)
    })
  })

  describe('analyzeRepositoryInfo', () => {
    it('should analyze repository with package.json', () => {
      const repoPath = '/test/repo'
      const packageJsonPath = path.join(repoPath, 'package.json')

      vi.mocked(existsSync).mockImplementation(path => {
        if (path === packageJsonPath) return true
        if (path === '/test/repo/pnpm-lock.yaml') return true
        return false
      })

      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            react: '^18.0.0',
            express: '^4.0.0',
          },
          devDependencies: {
            '@types/node': '^18.0.0',
          },
          workspaces: ['packages/*'],
        })
      )

      const result = analyzeRepositoryInfo(repoPath)

      expect(result.projectName).toBe('test-project')
      expect(result.isMonorepo).toBe(true)
      expect(result.detectedFrameworks).toEqual(['React', 'Express'])
      expect(result.packageManager).toBe('pnpm')
    })

    it('should detect yarn package manager', () => {
      const repoPath = '/test/repo'
      const packageJsonPath = path.join(repoPath, 'package.json')

      vi.mocked(existsSync).mockImplementation(path => {
        if (path === packageJsonPath) return true
        if (path === '/test/repo/yarn.lock') return true
        return false
      })

      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'yarn-project',
          dependencies: {},
        })
      )

      const result = analyzeRepositoryInfo(repoPath)

      expect(result.packageManager).toBe('yarn')
    })

    it('should detect lerna monorepo', () => {
      const repoPath = '/test/repo'
      const packageJsonPath = path.join(repoPath, 'package.json')

      vi.mocked(existsSync).mockImplementation(path => {
        if (path === packageJsonPath) return true
        if (path === '/test/repo/lerna.json') return true
        return false
      })

      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'lerna-project',
          dependencies: {},
        })
      )

      const result = analyzeRepositoryInfo(repoPath)

      expect(result.isMonorepo).toBe(true)
    })

    it('should handle missing package.json', () => {
      const repoPath = '/test/repo'

      vi.mocked(existsSync).mockReturnValue(false)

      const result = analyzeRepositoryInfo(repoPath)

      expect(result.projectName).toBe('repo')
      expect(result.isMonorepo).toBe(false)
      expect(result.detectedFrameworks).toEqual([])
      expect(result.packageManager).toBe('npm')
    })

    it('should handle invalid package.json', () => {
      const repoPath = '/test/repo'
      const packageJsonPath = path.join(repoPath, 'package.json')

      vi.mocked(existsSync).mockImplementation(path => path === packageJsonPath)
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Invalid JSON')
      })

      const result = analyzeRepositoryInfo(repoPath)

      expect(result.projectName).toBe('repo')
      expect(result.isMonorepo).toBe(false)
      expect(result.detectedFrameworks).toEqual([])
      expect(result.packageManager).toBe('npm')
    })

    it('should detect multiple frameworks', () => {
      const repoPath = '/test/repo'
      const packageJsonPath = path.join(repoPath, 'package.json')

      vi.mocked(existsSync).mockImplementation(path => path === packageJsonPath)
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          name: 'multi-framework-project',
          dependencies: {
            react: '^18.0.0',
            vue: '^3.0.0',
            next: '^13.0.0',
          },
          devDependencies: {
            angular: '^15.0.0',
          },
        })
      )

      const result = analyzeRepositoryInfo(repoPath)

      expect(result.detectedFrameworks).toEqual(['React', 'Vue', 'Angular', 'Next.js'])
    })
  })

  describe('formatSuggestions', () => {
    it('should format suggestions with numbering', () => {
      const suggestions = ['feat: add login', 'fix: resolve bug', 'docs: update readme']
      const result = formatSuggestions(suggestions)

      expect(result).toBe('1. feat: add login\n2. fix: resolve bug\n3. docs: update readme')
    })

    it('should return empty string for empty suggestions', () => {
      const result = formatSuggestions([])

      expect(result).toBe('')
    })

    it('should handle single suggestion', () => {
      const suggestions = ['feat: add feature']
      const result = formatSuggestions(suggestions)

      expect(result).toBe('1. feat: add feature')
    })
  })

  describe('parseClaudeResponse', () => {
    it('should parse numbered suggestions', () => {
      const response = `1. feat: add user authentication
2. fix: resolve login bug
3. docs: update API documentation
4. test: add unit tests
5. chore: update dependencies`

      const result = parseClaudeResponse(response)

      expect(result).toEqual([
        'feat: add user authentication',
        'fix: resolve login bug',
        'docs: update API documentation',
        'test: add unit tests',
        'chore: update dependencies',
      ])
    })

    it('should ignore non-numbered lines', () => {
      const response = `Here are the suggestions:
1. feat: add feature
Some explanation
2. fix: resolve issue
More text
3. docs: update docs`

      const result = parseClaudeResponse(response)

      expect(result).toEqual(['feat: add feature', 'fix: resolve issue', 'docs: update docs'])
    })

    it('should handle empty response', () => {
      const response = ''

      const result = parseClaudeResponse(response)

      expect(result).toEqual([])
    })

    it('should handle malformed numbering', () => {
      const response = `1. feat: add feature
2 fix: missing dot
3. docs: update docs`

      const result = parseClaudeResponse(response)

      expect(result).toEqual(['feat: add feature', 'docs: update docs'])
    })

    it('should trim whitespace from suggestions', () => {
      const response = `1.   feat: add feature   
2.    fix: resolve issue    
3.  docs: update docs  `

      const result = parseClaudeResponse(response)

      expect(result).toEqual(['feat: add feature', 'fix: resolve issue', 'docs: update docs'])
    })
  })
})

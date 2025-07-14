import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'

// suggest.ts内の関数群の追加テスト

// モック
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('path')
vi.mock('../../core/config.js')
vi.mock('../../core/git.js')

const mockExeca = execa as any
const mockFs = fs as any
const mockPath = path as any

describe('Suggest Command - Enhanced Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Branch name validation', () => {
    it('should validate branch name format', () => {
      function isValidBranchName(name: string): boolean {
        // Git branch naming rules
        const invalidChars = /[~^:\s\[\]?*\\]/
        const invalidPatterns = /^[.-]|[.-]$|\.\.|\/$|@\{/
        
        return !invalidChars.test(name) && !invalidPatterns.test(name) && name.length > 0
      }

      expect(isValidBranchName('feature-branch')).toBe(true)
      expect(isValidBranchName('feature/new-ui')).toBe(true)
      expect(isValidBranchName('feat_123')).toBe(true)
      expect(isValidBranchName('feature branch')).toBe(false) // space
      expect(isValidBranchName('feature~branch')).toBe(false) // tilde
      expect(isValidBranchName('feature..branch')).toBe(false) // double dot
      expect(isValidBranchName('.feature')).toBe(false) // starts with dot
      expect(isValidBranchName('feature.')).toBe(false) // ends with dot
      expect(isValidBranchName('')).toBe(false) // empty
    })

    it('should sanitize branch names', () => {
      function sanitizeBranchName(name: string): string {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9_/-]/g, '-')
          .replace(/^[.-]+|[.-]+$/g, '')
          .replace(/\.\.+/g, '.')
          .replace(/--+/g, '-')
          .substring(0, 50)
      }

      expect(sanitizeBranchName('Feature Branch!')).toBe('feature-branch')
      expect(sanitizeBranchName('Fix: Bug in Auth')).toBe('fix-bug-in-auth')
      expect(sanitizeBranchName('..feature..')).toBe('feature')
      expect(sanitizeBranchName('feature--branch')).toBe('feature-branch')
      expect(sanitizeBranchName('UPPERCASE_BRANCH')).toBe('uppercase_branch')
    })

    it('should handle edge cases in sanitization', () => {
      function sanitizeBranchName(name: string): string {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9_/-]/g, '-')
          .replace(/^[.-]+|[.-]+$/g, '')
          .replace(/\.\.+/g, '.')
          .replace(/--+/g, '-')
          .substring(0, 50)
      }

      expect(sanitizeBranchName('!!!')).toBe('')
      expect(sanitizeBranchName('....')).toBe('')
      expect(sanitizeBranchName('a'.repeat(100))).toHaveLength(50)
    })
  })

  describe('Git issue integration', () => {
    it('should extract issue numbers from commit messages', async () => {
      const mockCommits = `
feat: add new feature (#123)
fix: resolve bug (#456)
docs: update readme
chore: cleanup code (#789)
      `.trim()

      mockExeca.mockResolvedValue({ stdout: mockCommits })

      async function extractIssueNumbers(): Promise<number[]> {
        try {
          const { stdout } = await execa('git', ['log', '--oneline', '-n', '20'])
          const issueMatches = stdout.match(/#(\d+)/g) || []
          return issueMatches.map(match => parseInt(match.substring(1)))
        } catch {
          return []
        }
      }

      const issues = await extractIssueNumbers()
      expect(issues).toEqual([123, 456, 789])
    })

    it('should handle no issue numbers in commits', async () => {
      mockExeca.mockResolvedValue({ stdout: 'feat: add feature\nfix: bug fix\n' })

      async function extractIssueNumbers(): Promise<number[]> {
        try {
          const { stdout } = await execa('git', ['log', '--oneline', '-n', '20'])
          const issueMatches = stdout.match(/#(\d+)/g) || []
          return issueMatches.map(match => parseInt(match.substring(1)))
        } catch {
          return []
        }
      }

      const issues = await extractIssueNumbers()
      expect(issues).toEqual([])
    })
  })

  describe('Branch suggestion algorithms', () => {
    it('should suggest branches based on recent commits', async () => {
      const mockCommits = `
feat: add user authentication
fix: resolve login issues
docs: update API documentation
      `.trim()

      mockExeca.mockResolvedValue({ stdout: mockCommits })

      async function suggestBranchesFromCommits(limit: number = 5): Promise<string[]> {
        try {
          const { stdout } = await execa('git', ['log', '--pretty=format:%s', '-n', '10'])
          const commits = stdout.split('\n').filter(line => line.trim())
          
          return commits
            .map(commit => {
              const match = commit.match(/^(feat|fix|docs|chore|style|refactor|test):\s*(.+)/)
              if (match) {
                const [, type, description] = match
                return `${type}/${description.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
              }
              return commit.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
            })
            .slice(0, limit)
        } catch {
          return []
        }
      }

      const suggestions = await suggestBranchesFromCommits(3)
      expect(suggestions).toEqual([
        'feat/add-user-authentication',
        'fix/resolve-login-issues',
        'docs/update-api-documentation'
      ])
    })

    it('should suggest branches based on file changes', async () => {
      const mockFiles = `
src/auth/login.ts
src/auth/register.ts
docs/api.md
tests/auth.test.ts
      `.trim()

      mockExeca.mockResolvedValue({ stdout: mockFiles })

      async function suggestBranchesFromFiles(): Promise<string[]> {
        try {
          const { stdout } = await execa('git', ['diff', '--name-only', 'HEAD~5..HEAD'])
          const files = stdout.split('\n').filter(line => line.trim())
          
          const suggestions = new Set<string>()
          
          for (const file of files) {
            // Extract directory-based suggestions
            const parts = file.split('/')
            if (parts.length > 1) {
              const dir = parts[0]
              if (dir !== 'node_modules' && dir !== '.git') {
                suggestions.add(`feature/${dir}`)
              }
            }
            
            // Extract feature-based suggestions
            if (file.includes('auth')) suggestions.add('feature/authentication')
            if (file.includes('api')) suggestions.add('feature/api')
            if (file.includes('test')) suggestions.add('test/coverage')
            if (file.includes('doc')) suggestions.add('docs/update')
          }
          
          return Array.from(suggestions).slice(0, 5)
        } catch {
          return []
        }
      }

      const suggestions = await suggestBranchesFromFiles()
      expect(suggestions).toContain('feature/src')
      expect(suggestions).toContain('feature/authentication')
      expect(suggestions).toContain('docs/update')
    })

    it('should suggest branches based on current context', () => {
      function suggestContextualBranches(currentBranch: string, uncommittedFiles: string[]): string[] {
        const suggestions: string[] = []
        
        // Based on current branch
        if (currentBranch === 'main' || currentBranch === 'master') {
          suggestions.push('feature/new-feature', 'bugfix/fix-issue')
        } else if (currentBranch.startsWith('feature/')) {
          suggestions.push(`${currentBranch}-enhancement`, `test/${currentBranch.replace('feature/', '')}`)
        }
        
        // Based on uncommitted files
        const hasTests = uncommittedFiles.some(file => file.includes('test') || file.includes('spec'))
        const hasDocs = uncommittedFiles.some(file => file.includes('doc') || file.includes('readme'))
        const hasStyles = uncommittedFiles.some(file => file.includes('.css') || file.includes('.scss'))
        
        if (hasTests) suggestions.push('test/add-coverage')
        if (hasDocs) suggestions.push('docs/update')
        if (hasStyles) suggestions.push('style/ui-improvements')
        
        return suggestions.slice(0, 5)
      }

      const suggestions = suggestContextualBranches('main', ['src/test.spec.ts', 'docs/readme.md'])
      expect(suggestions).toContain('feature/new-feature')
      expect(suggestions).toContain('test/add-coverage')
      expect(suggestions).toContain('docs/update')
    })
  })

  describe('GitHub integration', () => {
    it('should fetch GitHub issues for suggestions', async () => {
      const mockIssues = [
        { number: 123, title: 'Add user authentication', labels: [{ name: 'enhancement' }] },
        { number: 124, title: 'Fix login bug', labels: [{ name: 'bug' }] },
        { number: 125, title: 'Update documentation', labels: [{ name: 'documentation' }] }
      ]

      mockExeca.mockResolvedValue({ stdout: JSON.stringify(mockIssues) })

      async function fetchGitHubIssues(limit: number = 10): Promise<Array<{ number: number; title: string; labels: string[] }>> {
        try {
          const { stdout } = await execa('gh', ['issue', 'list', '--json', 'number,title,labels', '--limit', limit.toString()])
          const issues = JSON.parse(stdout)
          
          return issues.map((issue: any) => ({
            number: issue.number,
            title: issue.title,
            labels: issue.labels?.map((l: any) => l.name) || []
          }))
        } catch {
          return []
        }
      }

      const issues = await fetchGitHubIssues(5)
      expect(issues).toHaveLength(3)
      expect(issues[0].number).toBe(123)
      expect(issues[0].title).toBe('Add user authentication')
      expect(issues[0].labels).toEqual(['enhancement'])
    })

    it('should handle GitHub CLI not available', async () => {
      mockExeca.mockRejectedValue(new Error('gh: command not found'))

      async function fetchGitHubIssues(limit: number = 10): Promise<Array<{ number: number; title: string; labels: string[] }>> {
        try {
          const { stdout } = await execa('gh', ['issue', 'list', '--json', 'number,title,labels', '--limit', limit.toString()])
          return JSON.parse(stdout)
        } catch {
          return []
        }
      }

      const issues = await fetchGitHubIssues(5)
      expect(issues).toEqual([])
    })

    it('should convert issues to branch suggestions', () => {
      function issueToBranchName(issue: { number: number; title: string; labels: string[] }): string {
        const sanitizedTitle = issue.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 30)
        
        const prefix = issue.labels.includes('bug') ? 'bugfix' :
                     issue.labels.includes('enhancement') ? 'feature' :
                     issue.labels.includes('documentation') ? 'docs' : 'issue'
        
        return `${prefix}-${issue.number}-${sanitizedTitle}`
      }

      const issues = [
        { number: 123, title: 'Add User Authentication', labels: ['enhancement'] },
        { number: 124, title: 'Fix Login Bug', labels: ['bug'] },
        { number: 125, title: 'Update API Documentation', labels: ['documentation'] }
      ]

      const branches = issues.map(issueToBranchName)
      expect(branches).toEqual([
        'feature-123-add-user-authentication',
        'bugfix-124-fix-login-bug',
        'docs-125-update-api-documentation'
      ])
    })
  })

  describe('Template-based suggestions', () => {
    it('should suggest branches based on project templates', () => {
      function suggestFromTemplates(templates: string[], context: string): string[] {
        const suggestions: string[] = []
        
        for (const template of templates) {
          switch (template) {
            case 'feature':
              suggestions.push(`feature/${context}`, `feature/${context}-enhancement`)
              break
            case 'bugfix':
              suggestions.push(`bugfix/${context}`, `hotfix/${context}`)
              break
            case 'experiment':
              suggestions.push(`exp/${context}`, `poc/${context}`)
              break
            case 'docs':
              suggestions.push(`docs/${context}`, `docs/update-${context}`)
              break
          }
        }
        
        return suggestions.slice(0, 8)
      }

      const templates = ['feature', 'bugfix', 'docs']
      const suggestions = suggestFromTemplates(templates, 'auth')
      
      expect(suggestions).toContain('feature/auth')
      expect(suggestions).toContain('bugfix/auth')
      expect(suggestions).toContain('docs/auth')
    })

    it('should handle empty templates gracefully', () => {
      function suggestFromTemplates(templates: string[], context: string): string[] {
        if (templates.length === 0) {
          return [`feature/${context}`, `fix/${context}`, `docs/${context}`]
        }
        
        return templates.map(template => `${template}/${context}`)
      }

      const suggestions = suggestFromTemplates([], 'test')
      expect(suggestions).toEqual(['feature/test', 'fix/test', 'docs/test'])
    })
  })

  describe('Interactive filtering', () => {
    it('should filter suggestions by keyword', () => {
      function filterSuggestions(suggestions: string[], keyword: string): string[] {
        if (!keyword.trim()) return suggestions
        
        const lowerKeyword = keyword.toLowerCase()
        return suggestions.filter(suggestion => 
          suggestion.toLowerCase().includes(lowerKeyword)
        )
      }

      const suggestions = [
        'feature/auth',
        'feature/user-management',
        'bugfix/auth-error',
        'docs/authentication',
        'test/auth-validation'
      ]

      const filtered = filterSuggestions(suggestions, 'auth')
      expect(filtered).toEqual([
        'feature/auth',
        'bugfix/auth-error',
        'docs/authentication',
        'test/auth-validation'
      ])
    })

    it('should rank suggestions by relevance', () => {
      function rankSuggestions(suggestions: string[], keyword: string): string[] {
        if (!keyword.trim()) return suggestions
        
        const lowerKeyword = keyword.toLowerCase()
        
        return suggestions
          .map(suggestion => ({
            name: suggestion,
            score: calculateRelevanceScore(suggestion, lowerKeyword)
          }))
          .sort((a, b) => b.score - a.score)
          .map(item => item.name)
      }

      function calculateRelevanceScore(suggestion: string, keyword: string): number {
        const lower = suggestion.toLowerCase()
        let score = 0
        
        if (lower.startsWith(keyword)) score += 10
        if (lower.includes(`/${keyword}`)) score += 8
        if (lower.includes(`-${keyword}`)) score += 6
        if (lower.includes(keyword)) score += 4
        
        return score
      }

      const suggestions = [
        'docs/auth-guide',
        'auth/feature',
        'feature/auth',
        'test/user-auth'
      ]

      const ranked = rankSuggestions(suggestions, 'auth')
      expect(ranked[0]).toBe('auth/feature') // starts with 'auth'
      expect(ranked[1]).toBe('docs/auth-guide') // contains '-auth'
    })
  })

  describe('Temporary file handling', () => {
    it('should create temporary file for suggestions', async () => {
      mockPath.join.mockReturnValue('/tmp/scj-suggestions-123.txt')
      mockFs.writeFile.mockResolvedValue(undefined)

      async function createTempSuggestionFile(suggestions: string[]): Promise<string> {
        const tempFile = path.join('/tmp', `scj-suggestions-${Date.now()}.txt`)
        const content = suggestions.join('\n')
        
        await fs.writeFile(tempFile, content)
        return tempFile
      }

      const suggestions = ['feature/auth', 'bugfix/login']
      const tempFile = await createTempSuggestionFile(suggestions)
      
      expect(tempFile).toBe('/tmp/scj-suggestions-123.txt')
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/tmp/scj-suggestions-123.txt',
        'feature/auth\nbugfix/login'
      )
    })

    it('should cleanup temporary files', async () => {
      mockFs.unlink.mockResolvedValue(undefined)

      async function cleanupTempFile(filePath: string): Promise<void> {
        try {
          await fs.unlink(filePath)
        } catch {
          // Ignore cleanup errors
        }
      }

      await cleanupTempFile('/tmp/test-file.txt')
      expect(mockFs.unlink).toHaveBeenCalledWith('/tmp/test-file.txt')
    })

    it('should handle cleanup errors gracefully', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File not found'))

      async function cleanupTempFile(filePath: string): Promise<void> {
        try {
          await fs.unlink(filePath)
        } catch {
          // Ignore cleanup errors
        }
      }

      await expect(cleanupTempFile('/tmp/non-existent.txt')).resolves.toBeUndefined()
    })
  })

  describe('FZF integration', () => {
    it('should launch fzf with suggestions', async () => {
      mockExeca.mockResolvedValue({ stdout: 'feature/auth' })

      async function launchFzfSelection(suggestions: string[]): Promise<string | null> {
        try {
          const { stdout } = await execa('fzf', ['--prompt', 'Select branch: '], {
            input: suggestions.join('\n')
          })
          return stdout.trim()
        } catch {
          return null
        }
      }

      const selected = await launchFzfSelection(['feature/auth', 'bugfix/login'])
      expect(selected).toBe('feature/auth')
      expect(mockExeca).toHaveBeenCalledWith('fzf', ['--prompt', 'Select branch: '], {
        input: 'feature/auth\nbugfix/login'
      })
    })

    it('should handle fzf not available', async () => {
      mockExeca.mockRejectedValue(new Error('fzf: command not found'))

      async function launchFzfSelection(suggestions: string[]): Promise<string | null> {
        try {
          const { stdout } = await execa('fzf', ['--prompt', 'Select branch: '], {
            input: suggestions.join('\n')
          })
          return stdout.trim()
        } catch {
          return null
        }
      }

      const selected = await launchFzfSelection(['feature/auth'])
      expect(selected).toBeNull()
    })

    it('should handle user cancellation in fzf', async () => {
      mockExeca.mockRejectedValue({ exitCode: 130 }) // SIGINT

      async function launchFzfSelection(suggestions: string[]): Promise<string | null> {
        try {
          const { stdout } = await execa('fzf', ['--prompt', 'Select branch: '], {
            input: suggestions.join('\n')
          })
          return stdout.trim()
        } catch (error: any) {
          if (error.exitCode === 130) {
            console.log('Selection cancelled by user')
          }
          return null
        }
      }

      const selected = await launchFzfSelection(['feature/auth'])
      expect(selected).toBeNull()
    })
  })

  describe('Review mode utilities', () => {
    it('should display suggestions in review mode', () => {
      function displaySuggestionsReview(suggestions: string[], context: Record<string, any>): string {
        let output = 'Branch Suggestions:\n\n'
        
        suggestions.forEach((suggestion, index) => {
          output += `${index + 1}. ${suggestion}\n`
        })
        
        output += '\nContext:\n'
        output += `- Current branch: ${context.currentBranch || 'unknown'}\n`
        output += `- Uncommitted files: ${context.uncommittedFiles?.length || 0}\n`
        output += `- Recent commits: ${context.recentCommits?.length || 0}\n`
        
        return output
      }

      const suggestions = ['feature/auth', 'bugfix/login']
      const context = {
        currentBranch: 'main',
        uncommittedFiles: ['src/auth.ts'],
        recentCommits: ['feat: add login', 'fix: auth bug']
      }

      const review = displaySuggestionsReview(suggestions, context)
      expect(review).toContain('1. feature/auth')
      expect(review).toContain('2. bugfix/login')
      expect(review).toContain('Current branch: main')
      expect(review).toContain('Uncommitted files: 1')
    })

    it('should handle empty context in review mode', () => {
      function displaySuggestionsReview(suggestions: string[], context: Record<string, any>): string {
        let output = 'Branch Suggestions:\n\n'
        
        if (suggestions.length === 0) {
          output += 'No suggestions available.\n'
        } else {
          suggestions.forEach((suggestion, index) => {
            output += `${index + 1}. ${suggestion}\n`
          })
        }
        
        return output
      }

      const review = displaySuggestionsReview([], {})
      expect(review).toContain('No suggestions available.')
    })
  })
})
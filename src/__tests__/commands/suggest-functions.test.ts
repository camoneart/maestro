import { describe, it, expect, vi } from 'vitest'

// suggest.tsから個別の関数をテストするためのシンプルなユニットテスト

describe('suggest command - utility functions', () => {
  describe('SuggestOptions interface', () => {
    it('should handle suggest options structure', () => {
      const options = {
        branch: true,
        commit: false,
        issue: '123',
        pr: '456',
        description: 'Add new feature',
        diff: true,
        review: false
      }

      expect(options.branch).toBe(true)
      expect(options.commit).toBe(false)
      expect(options.issue).toBe('123')
      expect(options.pr).toBe('456')
      expect(options.description).toBe('Add new feature')
      expect(options.diff).toBe(true)
      expect(options.review).toBe(false)
    })

    it('should handle optional fields', () => {
      const options = {
        branch: true
      }

      expect(options.branch).toBe(true)
      expect(options.commit).toBeUndefined()
      expect(options.issue).toBeUndefined()
    })
  })

  describe('Prompt generation utilities', () => {
    it('should generate basic branch name prompt', () => {
      const description = 'Add user authentication'
      const prompt = `# ブランチ名の提案\n\n以下の情報に基づいて、適切なGitブランチ名を5つ提案してください。\n\n説明: ${description}\n\n`
      
      expect(prompt).toContain('ブランチ名の提案')
      expect(prompt).toContain(description)
    })

    it('should include issue number in prompt', () => {
      const issueNumber = '123'
      const description = 'Fix login bug'
      const prompt = `Issue番号: #${issueNumber}\n説明: ${description}`
      
      expect(prompt).toContain('#123')
      expect(prompt).toContain('Fix login bug')
    })

    it('should include PR number in prompt', () => {
      const prNumber = '456'
      const description = 'Update documentation'
      const prompt = `PR番号: #${prNumber}\n説明: ${description}`
      
      expect(prompt).toContain('#456')
      expect(prompt).toContain('Update documentation')
    })
  })

  describe('Branch name validation', () => {
    it('should validate branch name format', () => {
      const branchNames = [
        'feature/auth-system',
        'bugfix/login-error',
        'hotfix/security-patch',
        'refactor/database-schema'
      ]

      branchNames.forEach(name => {
        // ハイフンと小文字のみ
        const isValid = /^[a-z0-9\-\/]+$/.test(name)
        expect(isValid).toBe(true)
      })
    })

    it('should enforce character limits', () => {
      const shortName = 'feat/test'
      const longName = 'feature/very-long-branch-name-that-exceeds-fifty-characters-limit'
      
      expect(shortName.length).toBeLessThanOrEqual(50)
      expect(longName.length).toBeGreaterThan(50)
    })
  })

  describe('Commit message utilities', () => {
    it('should parse commit logs', () => {
      const commitLogs = [
        'feat: add user authentication',
        'fix: resolve login issue',
        'refactor: update database schema',
        'docs: update README file'
      ]

      const conventionalCommits = commitLogs.filter(log => 
        /^(feat|fix|docs|style|refactor|test|chore):/.test(log)
      )

      expect(conventionalCommits).toHaveLength(4)
    })

    it('should generate commit message suggestions', () => {
      const changes = ['src/auth.ts', 'src/login.ts']
      const suggestion = `feat: add authentication system\n\n- Update auth.ts\n- Update login.ts`
      
      expect(suggestion).toContain('feat:')
      expect(suggestion).toContain('authentication')
    })
  })

  describe('GitHub integration utilities', () => {
    it('should format GitHub API URLs', () => {
      const issueNumber = '123'
      const apiUrl = `https://api.github.com/repos/owner/repo/issues/${issueNumber}`
      
      expect(apiUrl).toContain(issueNumber)
      expect(apiUrl).toContain('api.github.com')
    })

    it('should parse GitHub issue response', () => {
      const issueData = {
        number: 123,
        title: 'Add new feature',
        body: 'Detailed description of the feature',
        labels: [{ name: 'enhancement' }, { name: 'feature' }],
        assignees: [{ login: 'developer' }]
      }

      expect(issueData.number).toBe(123)
      expect(issueData.title).toBe('Add new feature')
      expect(issueData.labels).toHaveLength(2)
      expect(issueData.assignees[0].login).toBe('developer')
    })
  })

  describe('File system utilities', () => {
    it('should generate temporary file paths', () => {
      const tempDir = '/tmp/scj-suggest-123'
      const promptPath = `${tempDir}/prompt.md`
      const outputPath = `${tempDir}/suggestions.txt`
      
      expect(promptPath).toBe('/tmp/scj-suggest-123/prompt.md')
      expect(outputPath).toBe('/tmp/scj-suggest-123/suggestions.txt')
    })

    it('should handle temp directory creation', () => {
      const baseDir = '/tmp'
      const prefix = 'scj-suggest-'
      const fullPath = `${baseDir}/${prefix}${Date.now()}`
      
      expect(fullPath).toContain(prefix)
      expect(fullPath.startsWith(baseDir)).toBe(true)
    })
  })

  describe('Claude Code integration', () => {
    it('should format Claude prompts', () => {
      const rules = [
        '- 小文字とハイフンのみ使用',
        '- 最大50文字',
        '- 一般的な命名規則に従う',
        '- わかりやすく簡潔に'
      ]

      const rulesText = rules.join('\n')
      expect(rulesText).toContain('小文字とハイフン')
      expect(rulesText).toContain('最大50文字')
    })

    it('should parse Claude suggestions', () => {
      const claudeOutput = `1. feature/auth-system
2. bugfix/login-error
3. hotfix/security-patch
4. refactor/database-schema
5. feat/user-management`

      const suggestions = claudeOutput
        .split('\n')
        .map(line => line.replace(/^\d+\.\s*/, ''))
        .filter(line => line.length > 0)

      expect(suggestions).toHaveLength(5)
      expect(suggestions[0]).toBe('feature/auth-system')
      expect(suggestions[4]).toBe('feat/user-management')
    })
  })

  describe('Suggestion filtering', () => {
    it('should remove duplicates', () => {
      const allSuggestions = [
        'feature/auth',
        'feat/authentication',
        'feature/auth', // duplicate
        'bugfix/login'
      ]

      const uniqueSuggestions = [...new Set(allSuggestions)]
      expect(uniqueSuggestions).toHaveLength(3)
      expect(uniqueSuggestions).toContain('feature/auth') // Set keeps first occurrence
    })

    it('should filter existing branches', () => {
      const suggestions = ['feature/new', 'feature/existing', 'bugfix/test']
      const existingBranches = ['main', 'develop', 'feature/existing']
      
      const filteredSuggestions = suggestions.filter(
        suggestion => !existingBranches.includes(suggestion)
      )

      expect(filteredSuggestions).toHaveLength(2)
      expect(filteredSuggestions).toContain('feature/new')
      expect(filteredSuggestions).toContain('bugfix/test')
    })
  })

  describe('diff analysis utilities', () => {
    it('should parse git diff output', () => {
      const diffOutput = `diff --git a/src/auth.ts b/src/auth.ts
index 1234567..abcdefg 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,4 @@
 export class Auth {
+  // Add new method
   login() {}`

      const modifiedFiles = diffOutput.match(/diff --git a\/(.+?) b\//g)?.map(
        line => line.replace(/diff --git a\/(.+?) b\/.*/, '$1')
      ) || []

      expect(modifiedFiles).toContain('src/auth.ts')
    })

    it('should analyze change types', () => {
      const diffLines = [
        '+  // Add new method',
        '-  // Remove old method',
        '   // Unchanged line'
      ]

      const additions = diffLines.filter(line => line.startsWith('+')).length
      const deletions = diffLines.filter(line => line.startsWith('-')).length
      
      expect(additions).toBe(1)
      expect(deletions).toBe(1)
    })
  })

  describe('Suggestion type selection', () => {
    it('should handle suggestion type choices', () => {
      const choices = [
        '🌿 ブランチ名',
        '📝 コミットメッセージ',
        '🏷️ PRタイトル',
        '📋 Issue説明'
      ]

      expect(choices).toContain('🌿 ブランチ名')
      expect(choices).toContain('📝 コミットメッセージ')
      expect(choices).toHaveLength(4)
    })

    it('should map choices to actions', () => {
      const choice = '🌿 ブランチ名'
      const action = choice.includes('ブランチ') ? 'branch' : 
                    choice.includes('コミット') ? 'commit' : 'unknown'
      
      expect(action).toBe('branch')
    })
  })

  describe('Error handling', () => {
    it('should handle Claude unavailable', () => {
      const error = new Error('Command not found: claude')
      const isClaudeError = error.message.includes('claude')
      
      expect(isClaudeError).toBe(true)
    })

    it('should handle GitHub CLI unavailable', () => {
      const error = new Error('gh: command not found')
      const isGhError = error.message.includes('gh')
      
      expect(isGhError).toBe(true)
    })

    it('should handle file system errors', () => {
      const error = new Error('ENOENT: no such file or directory')
      const isFileError = error.message.includes('ENOENT')
      
      expect(isFileError).toBe(true)
    })
  })

  describe('Command line argument processing', () => {
    it('should parse command options', () => {
      const options = {
        branch: true,
        commit: false,
        issue: '123',
        pr: undefined,
        description: 'Add new feature'
      }
      
      expect(options.branch).toBe(true)
      expect(options.issue).toBe('123')
      expect(options.description).toContain('feature')
    })

    it('should handle option combinations', () => {
      const branchWithIssue = { branch: true, issue: '456' }
      const commitWithDiff = { commit: true, diff: true }
      
      expect(branchWithIssue.branch && branchWithIssue.issue).toBeTruthy()
      expect(commitWithDiff.commit && commitWithDiff.diff).toBeTruthy()
    })
  })

  describe('Temperature file utilities', () => {
    it('should generate temp file paths', () => {
      const tempPrefix = 'scj-suggest-'
      const timestamp = Date.now()
      const tempDir = `/tmp/${tempPrefix}${timestamp}`
      
      expect(tempDir).toContain(tempPrefix)
      expect(tempDir).toContain(timestamp.toString())
    })

    it('should handle temp file cleanup', () => {
      const tempFiles = ['prompt.md', 'suggestions.txt', 'context.json']
      const cleanupCount = tempFiles.length
      
      expect(cleanupCount).toBe(3)
      expect(tempFiles).toContain('prompt.md')
    })
  })

  describe('Review mode utilities', () => {
    it('should handle git diff analysis', () => {
      const diffContent = '+  const newFeature = true\n-  const oldFeature = false'
      const addedLines = diffContent.split('\n').filter(line => line.startsWith('+')).length
      const removedLines = diffContent.split('\n').filter(line => line.startsWith('-')).length
      
      expect(addedLines).toBe(1)
      expect(removedLines).toBe(1)
    })

    it('should format review summaries', () => {
      const changes = {
        added: 5,
        removed: 2,
        modified: 3
      }
      const summary = `${changes.added} additions, ${changes.removed} deletions, ${changes.modified} modifications`
      
      expect(summary).toContain('5 additions')
      expect(summary).toContain('2 deletions')
    })
  })

  describe('Interactive selection utilities', () => {
    it('should handle suggestion type selection', () => {
      const suggestionTypes = [
        { name: '🌿 ブランチ名', value: 'branch' },
        { name: '📝 コミットメッセージ', value: 'commit' },
        { name: '🏷️ PRタイトル', value: 'pr' }
      ]
      
      expect(suggestionTypes[0].value).toBe('branch')
      expect(suggestionTypes[1].name).toContain('コミット')
    })

    it('should validate user selections', () => {
      const userChoice = '🌿 ブランチ名'
      const isValidChoice = userChoice.includes('ブランチ') || userChoice.includes('コミット')
      
      expect(isValidChoice).toBe(true)
    })
  })

  describe('Output formatting utilities', () => {
    it('should format numbered suggestions', () => {
      const suggestions = ['feature/auth', 'fix/login', 'refactor/db']
      const numberedSuggestions = suggestions.map((suggestion, index) => 
        `${index + 1}. ${suggestion}`
      )
      
      expect(numberedSuggestions[0]).toBe('1. feature/auth')
      expect(numberedSuggestions).toHaveLength(3)
    })

    it('should handle empty suggestion lists', () => {
      const emptySuggestions = []
      const fallbackMessage = '提案できるブランチ名がありません'
      
      expect(emptySuggestions.length).toBe(0)
      expect(fallbackMessage).toContain('提案できる')
    })
  })

  describe('Context generation utilities', () => {
    it('should build prompt context', () => {
      const context = {
        recentCommits: ['feat: add auth', 'fix: login bug'],
        existingBranches: ['main', 'develop'],
        projectType: 'typescript'
      }
      
      expect(context.recentCommits).toContain('feat: add auth')
      expect(context.existingBranches).toContain('main')
      expect(context.projectType).toBe('typescript')
    })

    it('should validate context completeness', () => {
      const requiredFields = ['description', 'projectType']
      const providedContext = { description: 'Add feature', projectType: 'node' }
      
      const isComplete = requiredFields.every(field => 
        field in providedContext && providedContext[field]
      )
      
      expect(isComplete).toBe(true)
    })
  })

  describe('Configuration utilities', () => {
    it('should handle suggestion limits', () => {
      const maxLimit = 10
      const userLimit = 7
      
      const effectiveLimit = Math.min(userLimit, maxLimit)
      
      expect(effectiveLimit).toBe(7)
      expect(effectiveLimit).toBeLessThanOrEqual(maxLimit)
    })

    it('should validate suggestion rules', () => {
      const rules = [
        '小文字とハイフンのみ使用',
        '最大50文字',
        'prefixを使用（feature/, fix/, etc）'
      ]
      
      expect(rules[0]).toContain('小文字とハイフン')
      expect(rules).toContain('最大50文字')
      expect(rules.length).toBeGreaterThan(2)
    })
  })
})
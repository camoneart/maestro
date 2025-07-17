import { describe, expect, it } from 'vitest'
import {
  filterDuplicateSuggestions,
  formatSuggestions,
  parseClaudeResponse,
  createCommitPrompt,
} from '../../commands/suggest.js'

describe('suggest command functions', () => {
  describe('filterDuplicateSuggestions', () => {
    it('should remove exact duplicates', () => {
      const input = ['feature/login', 'feature/auth', 'feature/login', 'fix/bug']
      const result = filterDuplicateSuggestions(input)
      expect(result).toEqual(['feature/login', 'feature/auth', 'fix/bug'])
    })

    it('should preserve order', () => {
      const input = ['second', 'first', 'second', 'third', 'first']
      const result = filterDuplicateSuggestions(input)
      expect(result).toEqual(['second', 'first', 'third'])
    })

    it('should handle empty arrays', () => {
      expect(filterDuplicateSuggestions([])).toEqual([])
    })

    it('should handle single items', () => {
      expect(filterDuplicateSuggestions(['single'])).toEqual(['single'])
    })

    it('should be case sensitive', () => {
      const input = ['Feature', 'feature', 'FEATURE']
      const result = filterDuplicateSuggestions(input)
      expect(result).toEqual(['Feature', 'feature', 'FEATURE'])
    })

    it('should preserve whitespace differences', () => {
      const input = [' feature ', 'feature', ' feature']
      const result = filterDuplicateSuggestions(input)
      expect(result).toEqual([' feature ', 'feature', ' feature'])
    })
  })

  describe('formatSuggestions', () => {
    it('should format numbered list correctly', () => {
      const input = ['feature/login', 'feature/auth', 'fix/bug']
      const result = formatSuggestions(input)
      expect(result).toBe('1. feature/login\n2. feature/auth\n3. fix/bug')
    })

    it('should handle single item', () => {
      const result = formatSuggestions(['feature/test'])
      expect(result).toBe('1. feature/test')
    })

    it('should handle empty array', () => {
      expect(formatSuggestions([])).toBe('')
    })

    it('should handle many items', () => {
      const manyItems = Array.from({ length: 10 }, (_, i) => `item-${i + 1}`)
      const result = formatSuggestions(manyItems)
      expect(result).toContain('10. item-10')
      expect(result.split('\n')).toHaveLength(10)
    })

    it('should handle special characters', () => {
      const input = ['feature/$pecial', 'fix/unicode-🚀', 'test/quotes-"test"']
      const result = formatSuggestions(input)
      expect(result).toContain('1. feature/$pecial')
      expect(result).toContain('2. fix/unicode-🚀')
      expect(result).toContain('3. test/quotes-"test"')
    })

    it('should handle multiline suggestions', () => {
      const input = ['feature/test\nwith newline', 'normal-suggestion']
      const result = formatSuggestions(input)
      expect(result).toContain('1. feature/test\nwith newline')
      expect(result).toContain('2. normal-suggestion')
    })
  })

  describe('parseClaudeResponse', () => {
    it('should parse standard numbered format', () => {
      const response = `1. feature/user-authentication
2. feature/login-system
3. fix/auth-bug`

      const result = parseClaudeResponse(response)
      expect(result).toEqual([
        'feature/user-authentication',
        'feature/login-system',
        'fix/auth-bug',
      ])
    })

    it('should ignore non-numbered lines', () => {
      const response = `Here are suggestions:
1. feature/test
Some explanatory text
2. fix/bug
- Not numbered
3. enhancement/ui`

      const result = parseClaudeResponse(response)
      expect(result).toEqual(['feature/test', 'fix/bug', 'enhancement/ui'])
    })

    it('should trim whitespace', () => {
      const response = `1.   feature/test   
2.  fix/bug  
3. enhancement/ui    `

      const result = parseClaudeResponse(response)
      expect(result).toEqual(['feature/test', 'fix/bug', 'enhancement/ui'])
    })

    it('should handle empty response', () => {
      expect(parseClaudeResponse('')).toEqual([])
    })

    it('should handle response with no matches', () => {
      const response = `Here are some suggestions:
- Not numbered
* Also not numbered
Just plain text`

      expect(parseClaudeResponse(response)).toEqual([])
    })

    it('should handle mixed formatting', () => {
      const response = `1. **feature/login** - User authentication
2. *fix/bug* - Bug fix
3. enhancement/ui (UI improvements)`

      const result = parseClaudeResponse(response)
      expect(result).toEqual([
        '**feature/login** - User authentication',
        '*fix/bug* - Bug fix',
        'enhancement/ui (UI improvements)',
      ])
    })

    it('should handle out-of-order numbers', () => {
      const response = `3. third-item
1. first-item
2. second-item`

      const result = parseClaudeResponse(response)
      expect(result).toEqual(['third-item', 'first-item', 'second-item'])
    })

    it('should handle numbers with extra formatting', () => {
      const response = `1. feature/test
10. feature/tenth
2. feature/second`

      const result = parseClaudeResponse(response)
      expect(result).toEqual(['feature/test', 'feature/tenth', 'feature/second'])
    })
  })

  describe('createCommitPrompt', () => {
    it('should create conventional commit prompt', () => {
      const diff = '+  added new function\n-  removed old code'
      const options = { type: 'conventional' as const }

      const result = createCommitPrompt(diff, options)

      expect(result).toContain('# コミットメッセージの提案')
      expect(result).toContain('Conventional Commits形式で')
      expect(result).toContain('type(scope): description')
      expect(result).toContain('feat, fix, docs, style, refactor, test, chore')
      expect(result).toContain(diff)
      expect(result).toContain('最大72文字')
    })

    it('should create standard commit prompt', () => {
      const diff = '+  added new function'
      const options = { type: 'standard' as const }

      const result = createCommitPrompt(diff, options)

      expect(result).toContain('# コミットメッセージの提案')
      expect(result).toContain(diff)
      expect(result).not.toContain('Conventional Commits')
      expect(result).toContain('最大72文字')
    })

    it('should include scope in conventional commits', () => {
      const diff = '+  auth changes'
      const options = { type: 'conventional' as const, scope: 'auth' }

      const result = createCommitPrompt(diff, options)
      expect(result).toContain('scope: auth')
    })

    it('should handle custom max length', () => {
      const diff = '+  test'
      const options = { type: 'conventional' as const, maxLength: 50 }

      const result = createCommitPrompt(diff, options)
      expect(result).toContain('最大50文字')
    })

    it('should handle empty diff', () => {
      const result = createCommitPrompt('', { type: 'conventional' })
      expect(result).toContain('```diff\n\n```')
    })

    it('should handle default options', () => {
      const diff = '+  test change'
      const result = createCommitPrompt(diff, {})

      // Should default to conventional
      expect(result).toContain('Conventional Commits形式で')
      expect(result).toContain('最大72文字')
    })

    it('should handle multiline diff', () => {
      const diff = `+  added line 1
+  added line 2
-  removed line 1
   unchanged line`

      const result = createCommitPrompt(diff, { type: 'standard' })
      expect(result).toContain(diff)
    })

    it('should handle diff with special characters', () => {
      const diff = '+  added "quotes" and \\backslashes\n-  removed $pecial characters'
      const result = createCommitPrompt(diff, { type: 'conventional' })
      expect(result).toContain(diff)
    })
  })

  describe('edge cases and robustness', () => {
    it('should handle very long suggestion lists', () => {
      const longList = Array.from({ length: 100 }, (_, i) => `suggestion-${i}`)
      const result = formatSuggestions(longList)
      expect(result).toContain('100. suggestion-99')
      expect(result.split('\n')).toHaveLength(100)
    })

    it('should handle unicode in all functions', () => {
      const unicode = ['🚀feature/rocket', '🔥fix/fire', '⭐enhancement/star']

      // Test filtering
      const filtered = filterDuplicateSuggestions([...unicode, unicode[0]])
      expect(filtered).toEqual(unicode)

      // Test formatting
      const formatted = formatSuggestions(unicode)
      expect(formatted).toContain('1. 🚀feature/rocket')
      expect(formatted).toContain('2. 🔥fix/fire')
      expect(formatted).toContain('3. ⭐enhancement/star')
    })

    it('should handle very large diff content', () => {
      const largeDiff = '+  new line\n'.repeat(1000)
      const result = createCommitPrompt(largeDiff, { type: 'conventional' })
      expect(result).toContain(largeDiff)
      expect(result.length).toBeGreaterThan(5000)
    })

    it('should parse Claude response with unusual spacing', () => {
      const response = `  1.  feature/test  
    2.    fix/bug    
3.enhancement/ui`

      const result = parseClaudeResponse(response)
      // The regex pattern /^\d+\.\s*(.+)$/ requires line start with number
      // Lines with leading spaces don't match
      expect(result).toEqual(['enhancement/ui'])
    })

    it('should handle commitPrompt with all options', () => {
      const diff = '+  comprehensive test'
      const options = {
        type: 'conventional' as const,
        scope: 'test-scope',
        maxLength: 100,
      }

      const result = createCommitPrompt(diff, options)
      expect(result).toContain('scope: test-scope')
      expect(result).toContain('最大100文字')
      expect(result).toContain('Conventional Commits形式で')
    })
  })
})

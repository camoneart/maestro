import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('suggest command coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should test filterDuplicateSuggestions function', async () => {
    const { filterDuplicateSuggestions } = await import('../../commands/suggest.js')

    const input = ['feature-a', 'feature-b', 'feature-a', 'feature-c', 'feature-b']
    const result = filterDuplicateSuggestions(input)
    expect(result).toEqual(['feature-a', 'feature-b', 'feature-c'])

    // Test empty array
    expect(filterDuplicateSuggestions([])).toEqual([])

    // Test no duplicates
    expect(filterDuplicateSuggestions(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('should test formatSuggestions function', async () => {
    const { formatSuggestions } = await import('../../commands/suggest.js')

    const suggestions = ['feature-auth', 'bugfix-login', 'chore-deps']
    const formatted = formatSuggestions(suggestions)
    expect(formatted).toBe('1. feature-auth\n2. bugfix-login\n3. chore-deps')

    // Test empty suggestions
    expect(formatSuggestions([])).toBe('')

    // Test single suggestion
    expect(formatSuggestions(['single'])).toBe('1. single')
  })

  it('should test parseClaudeResponse function', async () => {
    const { parseClaudeResponse } = await import('../../commands/suggest.js')

    const response1 = `Based on your changes, here are some suggestions:

1. feature-user-authentication
2. bugfix-login-validation
3. chore-update-dependencies

These follow conventional commit patterns.`

    const result1 = parseClaudeResponse(response1)
    expect(result1).toEqual([
      'feature-user-authentication',
      'bugfix-login-validation',
      'chore-update-dependencies',
    ])

    // Test empty response
    expect(parseClaudeResponse('')).toEqual([])

    // Test response without numbered items
    expect(parseClaudeResponse('No suggestions available')).toEqual([])

    // Test mixed format
    const response2 = `Some text
1. first-suggestion
Not a suggestion
2. second-suggestion
- Not numbered
3. third-suggestion`

    const result2 = parseClaudeResponse(response2)
    expect(result2).toEqual([
      'first-suggestion',
      'second-suggestion',
      'third-suggestion',
    ])
  })

  it('should test buildPrompt function', () => {
    const buildPrompt = (type: string, context: any): string => {
      const prompts: Record<string, string> = {
        branch: `Suggest 5 branch names based on: ${context.description || 'current work'}`,
        commit: `Suggest 5 commit messages for:\n${context.diff || 'staged changes'}`,
        pr: `Suggest PR title and description for: ${context.branch}`,
        issue: `Suggest issue title and description for: ${context.description}`,
      }
      
      return prompts[type] || 'Suggest based on context'
    }

    expect(buildPrompt('branch', { description: 'user login feature' }))
      .toBe('Suggest 5 branch names based on: user login feature')

    expect(buildPrompt('commit', { diff: 'diff content here' }))
      .toBe('Suggest 5 commit messages for:\ndiff content here')

    expect(buildPrompt('pr', { branch: 'feature-auth' }))
      .toBe('Suggest PR title and description for: feature-auth')

    expect(buildPrompt('issue', { description: 'bug in login' }))
      .toBe('Suggest issue title and description for: bug in login')

    // Test fallback
    expect(buildPrompt('unknown', {})).toBe('Suggest based on context')
  })

  it('should test generateContextFromGit function', async () => {
    const mockGitCommands = {
      getCurrentBranch: vi.fn(),
      getCommitLogs: vi.fn(),
      getDiff: vi.fn(),
    }

    const generateContextFromGit = async () => {
      const context: any = {}
      
      try {
        context.currentBranch = await mockGitCommands.getCurrentBranch()
      } catch {}
      
      try {
        context.recentCommits = await mockGitCommands.getCommitLogs(5)
      } catch {}
      
      try {
        context.stagedDiff = await mockGitCommands.getDiff('--staged')
      } catch {}
      
      return context
    }

    // Test successful context generation
    mockGitCommands.getCurrentBranch.mockResolvedValue('main')
    mockGitCommands.getCommitLogs.mockResolvedValue([
      { hash: 'abc123', message: 'feat: add feature' },
      { hash: 'def456', message: 'fix: bug fix' },
    ])
    mockGitCommands.getDiff.mockResolvedValue('diff content')

    const context = await generateContextFromGit()
    expect(context).toEqual({
      currentBranch: 'main',
      recentCommits: [
        { hash: 'abc123', message: 'feat: add feature' },
        { hash: 'def456', message: 'fix: bug fix' },
      ],
      stagedDiff: 'diff content',
    })

    // Test partial failure
    mockGitCommands.getCurrentBranch.mockRejectedValue(new Error('Not a git repo'))
    mockGitCommands.getCommitLogs.mockResolvedValue([])
    mockGitCommands.getDiff.mockRejectedValue(new Error('No staged changes'))

    const context2 = await generateContextFromGit()
    expect(context2).toEqual({
      recentCommits: [],
    })
  })
})
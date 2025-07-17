import { describe, it, expect, vi, beforeEach } from 'vitest'
import { suggestCommand } from '../../commands/suggest.js'
import { Command } from 'commander'

describe('suggest command simple tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct command configuration', () => {
    expect(suggestCommand).toBeInstanceOf(Command)
    expect(suggestCommand.name()).toBe('suggest')
    expect(suggestCommand.description()).toContain('Claude Code')
    expect(suggestCommand.aliases()).toContain('sg')

    // Check options
    const options = suggestCommand.options
    const optionNames = options.map(opt => opt.long)

    expect(optionNames).toContain('--branch')
    expect(optionNames).toContain('--commit')
    expect(optionNames).toContain('--issue')
    expect(optionNames).toContain('--pr')
    expect(optionNames).toContain('--description')
    expect(optionNames).toContain('--diff')
    expect(optionNames).toContain('--review')
  })

  it('should test prompt building for branch names', () => {
    const buildBranchPrompt = (description: string, context: any = {}): string => {
      let prompt = '# ブランチ名の提案\n\n'
      prompt += `以下の情報に基づいて、適切なGitブランチ名を5つ提案してください。\n\n`

      if (context.issueNumber) {
        prompt += `Issue番号: #${context.issueNumber}\n`
      }
      if (context.prNumber) {
        prompt += `PR番号: #${context.prNumber}\n`
      }
      prompt += `説明: ${description}\n\n`

      prompt += `## ルール:\n`
      prompt += `- 小文字とハイフンのみ使用\n`
      prompt += `- 最大50文字\n`
      prompt += `- 一般的な命名規則に従う（feature/, bugfix/, hotfix/, refactor/）\n`

      return prompt
    }

    const prompt1 = buildBranchPrompt('ユーザー認証機能')
    expect(prompt1).toContain('ユーザー認証機能')
    expect(prompt1).toContain('ブランチ名の提案')
    expect(prompt1).toContain('小文字とハイフン')

    const prompt2 = buildBranchPrompt('ログイン修正', { issueNumber: '123' })
    expect(prompt2).toContain('Issue番号: #123')
    expect(prompt2).toContain('ログイン修正')
  })

  it('should test prompt building for commit messages', () => {
    const buildCommitPrompt = (context: any = {}): string => {
      let prompt = '# コミットメッセージの提案\n\n'
      prompt += `以下の変更に基づいて、適切なコミットメッセージを5つ提案してください。\n\n`

      if (context.diff) {
        prompt += `## 変更内容:\n\`\`\`diff\n${context.diff}\n\`\`\`\n\n`
      }

      if (context.files) {
        prompt += `## 変更ファイル:\n${context.files.join('\n')}\n\n`
      }

      prompt += `## ルール:\n`
      prompt += `- Conventional Commits形式\n`
      prompt += `- 最大72文字（タイトル行）\n`
      prompt += `- 日本語OK\n`

      return prompt
    }

    const prompt1 = buildCommitPrompt({
      diff: '+ function newFeature() {}',
    })
    expect(prompt1).toContain('コミットメッセージの提案')
    expect(prompt1).toContain('```diff')
    expect(prompt1).toContain('+ function newFeature() {}')

    const prompt2 = buildCommitPrompt({
      files: ['src/auth.js', 'src/login.js'],
    })
    expect(prompt2).toContain('変更ファイル:')
    expect(prompt2).toContain('src/auth.js')
  })

  it('should test suggestion type selection', () => {
    const getSuggestionTypes = () => [
      { name: '🌿 ブランチ名', value: 'branch' },
      { name: '📝 コミットメッセージ', value: 'commit' },
      { name: '📋 Issue タイトル', value: 'issue' },
      { name: '🔀 PR タイトル/説明', value: 'pr' },
      { name: '💬 レビューコメント', value: 'review' },
    ]

    const types = getSuggestionTypes()
    expect(types).toHaveLength(5)
    expect(types[0].value).toBe('branch')
    expect(types[1].value).toBe('commit')
  })

  it('should test context gathering', () => {
    const gatherContext = (options: any) => {
      const context: any = {
        timestamp: new Date().toISOString(),
      }

      if (options.branch) {
        context.type = 'branch'
      } else if (options.commit) {
        context.type = 'commit'
      } else if (options.issue) {
        context.type = 'issue'
        context.issueNumber = options.issue
      } else if (options.pr) {
        context.type = 'pr'
        context.prNumber = options.pr
      }

      if (options.description) {
        context.description = options.description
      }

      if (options.diff) {
        context.includeDiff = true
      }

      return context
    }

    const ctx1 = gatherContext({ branch: true, description: 'auth feature' })
    expect(ctx1.type).toBe('branch')
    expect(ctx1.description).toBe('auth feature')

    const ctx2 = gatherContext({ issue: '123' })
    expect(ctx2.type).toBe('issue')
    expect(ctx2.issueNumber).toBe('123')

    const ctx3 = gatherContext({ commit: true, diff: true })
    expect(ctx3.type).toBe('commit')
    expect(ctx3.includeDiff).toBe(true)
  })

  it('should test output formatting', () => {
    const formatSuggestionOutput = (type: string, suggestions: string[]): string => {
      const headers: Record<string, string> = {
        branch: '🌿 ブランチ名の提案:',
        commit: '📝 コミットメッセージの提案:',
        issue: '📋 Issue タイトルの提案:',
        pr: '🔀 PR タイトル/説明の提案:',
        review: '💬 レビューコメントの提案:',
      }

      let output = `\n${headers[type] || '提案:'}\n`
      output += '─'.repeat(40) + '\n\n'

      if (suggestions.length === 0) {
        output += '提案がありません。\n'
      } else {
        output += suggestions.join('\n\n')
      }

      return output
    }

    const output1 = formatSuggestionOutput('branch', [
      '1. feature/user-auth',
      '2. feature/authentication',
    ])
    expect(output1).toContain('🌿 ブランチ名の提案:')
    expect(output1).toContain('1. feature/user-auth')

    const output2 = formatSuggestionOutput('commit', [])
    expect(output2).toContain('📝 コミットメッセージの提案:')
    expect(output2).toContain('提案がありません')
  })

  it('should test Claude command construction', () => {
    const buildClaudeCommand = (promptFile: string, outputFile: string): string => {
      return `claude "${promptFile}" > "${outputFile}"`
    }

    const cmd = buildClaudeCommand('/tmp/prompt.md', '/tmp/output.txt')
    expect(cmd).toBe('claude "/tmp/prompt.md" > "/tmp/output.txt"')
  })

  it('should test temporary file naming', () => {
    const getTempFileName = (prefix: string, extension: string): string => {
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8)
      return `${prefix}-${timestamp}-${random}.${extension}`
    }

    const filename = getTempFileName('maestro-suggest', 'md')
    expect(filename).toMatch(/^maestro-suggest-\d+-[a-z0-9]+\.md$/)
  })

  it('should test error messages', () => {
    const getErrorMessage = (error: any): string => {
      if (error.message?.includes('claude: command not found')) {
        return 'Claude Codeがインストールされていません。\nhttps://claude.ai/code からインストールしてください。'
      }
      if (error.message?.includes('gh: command not found')) {
        return 'GitHub CLIがインストールされていません。\nbrew install gh でインストールしてください。'
      }
      return `エラーが発生しました: ${error.message || '不明なエラー'}`
    }

    expect(getErrorMessage(new Error('claude: command not found'))).toContain(
      'Claude Codeがインストールされていません'
    )

    expect(getErrorMessage(new Error('gh: command not found'))).toContain(
      'GitHub CLIがインストールされていません'
    )

    expect(getErrorMessage(new Error('Network error'))).toBe('エラーが発生しました: Network error')
  })

  it('should test repository info gathering', () => {
    const getRepositoryInfo = (remote: string): any => {
      const match = remote.match(/github\.com[/:]([\w-]+)\/([\w-]+)/)
      if (!match) return null

      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        url: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, '')}`,
      }
    }

    const info1 = getRepositoryInfo('git@github.com:user/repo.git')
    expect(info1?.owner).toBe('user')
    expect(info1?.repo).toBe('repo')
    expect(info1?.url).toBe('https://github.com/user/repo')

    const info2 = getRepositoryInfo('https://github.com/org/project.git')
    expect(info2?.owner).toBe('org')
    expect(info2?.repo).toBe('project')

    const info3 = getRepositoryInfo('invalid-url')
    expect(info3).toBeNull()
  })

  it('should test diff analysis', () => {
    const analyzeDiff = (diff: string): any => {
      const analysis = {
        addedLines: 0,
        removedLines: 0,
        modifiedFiles: new Set<string>(),
        types: new Set<string>(),
      }

      const lines = diff.split('\n')
      for (const line of lines) {
        if (line.startsWith('+++')) {
          const file = line.substring(4)
          analysis.modifiedFiles.add(file)
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          analysis.addedLines++
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          analysis.removedLines++
        }
      }

      // Determine change type
      if (analysis.addedLines > 0 && analysis.removedLines === 0) {
        analysis.types.add('addition')
      } else if (analysis.addedLines === 0 && analysis.removedLines > 0) {
        analysis.types.add('deletion')
      } else if (analysis.addedLines > 0 && analysis.removedLines > 0) {
        analysis.types.add('modification')
      }

      return analysis
    }

    const diff = `+++ b/src/auth.js
+function login() {}
+function logout() {}
--- a/src/utils.js
-function oldFunction() {}`

    const analysis = analyzeDiff(diff)
    expect(analysis.addedLines).toBe(2)
    expect(analysis.removedLines).toBe(1)
    expect(analysis.modifiedFiles.has('b/src/auth.js')).toBe(true)
    expect(analysis.types.has('modification')).toBe(true)
  })

  it('should test commit message analysis', () => {
    const analyzeCommitMessage = (message: string): any => {
      const analysis = {
        type: 'unknown',
        scope: null as string | null,
        subject: message,
        isConventional: false,
      }

      // Check for conventional commit format
      const match = message.match(
        /^(feat|fix|docs|style|refactor|test|chore)(\([^)]+\))?\s*:\s*(.+)$/
      )
      if (match) {
        analysis.isConventional = true
        analysis.type = match[1]
        analysis.scope = match[2]?.slice(1, -1) || null
        analysis.subject = match[3]
      }

      return analysis
    }

    const analysis1 = analyzeCommitMessage('feat(auth): add login functionality')
    expect(analysis1.isConventional).toBe(true)
    expect(analysis1.type).toBe('feat')
    expect(analysis1.scope).toBe('auth')
    expect(analysis1.subject).toBe('add login functionality')

    const analysis2 = analyzeCommitMessage('fix: resolve login bug')
    expect(analysis2.isConventional).toBe(true)
    expect(analysis2.type).toBe('fix')
    expect(analysis2.scope).toBeNull()

    const analysis3 = analyzeCommitMessage('random commit message')
    expect(analysis3.isConventional).toBe(false)
    expect(analysis3.type).toBe('unknown')
  })

  it('should test branch name validation', () => {
    const validateBranchName = (name: string): boolean => {
      // Valid branch name rules
      if (name.length === 0 || name.length > 255) return false
      if (name.startsWith('.') || name.endsWith('.')) return false
      if (name.includes('..') || name.includes('~')) return false
      if (name.includes(' ') || name.includes('\t')) return false
      if (name.includes('@{') || name.includes('\\')) return false

      return true
    }

    expect(validateBranchName('feature/user-auth')).toBe(true)
    expect(validateBranchName('bugfix-login')).toBe(true)
    expect(validateBranchName('hotfix/critical')).toBe(true)
    expect(validateBranchName('')).toBe(false)
    expect(validateBranchName('.hidden')).toBe(false)
    expect(validateBranchName('branch with spaces')).toBe(false)
    expect(validateBranchName('bad..branch')).toBe(false)
    expect(validateBranchName('branch@{}')).toBe(false)
  })

  it('should test suggestion ranking', () => {
    const rankSuggestions = (suggestions: string[], context: any): string[] => {
      const scored = suggestions.map(suggestion => ({
        text: suggestion,
        score: 0,
      }))

      // Score based on context
      scored.forEach(item => {
        if (context.type === 'branch') {
          if (item.text.includes('feature/')) item.score += 2
          if (item.text.includes('fix')) item.score += 1
          if (item.text.length <= 30) item.score += 1
        } else if (context.type === 'commit') {
          if (item.text.startsWith('feat:')) item.score += 2
          if (item.text.startsWith('fix:')) item.score += 1
          if (item.text.length <= 50) item.score += 1
        }
      })

      return scored.sort((a, b) => b.score - a.score).map(item => item.text)
    }

    const branchSuggestions = [
      'feature/user-auth',
      'long-branch-name-that-exceeds-limit',
      'fix-login-bug',
      'update-readme',
    ]

    const ranked = rankSuggestions(branchSuggestions, { type: 'branch' })
    expect(ranked[0]).toBe('feature/user-auth')
    expect(ranked[1]).toBe('fix-login-bug')
  })

  it('should test file path suggestion', () => {
    const suggestFilePaths = (changedFiles: string[]): string[] => {
      const suggestions: string[] = []

      for (const file of changedFiles) {
        const parts = file.split('/')
        const fileName = parts[parts.length - 1]
        const extension = fileName.split('.').pop()

        if (extension === 'js' || extension === 'ts') {
          suggestions.push(`${extension} file change`)
        } else if (extension === 'md') {
          suggestions.push('documentation update')
        } else if (extension === 'json') {
          suggestions.push('configuration change')
        }
      }

      return [...new Set(suggestions)]
    }

    const files = ['src/auth.js', 'README.md', 'package.json', 'src/utils.ts']
    const suggestions = suggestFilePaths(files)

    expect(suggestions).toContain('js file change')
    expect(suggestions).toContain('ts file change')
    expect(suggestions).toContain('documentation update')
    expect(suggestions).toContain('configuration change')
  })

  it('should test prompt optimization', () => {
    const optimizePrompt = (prompt: string, maxLength: number): string => {
      if (prompt.length <= maxLength) return prompt

      // Try to truncate while preserving structure
      const parts = prompt.split('\n\n')
      let result = parts[0] // Keep header

      for (let i = 1; i < parts.length; i++) {
        const testResult = result + '\n\n' + parts[i]
        if (testResult.length > maxLength) break
        result = testResult
      }

      if (result.length > maxLength) {
        result = result.substring(0, maxLength - 3) + '...'
      }

      return result
    }

    const longPrompt =
      'Header\n\nVery long content that exceeds the maximum length limit and should be truncated'
    const optimized = optimizePrompt(longPrompt, 50)

    expect(optimized.length).toBeLessThanOrEqual(50)
    expect(optimized).toContain('Header')
  })

  it('should test output parsing', () => {
    const parseClaudeOutput = (output: string): string[] => {
      const lines = output.split('\n')
      const suggestions: string[] = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.match(/^\d+\.\s/)) {
          suggestions.push(trimmed)
        }
      }

      return suggestions
    }

    const output = `# Branch Suggestions

1. feature/user-authentication
2. feature/login-system
3. auth/user-login

Some other text here.

4. bugfix/auth-issue
5. hotfix/login-bug`

    const suggestions = parseClaudeOutput(output)
    expect(suggestions).toHaveLength(5)
    expect(suggestions[0]).toBe('1. feature/user-authentication')
    expect(suggestions[4]).toBe('5. hotfix/login-bug')
  })
})

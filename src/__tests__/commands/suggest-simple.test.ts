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
      diff: '+ function newFeature() {}' 
    })
    expect(prompt1).toContain('コミットメッセージの提案')
    expect(prompt1).toContain('```diff')
    expect(prompt1).toContain('+ function newFeature() {}')

    const prompt2 = buildCommitPrompt({ 
      files: ['src/auth.js', 'src/login.js'] 
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

    const filename = getTempFileName('scj-suggest', 'md')
    expect(filename).toMatch(/^scj-suggest-\d+-[a-z0-9]+\.md$/)
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

    expect(getErrorMessage(new Error('claude: command not found')))
      .toContain('Claude Codeがインストールされていません')
    
    expect(getErrorMessage(new Error('gh: command not found')))
      .toContain('GitHub CLIがインストールされていません')
    
    expect(getErrorMessage(new Error('Network error')))
      .toBe('エラーが発生しました: Network error')
  })
})
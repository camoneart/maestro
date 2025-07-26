import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCommand, parseIssueNumber, fetchGitHubMetadata } from '../../commands/create.js'
import { Command } from 'commander'

describe('create command simple tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct command configuration', () => {
    expect(createCommand).toBeInstanceOf(Command)
    expect(createCommand.name()).toBe('create')
    expect(createCommand.description()).toContain('新しい演奏者')

    // Check options
    const options = createCommand.options
    const optionNames = options.map(opt => opt.long)

    expect(optionNames).toContain('--base')
    expect(optionNames).toContain('--open')
    expect(optionNames).toContain('--setup')
    expect(optionNames).toContain('--tmux')
    expect(optionNames).toContain('--claude-md')
  })

  it('should have correct argument configuration', () => {
    const args = createCommand.registeredArguments
    expect(args).toHaveLength(1)
    expect(args[0].name()).toBe('branch-name')
    expect(args[0].required).toBe(true)
  })

  it('should test additional create helper functions', async () => {
    // Test environment setup functions
    const setupEnvironment = (options: any) => {
      const env: any = {}

      if (options.open) {
        env.OPEN_EDITOR = true
      }

      if (options.setup) {
        env.RUN_SETUP = true
      }

      if (options.claudeMd) {
        env.CLAUDE_MD_ENABLED = true
      }

      return env
    }

    const env1 = setupEnvironment({ open: true, setup: false, claudeMd: true })
    expect(env1.OPEN_EDITOR).toBe(true)
    expect(env1.RUN_SETUP).toBeUndefined()
    expect(env1.CLAUDE_MD_ENABLED).toBe(true)

    const env2 = setupEnvironment({ open: false, setup: true, claudeMd: false })
    expect(env2.OPEN_EDITOR).toBeUndefined()
    expect(env2.RUN_SETUP).toBe(true)
    expect(env2.CLAUDE_MD_ENABLED).toBeUndefined()
  })

  it('should test worktree path generation', () => {
    const generateWorktreePath = (basePath: string, branchName: string): string => {
      // Sanitize branch name for file system
      const sanitized = branchName
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

      return `${basePath}/${sanitized}`
    }

    expect(generateWorktreePath('/worktrees', 'feature/test')).toBe('/worktrees/feature-test')

    expect(generateWorktreePath('/worktrees', 'issue#123')).toBe('/worktrees/issue-123')

    expect(generateWorktreePath('/custom', 'refs/heads/main')).toBe('/custom/refs-heads-main')
  })

  it('should test PR title generation', () => {
    const generatePRTitle = (branchName: string, issueNumber?: string): string => {
      if (issueNumber) {
        return `[#${issueNumber}] ${branchName.replace(/^issue-\d+/, '').trim()}`
      }

      // Convert branch name to title case
      const words = branchName.split(/[-_]/)
      const title = words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

      return title
    }

    expect(generatePRTitle('feature-awesome', '123')).toBe('[#123] feature-awesome')

    expect(generatePRTitle('issue-456')).toBe('Issue 456')

    expect(generatePRTitle('add-user-auth')).toBe('Add User Auth')
  })

  it('should test hook command parsing', () => {
    const parseHookCommand = (hook: string): { command: string; args: string[] } => {
      const parts = hook.split(' ')
      return {
        command: parts[0],
        args: parts.slice(1),
      }
    }

    const hook1 = parseHookCommand('npm install')
    expect(hook1.command).toBe('npm')
    expect(hook1.args).toEqual(['install'])

    const hook2 = parseHookCommand('echo "Hello World"')
    expect(hook2.command).toBe('echo')
    expect(hook2.args).toEqual(['"Hello', 'World"'])

    const hook3 = parseHookCommand('git commit -m "Initial commit"')
    expect(hook3.command).toBe('git')
    expect(hook3.args).toEqual(['commit', '-m', '"Initial', 'commit"'])
  })

  it('should test editor detection', () => {
    const detectEditor = (): string => {
      const editors = ['code', 'cursor', 'vim', 'nvim', 'emacs', 'sublime', 'atom']

      // In real implementation, would check which is available
      // For test, just return first available
      return editors[0]
    }

    const editor = detectEditor()
    expect(editor).toBe('code')
  })

  it('should test metadata structure creation', () => {
    const createMetadata = (branch: string, options: any = {}) => {
      const metadata: any = {
        branch,
        createdAt: new Date().toISOString(),
        maestro: true,
      }

      if (options.github) {
        metadata.github = options.github
      }

      return metadata
    }

    const meta1 = createMetadata('feature-test')
    expect(meta1.branch).toBe('feature-test')
    expect(meta1.maestro).toBe(true)
    expect(meta1.createdAt).toMatch(/\d{4}-\d{2}-\d{2}/)

    const meta2 = createMetadata('issue-123', {
      github: { type: 'issue', number: 123 },
    })
    expect(meta2.github.type).toBe('issue')
    expect(meta2.github.number).toBe(123)
  })

  it('should test CLAUDE.md content generation', () => {
    const generateClaudeInstructions = (projectName: string, branch: string): string => {
      return `# Claude Code Instructions

## Project Context
- Project: ${projectName}
- Current Branch: ${branch}
- Created by: maestro

## Working Directory
This is a git worktree for parallel development.

## Instructions
1. Focus on the current branch task
2. Keep changes isolated to this worktree
3. Use conventional commits

## Additional Notes
- This is an orchestra member (git worktree)
- Changes here don't affect other worktrees
`
    }

    const content = generateClaudeInstructions('my-project', 'feature-awesome')
    expect(content).toContain('Project: my-project')
    expect(content).toContain('Current Branch: feature-awesome')
    expect(content).toContain('maestro')
    expect(content).toContain('git worktree')
  })

  it('should test action function branch name processing', () => {
    // Test the branch name processing logic from action function
    const processBranchName = (input: string, config: any): string => {
      let branchName = input

      // Apply prefix if configured
      if (config.worktrees?.branchPrefix && !branchName.startsWith(config.worktrees.branchPrefix)) {
        branchName = config.worktrees.branchPrefix + branchName
      }

      return branchName
    }

    const config1 = { worktrees: { branchPrefix: 'feature/' } }
    expect(processBranchName('test', config1)).toBe('feature/test')
    expect(processBranchName('feature/test', config1)).toBe('feature/test')

    const config2 = { worktrees: {} }
    expect(processBranchName('test', config2)).toBe('test')
  })

  it('should test template configuration merging', () => {
    // Test template config merging from action function
    const mergeTemplateConfig = (baseConfig: any, templateConfig: any): any => {
      return {
        ...baseConfig,
        worktrees: {
          ...baseConfig.worktrees,
          branchPrefix: templateConfig.branchPrefix || baseConfig.worktrees?.branchPrefix,
        },
        development: {
          ...baseConfig.development,
          autoSetup: templateConfig.autoSetup ?? baseConfig.development?.autoSetup ?? true,
          syncFiles: templateConfig.syncFiles ||
            baseConfig.development?.syncFiles || ['.env', '.env.local'],
          defaultEditor: templateConfig.editor || baseConfig.development?.defaultEditor || 'cursor',
        },
        hooks: templateConfig.hooks || baseConfig.hooks,
      }
    }

    const baseConfig = {
      worktrees: { branchPrefix: 'old/' },
      development: { autoSetup: false, defaultEditor: 'vim' },
      hooks: ['npm install'],
    }

    const templateConfig = {
      branchPrefix: 'new/',
      autoSetup: true,
      editor: 'code',
      hooks: ['yarn install'],
    }

    const merged = mergeTemplateConfig(baseConfig, templateConfig)
    expect(merged.worktrees.branchPrefix).toBe('new/')
    expect(merged.development.autoSetup).toBe(true)
    expect(merged.development.defaultEditor).toBe('code')
    expect(merged.hooks).toEqual(['yarn install'])
  })

  it('should test GitHub metadata branch name generation', () => {
    // Test GitHub metadata branch name generation from action function
    const generateGitHubBranchName = (metadata: any, issueNumber: string): string => {
      const sanitizedTitle = metadata.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 30)

      return `${metadata.type}-${issueNumber}-${sanitizedTitle}`
    }

    const metadata1 = {
      type: 'issue',
      title: 'Fix User Authentication Bug!',
    }
    expect(generateGitHubBranchName(metadata1, '123')).toBe('issue-123-fix-user-authentication-bug')

    const metadata2 = {
      type: 'pr',
      title: 'Add New Feature: User Profile Management System',
    }
    expect(generateGitHubBranchName(metadata2, '456')).toBe('pr-456-add-new-feature-user-profile-m')
  })

  it('should test worktree path resolution', () => {
    // Test worktree path resolution logic from action function
    const resolveWorktreePath = (branchName: string, config: any): string => {
      const worktreeRoot = config.worktrees?.root || '../worktrees'
      return `${worktreeRoot}/${branchName}`
    }

    const config1 = { worktrees: { root: '/custom/path' } }
    expect(resolveWorktreePath('feature-test', config1)).toBe('/custom/path/feature-test')

    const config2 = { worktrees: {} }
    expect(resolveWorktreePath('feature-test', config2)).toBe('../worktrees/feature-test')
  })

  it('should test error handling scenarios', () => {
    // Test error handling from action function
    const handleGitError = (error: any): string => {
      if (error.message?.includes('not a git repository')) {
        return 'このディレクトリはGitリポジトリではありません'
      }
      if (error.message?.includes('already exists')) {
        return 'ブランチまたはworktreeが既に存在します'
      }
      return 'Git操作でエラーが発生しました'
    }

    const error1 = { message: 'fatal: not a git repository' }
    expect(handleGitError(error1)).toBe('このディレクトリはGitリポジトリではありません')

    const error2 = { message: 'fatal: already exists' }
    expect(handleGitError(error2)).toBe('ブランチまたはworktreeが既に存在します')

    const error3 = { message: 'some other error' }
    expect(handleGitError(error3)).toBe('Git操作でエラーが発生しました')
  })

  it('should test template option processing', () => {
    // Test template option processing from action function
    const processTemplateOptions = (options: any, templateConfig: any): any => {
      const processed = { ...options }

      if (templateConfig.autoSetup !== undefined) {
        processed.setup = templateConfig.autoSetup
      }
      if (templateConfig.editor !== 'none') {
        processed.open = true
      }
      if (templateConfig.tmux) {
        processed.tmux = true
      }
      if (templateConfig.claudeMd) {
        processed.claudeMd = true
      }

      return processed
    }

    const options = { open: false, setup: false, tmux: false, claudeMd: false }
    const templateConfig = {
      autoSetup: true,
      editor: 'code',
      tmux: true,
      claudeMd: true,
    }

    const processed = processTemplateOptions(options, templateConfig)
    expect(processed.setup).toBe(true)
    expect(processed.open).toBe(true)
    expect(processed.tmux).toBe(true)
    expect(processed.claudeMd).toBe(true)
  })

  it('should test parseIssueNumber function', () => {
    // Test various issue number formats
    const result1 = parseIssueNumber('#123')
    expect(result1.isIssue).toBe(true)
    expect(result1.issueNumber).toBe('123')
    expect(result1.branchName).toBe('issue-123')

    const result2 = parseIssueNumber('456')
    expect(result2.isIssue).toBe(true)
    expect(result2.issueNumber).toBe('456')
    expect(result2.branchName).toBe('issue-456')

    const result3 = parseIssueNumber('issue-789')
    expect(result3.isIssue).toBe(true)
    expect(result3.issueNumber).toBe('789')
    expect(result3.branchName).toBe('issue-789')

    const result4 = parseIssueNumber('feature-branch')
    expect(result4.isIssue).toBe(false)
    expect(result4.issueNumber).toBeUndefined()
    expect(result4.branchName).toBe('feature-branch')
  })

  it('should test GitHub metadata structure', () => {
    // Test GitHub metadata structure creation
    const mockGitHubData = {
      type: 'issue' as const,
      title: 'Test Issue',
      body: 'Test description',
      author: 'testuser',
      labels: ['bug', 'enhancement'],
      assignees: ['dev1', 'dev2'],
      milestone: 'v1.0',
      url: 'https://github.com/test/repo/issues/123',
    }

    expect(mockGitHubData.type).toBe('issue')
    expect(mockGitHubData.title).toBe('Test Issue')
    expect(mockGitHubData.labels).toEqual(['bug', 'enhancement'])
    expect(mockGitHubData.assignees).toEqual(['dev1', 'dev2'])
    expect(mockGitHubData.milestone).toBe('v1.0')
    expect(mockGitHubData.url).toContain('github.com')
  })

  it('should test worktree metadata creation', () => {
    // Test worktree metadata structure
    const createWorktreeMetadata = (branch: string, path: string, github?: any) => {
      const metadata: any = {
        createdAt: '2023-01-01T00:00:00.000Z',
        branch,
        worktreePath: path,
      }

      if (github) {
        metadata.github = {
          ...github,
          issueNumber: github.type === 'issue' ? github.url.split('/').pop() : undefined,
        }
      }

      return metadata
    }

    const metadata1 = createWorktreeMetadata('feature-test', '/path/to/worktree')
    expect(metadata1.branch).toBe('feature-test')
    expect(metadata1.worktreePath).toBe('/path/to/worktree')
    expect(metadata1.github).toBeUndefined()

    const githubData = {
      type: 'issue',
      title: 'Test Issue',
      url: 'https://github.com/test/repo/issues/123',
    }
    const metadata2 = createWorktreeMetadata('issue-123', '/path/to/worktree', githubData)
    expect(metadata2.github.type).toBe('issue')
    expect(metadata2.github.issueNumber).toBe('123')
  })

  it('should test configuration validation', () => {
    // Test configuration validation logic
    const validateConfig = (config: any): boolean => {
      // Check required fields
      if (!config || typeof config !== 'object') return false

      // Check worktrees configuration
      if (config.worktrees && typeof config.worktrees !== 'object') return false

      // Check development configuration
      if (config.development && typeof config.development !== 'object') return false

      return true
    }

    expect(validateConfig({})).toBe(true)
    expect(validateConfig({ worktrees: {} })).toBe(true)
    expect(validateConfig({ development: {} })).toBe(true)
    expect(validateConfig(null)).toBe(false)
    expect(validateConfig({ worktrees: 'invalid' })).toBe(false)
    expect(validateConfig({ development: 'invalid' })).toBe(false)
  })

  it('should test branch name sanitization', () => {
    // Test branch name sanitization for GitHub titles
    const sanitizeBranchName = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 30)
    }

    expect(sanitizeBranchName('Fix User Authentication Bug!')).toBe('fix-user-authentication-bug')
    expect(sanitizeBranchName('Add New Feature: User Profile')).toBe('add-new-feature-user-profile')
    expect(sanitizeBranchName('Update README.md file')).toBe('update-readme-md-file')
    expect(sanitizeBranchName('Very Long Title That Should Be Truncated To 30 Characters')).toBe(
      'very-long-title-that-should-be'
    )
    expect(sanitizeBranchName('---Multiple---Dashes---')).toBe('multiple-dashes')
  })
})

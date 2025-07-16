import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import {
  executeCreateCommand,
  shouldPromptForConfirmation,
  confirmWorktreeCreation,
  createWorktreeWithProgress,
  executePostCreationTasks,
  setupEnvironment,
  syncConfigFiles,
  openInEditor,
  createDraftPR,
} from '../../commands/create.js'
import { GitWorktreeManager } from '../../core/git.js'
import { ConfigManager } from '../../core/config.js'
import { execa } from 'execa'
import inquirer from 'inquirer'
import ora from 'ora'
import fs from 'fs/promises'
import path from 'path'

// モック設定
vi.mock('../../core/git.js')
vi.mock('../../core/config.js')
vi.mock('execa')
vi.mock('inquirer')
vi.mock('ora')
vi.mock('fs/promises')
vi.mock('path')

describe('create command refactored functions', () => {
  let mockGitManager: any
  let mockConfigManager: any
  let mockSpinner: any

  beforeEach(() => {
    vi.clearAllMocks()

    // GitWorktreeManager のモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
    }
    ;(GitWorktreeManager as any).mockImplementation(() => mockGitManager)

    // ConfigManager のモック
    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue({
        worktrees: { branchPrefix: 'feature/' },
        development: { autoSetup: true, syncFiles: ['.env'], defaultEditor: 'cursor' },
        tmux: { enabled: true },
        claude: { autoStart: true },
      }),
    }
    ;(ConfigManager as any).mockImplementation(() => mockConfigManager)

    // Spinner のモック
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      warn: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
    }
    ;(ora as any).mockReturnValue(mockSpinner)

    // Inquirer のモック
    ;(inquirer as any).prompt = vi.fn().mockResolvedValue({ confirmed: true })

    // Execa のモック
    ;(execa as any).mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 })

    // fs/promises のモック
    ;(fs as any).copyFile = vi.fn().mockResolvedValue(undefined)
    ;(fs as any).writeFile = vi.fn().mockResolvedValue(undefined)

    // path のモック
    ;(path as any).join = vi.fn((...args) => args.join('/'))
  })

  describe('executeCreateCommand', () => {
    it('should execute create command successfully', async () => {
      const options = { base: 'main', setup: true }
      
      await executeCreateCommand('test-branch', options)

      expect(mockGitManager.isGitRepository).toHaveBeenCalled()
      expect(mockConfigManager.loadProjectConfig).toHaveBeenCalled()
      expect(mockConfigManager.getAll).toHaveBeenCalled()
    })

    it('should exit if not a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const processSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })

      await expect(executeCreateCommand('test-branch', {})).rejects.toThrow('process.exit called')
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Gitリポジトリではありません'))
      expect(processSpy).toHaveBeenCalledWith(1)
    })

    it('should handle template options', async () => {
      const options = { template: 'feature' }
      
      await executeCreateCommand('test-branch', options)

      expect(mockConfigManager.getAll).toHaveBeenCalled()
    })

    it('should handle GitHub metadata for issue numbers', async () => {
      ;(execa as any).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args.includes('issue')) {
          return Promise.resolve({
            stdout: JSON.stringify({
              title: 'Test Issue',
              body: 'Issue description',
              author: { login: 'testuser' },
              labels: [{ name: 'bug' }],
              assignees: [{ name: 'assignee1' }],
              url: 'https://github.com/test/repo/issues/123'
            })
          })
        }
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 })
      })

      await executeCreateCommand('123', {})

      expect(execa).toHaveBeenCalledWith('gh', expect.arrayContaining(['issue', 'view', '123']))
    })
  })

  describe('shouldPromptForConfirmation', () => {
    it('should return false when yes option is true', async () => {
      const result = await shouldPromptForConfirmation(
        { yes: true },
        'test-branch',
        null
      )

      expect(result).toBe(false)
    })

    it('should return true when yes option is false and GitHub metadata exists', async () => {
      const githubMetadata = {
        type: 'issue' as const,
        title: 'Test Issue',
        body: 'Description',
        author: 'testuser',
        labels: ['bug'],
        assignees: [],
        url: 'https://github.com/test/repo/issues/123'
      }

      const result = await shouldPromptForConfirmation(
        { yes: false },
        'test-branch',
        githubMetadata
      )

      expect(result).toBe(true)
    })

    it('should return true for issue branches without yes option', async () => {
      const result = await shouldPromptForConfirmation(
        {},
        'issue-123-test',
        null
      )

      expect(result).toBe(true)
    })
  })

  describe('confirmWorktreeCreation', () => {
    it('should show confirmation prompt for branch', async () => {
      ;(inquirer as any).prompt.mockResolvedValue({ confirmed: true })

      const result = await confirmWorktreeCreation('test-branch', null)

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: expect.stringContaining('test-branch'),
        })
      ])
      expect(result).toBe(true)
    })

    it('should show confirmation prompt for GitHub issue', async () => {
      const githubMetadata = {
        type: 'issue' as const,
        title: 'Test Issue',
        body: 'Description',
        author: 'testuser',
        labels: ['bug'],
        assignees: [],
        url: 'https://github.com/test/repo/issues/123'
      }
      ;(inquirer as any).prompt.mockResolvedValue({ confirmed: false })

      const result = await confirmWorktreeCreation('test-branch', githubMetadata)

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          message: expect.stringContaining('Test Issue'),
        })
      ])
      expect(result).toBe(false)
    })
  })

  describe('createWorktreeWithProgress', () => {
    it('should create worktree with progress indicator', async () => {
      const config = {
        development: { autoSetup: true },
        tmux: { enabled: true },
        claude: { autoStart: true }
      }

      await createWorktreeWithProgress(
        mockGitManager,
        'test-branch',
        { setup: true },
        config,
        null,
        null
      )

      expect(mockSpinner.start).toHaveBeenCalled()
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('test-branch', undefined)
      expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining('影分身を作成しました'))
    })

    it('should handle worktree creation failure', async () => {
      mockGitManager.createWorktree.mockRejectedValue(new Error('Creation failed'))

      await expect(createWorktreeWithProgress(
        mockGitManager,
        'test-branch',
        {},
        {},
        null,
        null
      )).rejects.toThrow('Creation failed')

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('影分身の作成に失敗しました'))
    })
  })

  describe('executePostCreationTasks', () => {
    it('should execute all enabled tasks', async () => {
      const config = {
        development: { autoSetup: true },
        tmux: { enabled: true },
        claude: { autoStart: true }
      }
      const options = { setup: true, open: true, tmux: true, claude: true, draftPr: true }

      await executePostCreationTasks('/path/to/worktree', 'test-branch', options, config)

      // Tasks should be executed (Promise.allSettled は結果を待つ)
      expect(execa).toHaveBeenCalledWith('npm', ['install'], expect.any(Object))
    })

    it('should skip disabled tasks', async () => {
      const config = {
        development: { autoSetup: false },
        tmux: { enabled: false },
        claude: { autoStart: false }
      }
      const options = {}

      await executePostCreationTasks('/path/to/worktree', 'test-branch', options, config)

      // No tasks should be executed
      expect(execa).not.toHaveBeenCalledWith('npm', ['install'], expect.any(Object))
    })
  })

  describe('setupEnvironment', () => {
    it('should setup environment with npm install', async () => {
      const config = { development: { syncFiles: ['.env', '.env.local'] } }

      await setupEnvironment('/path/to/worktree', config)

      expect(mockSpinner.start).toHaveBeenCalled()
      expect(execa).toHaveBeenCalledWith('npm', ['install'], { cwd: '/path/to/worktree' })
      expect(mockSpinner.succeed).toHaveBeenCalled()
    })

    it('should handle npm install failure', async () => {
      ;(execa as any).mockRejectedValue(new Error('npm install failed'))

      await setupEnvironment('/path/to/worktree', {})

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('環境セットアップに失敗しました'))
    })
  })

  describe('syncConfigFiles', () => {
    it('should sync config files', async () => {
      process.cwd = vi.fn().mockReturnValue('/root')

      await syncConfigFiles('/path/to/worktree', ['.env', '.env.local'])

      expect(fs.copyFile).toHaveBeenCalledWith('/root/.env', '/path/to/worktree/.env')
      expect(fs.copyFile).toHaveBeenCalledWith('/root/.env.local', '/path/to/worktree/.env.local')
    })

    it('should handle file copy failures silently', async () => {
      ;(fs as any).copyFile.mockRejectedValue(new Error('File not found'))

      await expect(syncConfigFiles('/path/to/worktree', ['.env'])).resolves.not.toThrow()
    })
  })

  describe('openInEditor', () => {
    it('should open in default editor', async () => {
      const config = { development: { defaultEditor: 'cursor' } }

      await openInEditor('/path/to/worktree', config)

      expect(execa).toHaveBeenCalledWith('cursor', ['/path/to/worktree'], { detached: true })
    })

    it('should handle editor launch failure', async () => {
      ;(execa as any).mockRejectedValue(new Error('Editor not found'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await openInEditor('/path/to/worktree', {})

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('エディタの起動に失敗しました'))
    })
  })

  describe('createDraftPR', () => {
    it('should create draft PR', async () => {
      await createDraftPR('test-branch', '/path/to/worktree')

      expect(mockSpinner.start).toHaveBeenCalled()
      expect(execa).toHaveBeenCalledWith('gh', [
        'pr', 'create', '--draft', '--title', 'WIP: test-branch', '--body', 'Work in progress'
      ], { cwd: '/path/to/worktree' })
      expect(mockSpinner.succeed).toHaveBeenCalled()
    })

    it('should handle PR creation failure', async () => {
      ;(execa as any).mockRejectedValue(new Error('gh CLI not available'))

      await createDraftPR('test-branch', '/path/to/worktree')

      expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('Draft PRの作成に失敗しました'))
    })
  })
})
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { ConfigManager } from '../../core/config'
import { execa } from 'execa'
import fs from 'fs/promises'
import inquirer from 'inquirer'
import ora from 'ora'
import { batchCommand } from '../../commands/batch'
import {
  createMockWorktree,
  createMockConfig,
  createMockSpinner,
  createMockExecaResponse,
  createMockIssue,
} from '../utils/test-helpers'

// モック設定
vi.mock('../../core/git')
vi.mock('../../core/config')
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('inquirer')
vi.mock('ora')

describe('batch command', () => {
  let mockGitManager: any
  let mockConfigManager: any
  let mockSpinner: any

  beforeEach(() => {
    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    // ConfigManagerのモック
    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue(createMockConfig()),
    }
    vi.mocked(ConfigManager).mockImplementation(() => mockConfigManager)

    // Spinnerのモック
    mockSpinner = createMockSpinner()
    vi.mocked(ora).mockImplementation(() => mockSpinner)

    // consoleのモック
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // process.exitのモック
    vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit called with code ${code}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GitHub Issuesから選択', () => {
    it('GitHub Issuesから複数のworktreeを作成できる', async () => {
      // GitHub Issuesのモック
      const mockIssues = [
        createMockIssue({ number: 123, title: 'Feature A' }),
        createMockIssue({ number: 456, title: 'Feature B' }),
      ]

      vi.mocked(execa).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'list') {
          return Promise.resolve(createMockExecaResponse(JSON.stringify(mockIssues)))
        }
        return Promise.resolve(createMockExecaResponse())
      })

      // inquirerのモック - Issue選択
      vi.mocked(inquirer.prompt).mockImplementation(async (questions: any) => {
        const question = Array.isArray(questions) ? questions[0] : questions

        if (question.name === 'inputMethod') {
          return { inputMethod: 'issues' }
        }
        if (question.name === 'selectedIssues') {
          return {
            selectedIssues: [
              {
                name: `issue-123`,
                description: 'Feature A',
                issueNumber: '123',
              },
              {
                name: `issue-456`,
                description: 'Feature B',
                issueNumber: '456',
              },
            ],
          }
        }
        if (question.name === 'confirmCreate') {
          return { confirmCreate: true }
        }
        return {}
      })

      // コマンド実行
      await batchCommand.parseAsync(['node', 'test'])

      // GitWorktreeManagerが2回呼ばれることを確認
      expect(mockGitManager.createWorktree).toHaveBeenCalledTimes(2)
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/issue-123', undefined)
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/issue-456', undefined)
    })

    it('GitHub Issuesの取得に失敗した場合エラーを表示する', async () => {
      // GitHub API呼び出しを失敗させる
      vi.mocked(execa).mockRejectedValue(new Error('GitHub API error'))

      // inquirerのモック
      vi.mocked(inquirer.prompt).mockResolvedValue({ inputMethod: 'issues' })

      // コマンド実行
      await expect(batchCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('GitHub Issueの取得に失敗しました')
    })
  })

  describe('ファイルから読み込み', () => {
    it('バッチファイルから複数のworktreeを作成できる', async () => {
      const batchContent = `feature-a | Feature A implementation | #123
feature-b | Feature B implementation
feature-c | | pr-789`

      // ファイル読み込みのモック
      vi.mocked(fs.readFile).mockResolvedValue(batchContent)

      // inquirerのモック
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmCreate: true })

      // コマンド実行
      await batchCommand.parseAsync(['node', 'test', '--from-file', 'batch.txt'])

      // 3つのworktreeが作成されることを確認
      expect(mockGitManager.createWorktree).toHaveBeenCalledTimes(3)
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/feature-a', undefined)
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/feature-b', undefined)
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/feature-c', undefined)
    })

    it('バッチファイルが存在しない場合エラーを表示する', async () => {
      // ファイル読み込みエラー
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

      // コマンド実行
      await expect(
        batchCommand.parseAsync(['node', 'test', '--from-file', 'nonexistent.txt'])
      ).rejects.toThrow('process.exit called with code 1')
    })

    it('空行とコメント行を無視する', async () => {
      const batchContent = `# This is a comment
feature-a | Feature A

# Another comment
feature-b | Feature B
`

      vi.mocked(fs.readFile).mockResolvedValue(batchContent)
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmCreate: true })

      await batchCommand.parseAsync(['node', 'test', '--from-file', 'batch.txt'])

      // 2つのworktreeのみ作成される
      expect(mockGitManager.createWorktree).toHaveBeenCalledTimes(2)
    })
  })

  describe('インタラクティブモード', () => {
    it('インタラクティブに複数のworktreeを入力できる', async () => {
      // inquirerのモック - 順番に返すresponses
      let callIndex = 0
      const mockResponses = [
        // 1つ目のworktree入力
        { branchName: 'feature-x', description: 'Feature X', continueAdding: true },
        // 2つ目のworktree入力
        { branchName: 'feature-y', description: 'Feature Y', continueAdding: false },
        // 作成確認
        { confirmCreate: true },
      ]

      vi.mocked(inquirer.prompt).mockImplementation(async () => {
        const response = mockResponses[callIndex]
        callIndex++
        return response
      })

      await batchCommand.parseAsync(['node', 'test', '--interactive'])

      expect(mockGitManager.createWorktree).toHaveBeenCalledTimes(2)
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/feature-x', undefined)
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/feature-y', undefined)
    })
  })

  describe('並列実行とエラーハンドリング', () => {
    it('一部のworktree作成が失敗しても他は継続する', async () => {
      // 2つ目のworktree作成を失敗させる
      let createCount = 0
      mockGitManager.createWorktree.mockImplementation(async (branch: string) => {
        createCount++
        if (createCount === 2) {
          throw new Error('Worktree creation failed')
        }
        return `/path/to/worktree-${createCount}`
      })

      vi.mocked(inquirer.prompt).mockResolvedValue({
        confirmCreate: true,
      })

      // 3つのworktreeを作成するようモック
      vi.mocked(fs.readFile).mockResolvedValue('feature-1\nfeature-2\nfeature-3')

      await batchCommand.parseAsync(['node', 'test', '--from-file', 'batch.txt'])

      // 成功と失敗のサマリーが表示される
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('成功: 2件'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('失敗: 1件'))
    })
  })

  describe('オプション処理', () => {
    it('--baseオプションでベースブランチを指定できる', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('feature-test')
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmCreate: true })

      await batchCommand.parseAsync([
        'node',
        'test',
        '--from-file',
        'batch.txt',
        '--base',
        'develop',
      ])

      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/feature-test', 'develop')
    })

    it('--setupオプションで環境セットアップを実行する', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('feature-test')
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmCreate: true })

      // npm installのモック
      vi.mocked(execa).mockImplementation((cmd: string) => {
        if (cmd === 'npm') {
          return Promise.resolve(createMockExecaResponse())
        }
        return Promise.resolve(createMockExecaResponse())
      })

      // fs.copyFileのモック
      vi.mocked(fs.copyFile).mockResolvedValue(undefined)

      await batchCommand.parseAsync(['node', 'test', '--from-file', 'batch.txt', '--setup'])

      // npm installが呼ばれることを確認
      expect(execa).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({
          cwd: expect.stringContaining('/path/to/worktree'),
        })
      )
    })

    it('--openオプションでエディタで開く確認を行う', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('feature-test')

      // inquirerのモック
      let promptCount = 0
      vi.mocked(inquirer.prompt).mockImplementation(async (questions: any) => {
        promptCount++
        if (promptCount === 1) return { confirmCreate: true }
        if (promptCount === 2) return { openAll: true }
        return {}
      })

      // エディタのモック
      vi.mocked(execa).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'cursor') {
          return Promise.resolve(createMockExecaResponse())
        }
        return Promise.resolve(createMockExecaResponse())
      })

      await batchCommand.parseAsync(['node', 'test', '--from-file', 'batch.txt', '--open'])

      // エディタが呼ばれることを確認
      expect(execa).toHaveBeenCalledWith('cursor', ['/path/to/worktree'])
    })
  })

  describe('エラーハンドリング', () => {
    it('Gitリポジトリでない場合エラーを表示する', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(batchCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('このディレクトリはGitリポジトリではありません')
    })

    it('worktreeが0件の場合は作成をスキップする', async () => {
      vi.mocked(execa).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'list') {
          return Promise.resolve(createMockExecaResponse('[]')) // 空のIssueリスト
        }
        return Promise.resolve(createMockExecaResponse())
      })
      vi.mocked(inquirer.prompt).mockResolvedValue({ inputMethod: 'issues', selectedIssues: [] })

      await batchCommand.parseAsync(['node', 'test'])

      expect(mockGitManager.createWorktree).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('作成するworktreeがありません')
      )
    })

    it('作成確認でキャンセルした場合は作成をスキップする', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('feature-test')
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmCreate: false })

      await batchCommand.parseAsync(['node', 'test', '--from-file', 'batch.txt'])

      expect(mockGitManager.createWorktree).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('キャンセルされました'))
    })
  })
})

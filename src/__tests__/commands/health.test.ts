import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { execa } from 'execa'
import fs from 'fs/promises'
import inquirer from 'inquirer'
import ora from 'ora'
import { healthCommand } from '../../commands/health'
import {
  createMockWorktree,
  createMockWorktrees,
  createMockExecaResponse,
  createMockSpinner,
} from '../utils/test-helpers'

// モック設定
vi.mock('../../core/git')
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('inquirer')
vi.mock('ora')

describe('health command', () => {
  let mockGitManager: any
  let mockSpinner: any

  beforeEach(() => {
    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi
        .fn()
        .mockResolvedValue([
          createMockWorktree({ path: '/repo/.', branch: 'refs/heads/main' }),
          createMockWorktree({ path: '/repo/worktree-1', branch: 'refs/heads/feature-a' }),
          createMockWorktree({ path: '/repo/worktree-2', branch: 'refs/heads/feature-b' }),
        ]),
      deleteWorktree: vi.fn().mockResolvedValue(true),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    // Spinnerのモック
    mockSpinner = createMockSpinner()
    vi.mocked(ora).mockImplementation(() => mockSpinner)

    // execaのデフォルトモック
    vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'git') {
        if (args[0] === 'symbolic-ref' && args[1] === 'refs/remotes/origin/HEAD') {
          return createMockExecaResponse('refs/remotes/origin/main')
        }
        if (args[0] === 'status' && args[1] === '--porcelain') {
          return createMockExecaResponse('') // クリーンな状態
        }
        if (args[0] === 'rev-list' && args[1] === '--count') {
          return createMockExecaResponse('5') // 5コミット遅れ
        }
        if (args[0] === 'log' && args[1] === '-1' && args[2] === '--format=%ci') {
          // 最近のコミット
          return createMockExecaResponse(new Date().toISOString())
        }
        if (args[0] === 'ls-files' && args[1] === '--unmerged') {
          return createMockExecaResponse('') // 競合なし
        }
        if (args[0] === 'rev-parse') {
          return createMockExecaResponse('abc123') // リモートブランチ存在
        }
      }
      return createMockExecaResponse()
    })

    // fs.accessのモック
    vi.mocked(fs.access).mockResolvedValue(undefined)

    // consoleのモック
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // process.exitのモック
    vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit called with code ${code}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基本的な動作', () => {
    it('健全なworktreeの場合、問題なしと表示する', async () => {
      await healthCommand.parseAsync(['node', 'test'])

      expect(mockSpinner.stop).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🏥 Worktree健全性チェック結果')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✨ すべてのworktreeは健全です！')
      )
    })

    it('演奏者が存在しない場合は終了する', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([
        createMockWorktree({ path: '/repo/.', branch: 'refs/heads/main' }),
      ])

      try {
        await healthCommand.parseAsync(['node', 'test'])
      } catch (error) {
        // process.exitが呼ばれることを期待
      }

      expect(mockSpinner.succeed).toHaveBeenCalledWith('演奏者が存在しません')
      expect(process.exit).toHaveBeenCalledWith(0)
    })
  })

  describe('問題の検出', () => {
    it('未コミットの変更を検出する', async () => {
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'status' && args[1] === '--porcelain') {
          return createMockExecaResponse('M src/file1.ts\n?? src/file2.ts')
        }
        return createMockExecaResponse('')
      })

      await healthCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('2件の未コミット変更があります')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⚠️  警告: 2件'))
    })

    it('mainブランチからの大幅な遅れを検出する', async () => {
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'rev-list' && args[1] === '--count') {
          return createMockExecaResponse('25') // 25コミット遅れ
        }
        if (cmd === 'git' && args[0] === 'log') {
          return createMockExecaResponse(new Date().toISOString())
        }
        return createMockExecaResponse('')
      })

      await healthCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('から25コミット遅れています')
      )
    })

    it('古いworktreeを検出する', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 40) // 40日前

      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'log' && args[1] === '-1' && args[2] === '--format=%ci') {
          return createMockExecaResponse(oldDate.toISOString())
        }
        return createMockExecaResponse('')
      })

      await healthCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('40日間更新されていません'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ℹ️  情報: 2件'))
    })

    it('マージ競合を検出する', async () => {
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'ls-files' && args[1] === '--unmerged') {
          return createMockExecaResponse(
            '100644 hash1 1\tsrc/conflict.ts\n100644 hash2 2\tsrc/conflict.ts'
          )
        }
        if (cmd === 'git' && args[0] === 'log') {
          return createMockExecaResponse(new Date().toISOString())
        }
        return createMockExecaResponse('')
      })

      await healthCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('マージ競合が解決されていません')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🚨 重大: 2件'))
    })

    it('存在しないディレクトリを検出する', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))

      await healthCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Worktreeディレクトリが存在しません')
      )
    })

    it('リモートブランチが存在しない場合を検出する', async () => {
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'rev-parse' && args[1]?.startsWith('origin/')) {
          throw new Error('Branch not found')
        }
        if (cmd === 'git' && args[0] === 'log') {
          return createMockExecaResponse(new Date().toISOString())
        }
        return createMockExecaResponse('')
      })

      await healthCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('リモートブランチが存在しません')
      )
    })
  })

  describe('自動修正', () => {
    it('--fixオプションで修正可能な問題を修正する', async () => {
      // mainから大幅に遅れている状態
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'symbolic-ref' && args[1] === 'refs/remotes/origin/HEAD') {
          return createMockExecaResponse('refs/remotes/origin/main')
        }
        if (cmd === 'git' && args[0] === 'rev-list' && args[1] === '--count') {
          return createMockExecaResponse('25')
        }
        if (cmd === 'git' && args[0] === 'merge') {
          return createMockExecaResponse('Merged successfully')
        }
        if (cmd === 'git' && args[0] === 'log') {
          return createMockExecaResponse(new Date().toISOString())
        }
        return createMockExecaResponse('')
      })

      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmFix: true })

      await healthCommand.parseAsync(['node', 'test', '--fix'])

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'confirmFix',
            message: '自動修正を実行しますか？',
          }),
        ])
      )
      expect(execa).toHaveBeenCalledWith(
        'git',
        ['merge', 'main', '--no-edit'],
        expect.objectContaining({ cwd: expect.any(String) })
      )
      expect(mockSpinner.succeed).toHaveBeenCalledWith('2件の問題を修正しました')
    })

    it('存在しないディレクトリのworktreeを削除する', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmFix: true })

      await healthCommand.parseAsync(['node', 'test', '--fix'])

      expect(execa).toHaveBeenCalledWith('git', [
        'worktree',
        'remove',
        expect.any(String),
        '--force',
      ])
    })
  })

  describe('古いworktreeの削除', () => {
    it('--pruneオプションで古いworktreeを削除する', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 40)

      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'log' && args[1] === '-1' && args[2] === '--format=%ci') {
          return createMockExecaResponse(oldDate.toISOString())
        }
        return createMockExecaResponse('')
      })

      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmPrune: true })

      await healthCommand.parseAsync(['node', 'test', '--prune'])

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'confirmPrune',
            message: 'これらを削除しますか？',
          }),
        ])
      )
      expect(mockGitManager.deleteWorktree).toHaveBeenCalledTimes(2)
      expect(mockSpinner.succeed).toHaveBeenCalledWith('2件のworktreeを削除しました')
    })

    it('カスタム日数しきい値を使用できる', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 15) // 15日前

      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'log' && args[1] === '-1' && args[2] === '--format=%ci') {
          return createMockExecaResponse(oldDate.toISOString())
        }
        return createMockExecaResponse('')
      })

      await healthCommand.parseAsync(['node', 'test', '--days', '10'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('15日間更新されていません'))
    })
  })

  describe('詳細表示', () => {
    it('--verboseオプションで詳細情報を表示する', async () => {
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'rev-list' && args[1] === '--count') {
          return createMockExecaResponse('25')
        }
        if (cmd === 'git' && args[0] === 'log') {
          return createMockExecaResponse(new Date().toISOString())
        }
        return createMockExecaResponse('')
      })

      await healthCommand.parseAsync(['node', 'test', '--verbose'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('💊 修正可能'))
    })
  })

  describe('推奨事項', () => {
    it('修正可能な問題がある場合、--fixオプションを推奨する', async () => {
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'rev-list' && args[1] === '--count') {
          return createMockExecaResponse('25')
        }
        if (cmd === 'git' && args[0] === 'log') {
          return createMockExecaResponse(new Date().toISOString())
        }
        return createMockExecaResponse('')
      })

      await healthCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('💡 推奨事項:'))
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('--fix オプションで修正可能な問題を自動修正できます')
      )
    })

    it('古いworktreeがある場合、--pruneオプションを推奨する', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 40)

      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'log' && args[1] === '-1' && args[2] === '--format=%ci') {
          return createMockExecaResponse(oldDate.toISOString())
        }
        return createMockExecaResponse('')
      })

      await healthCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('--prune オプションで古いworktreeを削除できます')
      )
    })
  })

  describe('エラーハンドリング', () => {
    it('Gitリポジトリでない場合エラーを表示する', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(healthCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('このディレクトリはGitリポジトリではありません')
    })

    it('メインブランチの検出エラーをハンドリングする', async () => {
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'symbolic-ref') {
          throw new Error('Not found')
        }
        if (cmd === 'git' && args[0] === 'rev-parse' && args[2] === 'origin/master') {
          throw new Error('Not found')
        }
        if (cmd === 'git' && args[0] === 'log') {
          return createMockExecaResponse(new Date().toISOString())
        }
        return createMockExecaResponse('')
      })

      // エラーなく実行される（デフォルトのmainを使用）
      await healthCommand.parseAsync(['node', 'test'])

      expect(mockSpinner.stop).toHaveBeenCalled()
    })

    it('健全性チェック中のエラーを処理する', async () => {
      mockGitManager.listWorktrees.mockRejectedValue(new Error('Failed to list worktrees'))

      await expect(healthCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('健全性チェックに失敗しました')
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to list worktrees')
      )
    })
  })
})

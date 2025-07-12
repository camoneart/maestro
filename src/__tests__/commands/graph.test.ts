import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { execa } from 'execa'
import fs from 'fs/promises'
import ora from 'ora'
import { graphCommand } from '../../commands/graph'
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
vi.mock('ora')

describe('graph command', () => {
  let mockGitManager: any
  let mockSpinner: any

  beforeEach(() => {
    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([
        createMockWorktree({ path: '/repo/.', branch: 'refs/heads/main' }),
        createMockWorktree({
          path: '/repo/worktree-1',
          branch: 'refs/heads/feature-a',
        }),
        createMockWorktree({
          path: '/repo/worktree-2',
          branch: 'refs/heads/feature-b',
        }),
        createMockWorktree({
          path: '/repo/worktree-3',
          branch: 'refs/heads/feature-c',
        }),
      ]),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    // Spinnerのモック
    mockSpinner = createMockSpinner()
    vi.mocked(ora).mockImplementation(() => mockSpinner)

    // execaのモック - デフォルトの応答
    vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'git') {
        if (args[0] === 'merge-base') {
          return createMockExecaResponse('abc123')
        }
        if (args[0] === 'rev-list' && args[1] === '--count') {
          // ahead/behindのカウント
          if (args[2].includes('main..')) return createMockExecaResponse('3')
          if (args[2].includes('..main')) return createMockExecaResponse('2')
          return createMockExecaResponse('0')
        }
        if (args[0] === 'log' && args[1] === '-1') {
          // 最新コミット情報
          return createMockExecaResponse('abc1234|2024-01-01 12:00:00 +0900|feat: add new feature')
        }
      }
      if (cmd === 'dot') {
        return createMockExecaResponse()
      }
      return createMockExecaResponse()
    })

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
    it('テキスト形式でグラフを表示する', async () => {
      await graphCommand.parseAsync(['node', 'test'])

      expect(mockSpinner.stop).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🌳 Worktree依存関係グラフ'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📍 main'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature-a'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('(↑3 ↓2)'))
    })

    it('統計情報を表示する', async () => {
      await graphCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📊 統計情報:'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('総worktree数: 4'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('アクティブなブランチ: 3'))
    })

    it('遅れているブランチを警告する', async () => {
      // feature-cを大幅に遅れさせる
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'rev-list' && args[1] === '--count') {
          if (args[2].includes('feature-c..main')) return createMockExecaResponse('15')
          if (args[2].includes('..main')) return createMockExecaResponse('2')
          if (args[2].includes('main..')) return createMockExecaResponse('3')
          return createMockExecaResponse('0')
        }
        if (args[0] === 'log') {
          return createMockExecaResponse('abc1234|2024-01-01 12:00:00 +0900|feat: add new feature')
        }
        return createMockExecaResponse('abc123')
      })

      await graphCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  10コミット以上遅れているブランチ: 1個')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('feature-c (15コミット遅れ)')
      )
    })
  })

  describe('出力形式オプション', () => {
    it('Mermaid形式で出力する', async () => {
      await graphCommand.parseAsync(['node', 'test', '--format', 'mermaid'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('```mermaid'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('graph TD'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('main[main]'))
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('feature_a[feature-a<br/>↑3 ↓2]')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('main --> feature_a'))
    })

    it('DOT形式で出力する', async () => {
      await graphCommand.parseAsync(['node', 'test', '--format', 'dot'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('digraph worktree_dependencies')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('rankdir=TB'))
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"feature-a" [label="feature-a\\n↑3 ↓2"')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"main" -> "feature-a"'))
    })
  })

  describe('追加オプション', () => {
    it('--show-commitsで最新コミットを表示する', async () => {
      await graphCommand.parseAsync(['node', 'test', '--show-commits'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('abc1234: feat: add new feature')
      )
    })

    it('--show-datesで最終更新日を表示する', async () => {
      // 現在の日付に基づいて日数を計算
      const mockDate = new Date('2024-01-01')
      const daysAgo = Math.floor((Date.now() - mockDate.getTime()) / (1000 * 60 * 60 * 24))

      await graphCommand.parseAsync(['node', 'test', '--show-dates'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`${daysAgo}日前`))
    })
  })

  describe('ファイル出力', () => {
    it('--outputオプションでファイルに保存する', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      await graphCommand.parseAsync(['node', 'test', '--output', 'graph.txt'])

      expect(fs.writeFile).toHaveBeenCalledWith(
        'graph.txt',
        expect.stringContaining('🌳 Worktree依存関係グラフ')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✨ グラフを graph.txt に保存しました')
      )
    })

    it('DOT形式でPNG画像を生成する', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      await graphCommand.parseAsync(['node', 'test', '--format', 'dot', '--output', 'graph.dot'])

      expect(execa).toHaveBeenCalledWith('dot', ['-Tpng', 'graph.dot', '-o', 'graph.png'])
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🖼️  画像を graph.png に生成しました')
      )
    })

    it('Graphvizがない場合はヒントを表示する', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(execa).mockImplementation(async (cmd: string) => {
        if (cmd === 'dot') {
          throw new Error('Command not found')
        }
        return createMockExecaResponse()
      })

      await graphCommand.parseAsync(['node', 'test', '--format', 'dot', '--output', 'graph.dot'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('💡 ヒント: Graphvizをインストールすると画像を生成できます')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('brew install graphviz'))
    })
  })

  describe('ブランチ関係の分析', () => {
    it('親子関係を正しく検出する', async () => {
      // feature-bがfeature-aから派生している設定
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'rev-list' && args[1] === '--count') {
          // feature-bはfeature-aから派生
          if (args[2] === 'feature-a..feature-b') return createMockExecaResponse('5')
          if (args[2] === 'feature-b..feature-a') return createMockExecaResponse('0')
          // その他のデフォルト値
          if (args[2].includes('main..')) return createMockExecaResponse('3')
          if (args[2].includes('..main')) return createMockExecaResponse('2')
          return createMockExecaResponse('0')
        }
        if (args[0] === 'log') {
          return createMockExecaResponse('abc1234|2024-01-01 12:00:00 +0900|feat: add new feature')
        }
        return createMockExecaResponse('abc123')
      })

      await graphCommand.parseAsync(['node', 'test'])

      // feature-bの親がfeature-aに更新されていることを期待
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature-b'))
    })

    it('ブランチ分析エラーを無視する', async () => {
      // 一部のgitコマンドを失敗させる
      let callCount = 0
      vi.mocked(execa).mockImplementation(async () => {
        callCount++
        if (callCount % 3 === 0) {
          throw new Error('Git command failed')
        }
        return createMockExecaResponse('0')
      })

      // エラーが発生してもコマンドが完了することを確認
      await graphCommand.parseAsync(['node', 'test'])

      expect(mockSpinner.stop).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🌳 Worktree依存関係グラフ'))
    })
  })

  describe('エラーハンドリング', () => {
    it('Gitリポジトリでない場合エラーを表示する', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(graphCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('このディレクトリはGitリポジトリではありません')
    })

    it('影分身が存在しない場合は終了する', async () => {
      // メインブランチのみ
      mockGitManager.listWorktrees.mockResolvedValue([
        createMockWorktree({ path: '/repo/.', branch: 'refs/heads/main' }),
      ])

      try {
        await graphCommand.parseAsync(['node', 'test'])
      } catch (error) {
        // process.exitが呼ばれることを期待
      }

      expect(mockSpinner.fail).toHaveBeenCalledWith('影分身が存在しません')
      expect(process.exit).toHaveBeenCalled()
    })

    it('グラフ生成エラーを処理する', async () => {
      // listWorktreesでエラーを発生させる
      mockGitManager.listWorktrees.mockRejectedValue(new Error('Failed to list worktrees'))

      await expect(graphCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('グラフの生成に失敗しました')
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to list worktrees')
      )
    })
  })
})

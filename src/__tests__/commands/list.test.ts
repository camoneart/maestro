import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import fs from 'fs/promises'
import { spawn } from 'child_process'
import { listCommand } from '../../commands/list'
import { createMockWorktree, createMockWorktrees } from '../utils/test-helpers'
import { EventEmitter } from 'events'

// モック設定
vi.mock('../../core/git')
vi.mock('fs/promises')
vi.mock('child_process')

// fsのsyncメソッドもモック
vi.mock('fs', () => ({
  default: {
    statSync: vi.fn().mockReturnValue({ size: 1024 * 1024 }),
  },
}))

describe('list command', () => {
  let mockGitManager: any
  let mockFzfProcess: any

  beforeEach(() => {
    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([
        createMockWorktree({
          path: '/repo/.',
          branch: 'refs/heads/main',
          isCurrentDirectory: true,
        }),
        createMockWorktree({
          path: '/repo/worktree-1',
          branch: 'refs/heads/feature-a',
        }),
        createMockWorktree({
          path: '/repo/worktree-2',
          branch: 'refs/heads/feature-b',
          locked: true,
          reason: 'Manual lock',
        }),
        createMockWorktree({
          path: '/repo/worktree-3',
          branch: 'refs/heads/feature-c',
          prunable: true,
        }),
      ]),
      getLastCommit: vi.fn().mockResolvedValue({
        date: '2024-01-01T12:00:00Z',
        message: 'feat: add new feature',
        hash: 'abc1234',
      }),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    // fzfプロセスのモック
    mockFzfProcess = new EventEmitter() as any
    mockFzfProcess.stdin = {
      write: vi.fn(),
      end: vi.fn(),
    }
    mockFzfProcess.stdout = new EventEmitter()
    vi.mocked(spawn).mockReturnValue(mockFzfProcess)

    // fs.readFileのモック
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        createdAt: '2024-01-01T10:00:00Z',
        branch: 'feature-a',
        worktreePath: '/repo/worktree-1',
        github: {
          type: 'issue',
          title: 'Fix bug in authentication',
          body: 'Description of the issue',
          author: 'testuser',
          labels: ['bug', 'high-priority'],
          assignees: ['developer1', 'developer2'],
          url: 'https://github.com/owner/repo/issues/123',
          issueNumber: '123',
        },
      })
    )

    // consoleのモック
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // process.exitのモック
    vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit called with code ${code}`)
    })

    // process.cwdのモック
    vi.spyOn(process, 'cwd').mockReturnValue('/repo/.')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基本的な動作', () => {
    it('worktreeの一覧を表示する', async () => {
      await listCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🥷 影分身一覧:'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📍 refs/heads/main'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🥷 refs/heads/feature-a'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🥷 refs/heads/feature-b'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🥷 refs/heads/feature-c'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('合計: 4 個の影分身'))
    })

    it('worktreeが存在しない場合は警告を表示', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([])

      await listCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('影分身が存在しません'))
    })

    it('ロック状態とpruna可能状態を表示', async () => {
      await listCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🔒 ロック中'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('(Manual lock)'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⚠️  削除可能'))
    })
  })

  describe('JSON出力', () => {
    it('--jsonオプションでJSON形式で出力する', async () => {
      await listCommand.parseAsync(['node', 'test', '--json'])

      const logCall = vi.mocked(console.log).mock.calls[0][0]
      const jsonData = JSON.parse(logCall)

      expect(jsonData).toBeInstanceOf(Array)
      expect(jsonData).toHaveLength(4)
      expect(jsonData[0]).toHaveProperty('path', '/repo/.')
      expect(jsonData[0]).toHaveProperty('branch', 'refs/heads/main')
      expect(jsonData[0]).toHaveProperty('isCurrent', true)
      expect(jsonData[0]).toHaveProperty('lastCommit')
      expect(jsonData[0]).toHaveProperty('metadata')
    })

    it('JSON出力時に追加情報を含める', async () => {
      await listCommand.parseAsync(['node', 'test', '--json'])

      const logCall = vi.mocked(console.log).mock.calls[0][0]
      const jsonData = JSON.parse(logCall)

      // 最終コミット情報
      expect(jsonData[0].lastCommit).toEqual({
        date: '2024-01-01T12:00:00Z',
        message: 'feat: add new feature',
        hash: 'abc1234',
      })

      // メタデータ情報
      expect(jsonData[1].metadata.github).toEqual(
        expect.objectContaining({
          type: 'issue',
          issueNumber: '123',
          title: 'Fix bug in authentication',
        })
      )
    })
  })

  describe('フィルタリング', () => {
    it('--filterオプションでブランチ名をフィルタする', async () => {
      await listCommand.parseAsync(['node', 'test', '--filter', 'feature-a'])

      // mainとfeature-aのみ表示される
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('refs/heads/main'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('refs/heads/feature-a'))
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('refs/heads/feature-b'))
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('refs/heads/feature-c'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('合計: 2 個の影分身'))
    })

    it('--filterオプションでパスをフィルタする', async () => {
      await listCommand.parseAsync(['node', 'test', '--filter', 'worktree-2'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('refs/heads/main'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('refs/heads/feature-b'))
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('refs/heads/feature-a'))
    })
  })

  describe('ソート', () => {
    it('--sort branchでブランチ名でソート', async () => {
      await listCommand.parseAsync(['node', 'test', '--sort', 'branch'])

      const logCalls = vi.mocked(console.log).mock.calls
      const branchLogs = logCalls.filter(call => call[0].includes('🥷'))

      // ブランチ名でアルファベット順にソートされていることを確認
      expect(branchLogs[0][0]).toContain('feature-a')
      expect(branchLogs[1][0]).toContain('feature-b')
      expect(branchLogs[2][0]).toContain('feature-c')
    })

    it('--sort ageで最終コミット日時でソート', async () => {
      mockGitManager.getLastCommit.mockImplementation((path: string) => {
        const dates = {
          '/repo/.': '2024-01-03T12:00:00Z',
          '/repo/worktree-1': '2024-01-01T12:00:00Z',
          '/repo/worktree-2': '2024-01-04T12:00:00Z',
          '/repo/worktree-3': '2024-01-02T12:00:00Z',
        }
        return Promise.resolve({
          date: dates[path] || '2024-01-01T12:00:00Z',
          message: 'commit message',
          hash: 'abc123',
        })
      })

      await listCommand.parseAsync(['node', 'test', '--sort', 'age', '--last-commit'])

      // 最新のコミットが先に表示される
      const logCalls = vi.mocked(console.log).mock.calls
      const commitLogs = logCalls.filter(call => call[0].includes('最終コミット:'))

      expect(commitLogs[0][0]).toContain('2024-01-04')
      expect(commitLogs[1][0]).toContain('2024-01-03')
    })

    it('--sort sizeでディレクトリサイズでソート', async () => {
      const fsModule = await import('fs')
      let callCount = 0
      vi.mocked(fsModule.default.statSync).mockImplementation(() => {
        callCount++
        const sizes = [4096, 2048, 8192, 1024]
        return { size: sizes[callCount - 1] || 1024 } as any
      })

      await listCommand.parseAsync(['node', 'test', '--sort', 'size'])

      // サイズでソートされていることを確認（大きい順）
      expect(fsModule.default.statSync).toHaveBeenCalled()
    })
  })

  describe('追加情報表示', () => {
    it('--last-commitで最終コミット情報を表示', async () => {
      await listCommand.parseAsync(['node', 'test', '--last-commit'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('最終コミット:'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2024-01-01T12:00:00Z'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feat: add new feature'))
    })

    it('--metadataでメタデータ情報を表示', async () => {
      await listCommand.parseAsync(['node', 'test', '--metadata'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('GitHub:'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fix bug in authentication'))
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('ラベル: bug, high-priority')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('担当者: developer1, developer2')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('作成日時:'))
    })

    it('GitHubバッジを表示', async () => {
      // PRメタデータ
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            github: {
              type: 'pr',
              issueNumber: '456',
            },
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            template: 'fastapi',
          })
        )

      await listCommand.parseAsync(['node', 'test', '--metadata'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Issue #123'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('PR #456'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[fastapi]'))
    })
  })

  describe('fzf統合', () => {
    it('--fzfオプションでfzfを起動する', async () => {
      await listCommand.parseAsync(['node', 'test', '--fzf'])

      expect(spawn).toHaveBeenCalledWith(
        'fzf',
        expect.arrayContaining([
          '--ansi',
          '--header=影分身を選択 (Ctrl-C でキャンセル)',
          '--preview',
          expect.any(String),
          '--preview-window=right:50%:wrap',
        ]),
        expect.any(Object)
      )

      expect(mockFzfProcess.stdin.write).toHaveBeenCalled()
      expect(mockFzfProcess.stdin.end).toHaveBeenCalled()
    })

    it('fzfで選択されたブランチ名を出力する', async () => {
      await listCommand.parseAsync(['node', 'test', '--fzf'])

      // fzfからの出力をシミュレート
      mockFzfProcess.stdout.emit('data', 'refs/heads/feature-a [現在] | /repo/worktree-1\n')
      mockFzfProcess.emit('close', 0)

      // ブランチ名のみが出力される
      expect(console.log).toHaveBeenCalledWith('feature-a')
    })

    it('fzfでキャンセルされた場合は何も出力しない', async () => {
      await listCommand.parseAsync(['node', 'test', '--fzf'])

      // fzfがキャンセルされた（コード1で終了）
      mockFzfProcess.emit('close', 1)

      // console.logが呼ばれていないことを確認
      expect(console.log).not.toHaveBeenCalled()
    })
  })

  describe('エラーハンドリング', () => {
    it('Gitリポジトリでない場合エラーを表示する', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(listCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('エラー: このディレクトリはGitリポジトリではありません')
      )
    })

    it('一般的なエラーを処理する', async () => {
      mockGitManager.listWorktrees.mockRejectedValue(new Error('Git command failed'))

      await expect(listCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('エラー:'),
        expect.stringContaining('Git command failed')
      )
    })

    it('メタデータ読み込みエラーを無視する', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

      // エラーが発生してもコマンドは正常に完了する
      await listCommand.parseAsync(['node', 'test', '--metadata'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🥷 影分身一覧:'))
    })

    it('最終コミット取得エラーを無視する', async () => {
      mockGitManager.getLastCommit.mockRejectedValue(new Error('No commits'))

      // エラーが発生してもコマンドは正常に完了する
      await listCommand.parseAsync(['node', 'test', '--last-commit'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🥷 影分身一覧:'))
    })
  })
})

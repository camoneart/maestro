import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { execa } from 'execa'
import fs from 'fs/promises'
import inquirer from 'inquirer'
import ora from 'ora'
import path from 'path'
import { snapshotCommand } from '../../commands/snapshot'
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

describe('snapshot command', () => {
  let mockGitManager: any
  let mockSpinner: any
  const mockSnapshotDir = '/repo/.scj/snapshots'

  beforeEach(() => {
    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([
        createMockWorktree({
          path: '/repo/.',
          branch: 'refs/heads/main',
        }),
        createMockWorktree({
          path: '/repo/worktree-1',
          branch: 'refs/heads/feature-a',
        }),
        createMockWorktree({
          path: '/repo/worktree-2',
          branch: 'refs/heads/feature-b',
        }),
      ]),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    // Spinnerのモック
    mockSpinner = createMockSpinner()
    vi.mocked(ora).mockImplementation(() => mockSpinner)

    // execaのデフォルトモック
    vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'git') {
        if (args[0] === 'branch' && args[1] === '-vv') {
          return createMockExecaResponse(
            '* feature-a abc123 [origin/feature-a: ahead 2, behind 1] Initial commit'
          )
        }
        if (args[0] === 'diff' && args[1] === '--cached' && args[2] === '--name-only') {
          return createMockExecaResponse('src/staged.ts')
        }
        if (args[0] === 'diff' && args[1] === '--name-only') {
          return createMockExecaResponse('src/modified.ts')
        }
        if (args[0] === 'ls-files' && args[1] === '--others') {
          return createMockExecaResponse('src/untracked.ts')
        }
        if (args[0] === 'log' && args[1] === '-1') {
          return createMockExecaResponse(
            'abc123|feat: add feature|John Doe|2024-01-01 12:00:00 +0900'
          )
        }
        if (args[0] === 'stash' && args[1] === 'push') {
          return createMockExecaResponse('Saved working directory and index state')
        }
        if (args[0] === 'stash' && args[1] === 'list' && args[2] === '-1') {
          return createMockExecaResponse('def456 stash@{0}: Shadow Clone Snapshot: snapshot-123')
        }
      }
      return createMockExecaResponse()
    })

    // fs.mkdirのモック
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)

    // fs.writeFileのモック
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)

    // fs.readFileのモック
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        createdAt: '2024-01-01T10:00:00Z',
        branch: 'feature-a',
        worktreePath: '/repo/worktree-1',
      })
    )

    // fs.readdirのモック
    vi.mocked(fs.readdir).mockResolvedValue([])

    // fs.accessのモック
    vi.mocked(fs.access).mockResolvedValue(undefined)

    // fs.unlinkのモック
    vi.mocked(fs.unlink).mockResolvedValue(undefined)

    // pathのモック
    vi.spyOn(path, 'join').mockImplementation((...args) => args.join('/'))

    // process.cwdのモック
    vi.spyOn(process, 'cwd').mockReturnValue('/repo/worktree-1')

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

  describe('スナップショット作成', () => {
    it('現在のworktreeのスナップショットを作成する', async () => {
      await snapshotCommand.parseAsync(['node', 'test'])

      expect(mockSpinner.succeed).toHaveBeenCalledWith('スナップショットを作成しました')
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/repo/worktree-1/.scj/snapshots/'),
        expect.stringContaining('"branch": "feature-a"')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📸 作成されたスナップショット:')
      )
    })

    it('カスタムメッセージでスナップショットを作成する', async () => {
      await snapshotCommand.parseAsync(['node', 'test', '--message', 'Important checkpoint'])

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const snapshotData = JSON.parse(writeCall[1] as string)

      expect(snapshotData.message).toBe('Important checkpoint')
    })

    it('--stashオプションで変更をスタッシュに保存する', async () => {
      await snapshotCommand.parseAsync(['node', 'test', '--stash'])

      expect(execa).toHaveBeenCalledWith(
        'git',
        [
          'stash',
          'push',
          '-m',
          expect.stringContaining('Shadow Clone Snapshot'),
          '--include-untracked',
        ],
        expect.any(Object)
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ 変更をスタッシュに保存しました')
      )
    })

    it('--allオプションで全worktreeのスナップショットを作成する', async () => {
      await snapshotCommand.parseAsync(['node', 'test', '--all'])

      expect(mockSpinner.succeed).toHaveBeenCalledWith('2個のスナップショットを作成しました')
      expect(fs.writeFile).toHaveBeenCalledTimes(2)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature-a:'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature-b:'))
    })

    it('Git状態を正しく取得する', async () => {
      await snapshotCommand.parseAsync(['node', 'test'])

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const snapshotData = JSON.parse(writeCall[1] as string)

      expect(snapshotData.gitStatus).toEqual({
        branch: 'feature-a',
        tracking: 'origin/feature-a',
        ahead: 2,
        behind: 1,
        staged: ['src/staged.ts'],
        modified: ['src/modified.ts'],
        untracked: ['src/untracked.ts'],
      })
    })

    it('最終コミット情報を含める', async () => {
      await snapshotCommand.parseAsync(['node', 'test'])

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const snapshotData = JSON.parse(writeCall[1] as string)

      expect(snapshotData.lastCommit).toEqual({
        hash: 'abc123',
        message: 'feat: add feature',
        author: 'John Doe',
        date: '2024-01-01 12:00:00 +0900',
      })
    })

    it('メタデータが存在する場合は含める', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          github: {
            type: 'issue',
            issueNumber: '123',
            title: 'Test issue',
          },
        })
      )

      await snapshotCommand.parseAsync(['node', 'test'])

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const snapshotData = JSON.parse(writeCall[1] as string)

      expect(snapshotData.metadata).toBeDefined()
      expect(snapshotData.metadata.github.issueNumber).toBe('123')
    })
  })

  describe('スナップショット一覧', () => {
    it('--listオプションでスナップショット一覧を表示する', async () => {
      const mockSnapshots = [
        {
          id: 'snapshot-123',
          branch: 'feature-a',
          worktreePath: '/repo/worktree-1',
          createdAt: new Date().toISOString(),
          message: 'Test snapshot',
          gitStatus: {
            staged: ['file1.ts'],
            modified: ['file2.ts'],
            untracked: [],
          },
          stash: { hash: 'abc123', message: 'stash message' },
        },
      ]

      vi.mocked(fs.readdir).mockResolvedValue(['snapshot-123.json'])
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSnapshots[0]))

      await snapshotCommand.parseAsync(['node', 'test', '--list'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📸 スナップショット一覧:'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('snapshot-123'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature-a'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1 staged, 1 modified'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('スタッシュ: あり'))
    })

    it('スナップショットが存在しない場合は警告を表示', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([])

      await snapshotCommand.parseAsync(['node', 'test', '--list'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('スナップショットが存在しません')
      )
    })
  })

  describe('スナップショット復元', () => {
    const mockSnapshot = {
      id: 'snapshot-123',
      branch: 'feature-a',
      worktreePath: '/repo/worktree-1',
      createdAt: new Date().toISOString(),
      message: 'Test snapshot',
      gitStatus: {
        branch: 'feature-a',
        tracking: 'origin/feature-a',
        ahead: 2,
        behind: 1,
        staged: ['file1.ts'],
        modified: ['file2.ts'],
        untracked: [],
      },
      stash: { hash: 'abc123', message: 'Shadow Clone Snapshot: snapshot-123' },
      lastCommit: {
        hash: 'abc123',
        message: 'feat: add feature',
        author: 'John Doe',
        date: '2024-01-01 12:00:00 +0900',
      },
    }

    it('--restoreオプションでスナップショットを復元する', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['snapshot-123.json'])
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSnapshot))
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'stash' && args[1] === 'list') {
          return createMockExecaResponse(
            'stash@{0}: Shadow Clone Snapshot: snapshot-123\nstash@{1}: Other stash'
          )
        }
        return createMockExecaResponse()
      })

      await snapshotCommand.parseAsync(['node', 'test', '--restore', 'snapshot-123'])

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        "スナップショット 'snapshot-123' を復元しました"
      )
      expect(execa).toHaveBeenCalledWith('git', ['stash', 'apply', 'stash@{0}'], expect.any(Object))
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📸 復元されたスナップショット:')
      )
    })

    it('短縮IDでも復元できる', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['snapshot-123456789.json'])
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          ...mockSnapshot,
          id: 'snapshot-123456789',
        })
      )
      
      // Setup execa mock for restore process specifically for this test
      vi.mocked(execa).mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'stash' && args[1] === 'list') {
          return createMockExecaResponse(
            'stash@{0}: Shadow Clone Snapshot: snapshot-123456789\nstash@{1}: Other stash'
          )
        }
        if (cmd === 'git' && args[0] === 'stash' && args[1] === 'apply') {
          return createMockExecaResponse()
        }
        // Return default mock for other git commands
        return createMockExecaResponse()
      })

      await snapshotCommand.parseAsync(['node', 'test', '--restore', 'snapshot-123'])

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('snapshot-123456789')
      )
    })

    it('worktreeが存在しない場合はエラーを表示', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['snapshot-123.json'])
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSnapshot))
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))

      await snapshotCommand.parseAsync(['node', 'test', '--restore', 'snapshot-123'])

      expect(mockSpinner.fail).toHaveBeenCalledWith("worktree '/repo/worktree-1' が存在しません")
    })

    it('未保存の変更がある場合は確認する', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['snapshot-123.json'])
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSnapshot))
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmRestore: true })

      await snapshotCommand.parseAsync(['node', 'test', '--restore', 'snapshot-123'])

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'confirmRestore',
            message: '現在の変更が失われる可能性があります。続行しますか？',
          }),
        ])
      )
    })

    it('復元をキャンセルできる', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['snapshot-123.json'])
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSnapshot))
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmRestore: false })

      await snapshotCommand.parseAsync(['node', 'test', '--restore', 'snapshot-123'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('復元をキャンセルしました'))
      expect(execa).not.toHaveBeenCalledWith(
        'git',
        ['stash', 'apply', expect.any(String)],
        expect.any(Object)
      )
    })
  })

  describe('スナップショット削除', () => {
    it('--deleteオプションでスナップショットを削除する', async () => {
      await snapshotCommand.parseAsync(['node', 'test', '--delete', 'snapshot-123'])

      expect(fs.unlink).toHaveBeenCalledWith('/repo/worktree-1/.scj/snapshots/snapshot-123.json')
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✨ スナップショット 'snapshot-123' を削除しました")
      )
    })

    it('短縮IDでも削除できる', async () => {
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('ENOENT'))
      vi.mocked(fs.readdir).mockResolvedValue(['snapshot-123456789.json'])
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          id: 'snapshot-123456789',
          branch: 'feature-a',
        })
      )

      await snapshotCommand.parseAsync(['node', 'test', '--delete', 'snapshot-123'])

      expect(fs.unlink).toHaveBeenCalledWith('/repo/worktree-1/.scj/snapshots/snapshot-123456789.json')
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✨ スナップショット 'snapshot-123456789' を削除しました")
      )
    })

    it('存在しないスナップショットの削除はエラー', async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error('ENOENT'))
      vi.mocked(fs.readdir).mockResolvedValue([])

      await expect(
        snapshotCommand.parseAsync(['node', 'test', '--delete', 'non-existent'])
      ).rejects.toThrow('process.exit called with code 1')

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("スナップショット 'non-existent' が見つかりません")
      )
    })
  })

  describe('エラーハンドリング', () => {
    it('Gitリポジトリでない場合エラーを表示する', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(snapshotCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('このディレクトリはGitリポジトリではありません')
      )
    })

    it('現在のディレクトリがworktreeでない場合エラーを表示', async () => {
      vi.spyOn(process, 'cwd').mockReturnValue('/other/path')

      await expect(snapshotCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('現在のディレクトリはworktreeではありません')
      )
    })

    it('影分身が存在しない場合（--allオプション）', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([
        createMockWorktree({ path: '/repo/.', branch: 'refs/heads/main' }),
      ])

      await snapshotCommand.parseAsync(['node', 'test', '--all'])

      expect(mockSpinner.fail).toHaveBeenCalledWith('影分身が存在しません')
    })

    it('スナップショット作成エラーを処理する', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write error'))

      await expect(snapshotCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('エラー:'),
        expect.stringContaining('Write error')
      )
    })
  })
})

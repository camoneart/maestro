import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { ConfigManager } from '../../core/config'
import fs from 'fs/promises'
import chokidar from 'chokidar'
import inquirer from 'inquirer'
import ora from 'ora'
import path from 'path'
import { watchCommand } from '../../commands/watch'
import {
  createMockWorktree,
  createMockWorktrees,
  createMockConfig,
  createMockSpinner,
} from '../utils/test-helpers'
import { EventEmitter } from 'events'
import { createHash } from 'crypto'

// モック設定
vi.mock('../../core/git')
vi.mock('../../core/config')
vi.mock('fs/promises')
vi.mock('chokidar')
vi.mock('inquirer')
vi.mock('ora')
vi.mock('crypto')

describe('watch command', () => {
  let mockGitManager: any
  let mockConfigManager: any
  let mockSpinner: any
  let mockWatcher: any

  beforeEach(() => {
    // EventEmitterの警告を抑制
    process.setMaxListeners(30)

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

    // ConfigManagerのモック
    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue({
        ...createMockConfig(),
      }),
    }
    vi.mocked(ConfigManager).mockImplementation(() => mockConfigManager)

    // Spinnerのモック
    mockSpinner = createMockSpinner()
    vi.mocked(ora).mockImplementation(() => mockSpinner)

    // Chokidarのモック
    mockWatcher = new EventEmitter()
    mockWatcher.close = vi.fn()
    vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    // fs.readFileのモック
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('file content'))

    // fs.accessのモック - ファイルが存在すると仮定
    vi.mocked(fs.access).mockResolvedValue(undefined)

    // fs.mkdirのモック
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)

    // fs.copyFileのモック
    vi.mocked(fs.copyFile).mockResolvedValue(undefined)

    // fs.unlinkのモック
    vi.mocked(fs.unlink).mockResolvedValue(undefined)

    // cryptoのモック
    vi.mocked(createHash).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mock-hash-value'),
    } as any)

    // pathのモック
    vi.spyOn(path, 'relative').mockImplementation((from, to) => {
      if (to.startsWith(from)) {
        return to.slice(from.length + 1)
      }
      return to
    })
    vi.spyOn(path, 'join').mockImplementation((...args) => args.join('/'))
    vi.spyOn(path, 'dirname').mockImplementation(p => p.split('/').slice(0, -1).join('/'))

    // process.cwdのモック
    vi.spyOn(process, 'cwd').mockReturnValue('/repo/worktree-1')

    // consoleのモック
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // process.exitのモック
    vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit called with code ${code}`)
    })

    // process.onのモック（SIGINT handling）
    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, listener: any) => process)
  })

  afterEach(() => {
    // ProcessManagerのクリーンアップ（テスト用）
    if (mockWatcher && mockWatcher.close) {
      mockWatcher.close()
    }
    vi.restoreAllMocks()
  })

  describe('Path validation tests - Critical Bug #189', () => {
    it('should prevent directory traversal attacks with ../ patterns', async () => {
      // slash付きブランチ名でのworktree構成をモック
      mockGitManager.listWorktrees.mockResolvedValue([
        createMockWorktree({
          path: '/repo/main',
          branch: 'refs/heads/main',
        }),
        createMockWorktree({
          path: '/repo/.git/orchestra-members/feature/awesome-feature',
          branch: 'refs/heads/feature/awesome-feature',
        }),
      ])

      // feature/awesome-featureブランチからの実行をシミュレート
      vi.spyOn(process, 'cwd').mockReturnValue(
        '/repo/.git/orchestra-members/feature/awesome-feature'
      )

      // 自動同期モードで実行
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all', '--auto'])
      await new Promise(resolve => setTimeout(resolve, 100))

      // 危険なパスを含むファイル変更をトリガー
      const dangerousPath = '../../../etc/passwd'
      mockWatcher.emit('add', dangerousPath)

      // バッチ処理のタイムアウトを待つ
      await new Promise(resolve => setTimeout(resolve, 1500))

      // パスバリデーションが動作して、危険なパスでfs.mkdirが呼ばれないことを確認
      expect(vi.mocked(fs.mkdir)).not.toHaveBeenCalled()
      expect(vi.mocked(fs.copyFile)).not.toHaveBeenCalled()

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('should detect and prevent infinite directory creation loops', async () => {
      // ループを引き起こす可能性のあるパス構成
      const loopPath = 'subdir/../../subdir/../../subdir'

      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all', '--auto'])
      await new Promise(resolve => setTimeout(resolve, 100))

      mockWatcher.emit('add', loopPath)
      await new Promise(resolve => setTimeout(resolve, 1500))

      // ループ検出が動作して、ファイル操作が実行されないことを確認
      expect(vi.mocked(fs.mkdir)).not.toHaveBeenCalled()
      expect(vi.mocked(fs.copyFile)).not.toHaveBeenCalled()

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('should properly handle slash-containing branch names', async () => {
      // slash付きブランチでの正常なファイル同期をテスト
      mockGitManager.listWorktrees.mockResolvedValue([
        createMockWorktree({
          path: '/repo/.git/orchestra-members/feature-test',
          branch: 'refs/heads/feature/test',
        }),
        createMockWorktree({
          path: '/repo/.git/orchestra-members/main',
          branch: 'refs/heads/main',
        }),
      ])

      vi.spyOn(process, 'cwd').mockReturnValue('/repo/.git/orchestra-members/feature-test')

      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all', '--auto'])
      await new Promise(resolve => setTimeout(resolve, 100))

      // 正常なファイルパス
      mockWatcher.emit('add', 'src/index.ts')
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 正常なパスでのみfs.mkdirが呼ばれることを確認
      expect(vi.mocked(fs.mkdir)).toHaveBeenCalledWith(
        expect.stringMatching(/^\/repo\/.git\/orchestra-members\/main\/src$/),
        { recursive: true }
      )

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('should validate target paths stay within worktree boundaries', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all', '--auto'])
      await new Promise(resolve => setTimeout(resolve, 100))

      // worktree境界を超えるパス
      const outsidePath = '../../../../outside/worktree/file.txt'
      mockWatcher.emit('add', outsidePath)
      await new Promise(resolve => setTimeout(resolve, 1500))

      // worktree外へのファイル作成が阻止されることを確認
      expect(vi.mocked(fs.mkdir)).not.toHaveBeenCalled()
      expect(vi.mocked(fs.copyFile)).not.toHaveBeenCalled()

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('should normalize paths before mkdir to prevent loops', async () => {
      // path.relativeが危険なパスを返す異常なケース
      // safeRelativePathから呼ばれるpath.relativeをモック
      vi.spyOn(path, 'relative').mockReturnValue('../feature/awesome-feature/src/index.ts')

      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all', '--auto'])
      await new Promise(resolve => setTimeout(resolve, 100))

      mockWatcher.emit('add', 'src/index.ts')
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 危険な相対パスがフィルタリングされることを確認
      expect(vi.mocked(fs.mkdir)).not.toHaveBeenCalled()
      expect(vi.mocked(fs.copyFile)).not.toHaveBeenCalled()

      // path.relativeのモックをリストア
      vi.mocked(path.relative).mockRestore()

      mockWatcher.emit('error', new Error('Test complete'))
    })
  })

  describe('基本的な動作', () => {
    it('現在のworktreeの変更を監視する', async () => {
      // --allオプションを追加して確認プロンプトをスキップ
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all'])

      // 少し待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(chokidar.watch).toHaveBeenCalledWith(
        ['**/*.ts', '**/*.js', '**/*.json', '**/*.md'],
        expect.objectContaining({
          cwd: '/repo/worktree-1',
          ignored: [
            'node_modules/**',
            '.git/**',
            '.maestro-metadata.json',
            'dist/**',
            'build/**',
            '.next/**',
            'coverage/**',
          ],
          persistent: true,
          ignoreInitial: true,
        })
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🔍 ファイル監視設定:'))
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('監視パターン: **/*.ts, **/*.js, **/*.json, **/*.md')
      )

      // watcherを閉じる
      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('ファイル追加を検出して同期する', async () => {
      // --allオプションと--autoを追加して確認をスキップ
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all', '--auto'])

      // 監視が開始されるまで少し待つ
      await new Promise(resolve => setTimeout(resolve, 100))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', 'src/new-file.ts')

      // バッチ処理のタイマーを待つ（1秒 + 余裕）
      await new Promise(resolve => setTimeout(resolve, 1200))

      expect(fs.copyFile).toHaveBeenCalledWith(
        '/repo/worktree-1/src/new-file.ts',
        '/repo/worktree-2/src/new-file.ts'
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📝 追加: src/new-file.ts'))
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ refs/heads/feature-b: src/new-file.ts')
      )

      // watcherを閉じる
      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('ファイル変更を検出して同期する', async () => {
      // --allオプションと--autoを追加して確認をスキップ
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all', '--auto'])

      await new Promise(resolve => setTimeout(resolve, 100))

      // ファイル変更イベントを発火
      mockWatcher.emit('change', 'src/existing.ts')

      await new Promise(resolve => setTimeout(resolve, 1200))

      expect(fs.copyFile).toHaveBeenCalledWith(
        '/repo/worktree-1/src/existing.ts',
        '/repo/worktree-2/src/existing.ts'
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📝 変更: src/existing.ts'))

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('ファイル削除を検出して同期する', async () => {
      // --allオプションと--autoを追加して確認をスキップ
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all', '--auto'])

      await new Promise(resolve => setTimeout(resolve, 100))

      // ファイル削除イベントを発火
      mockWatcher.emit('unlink', 'src/deleted.ts')

      await new Promise(resolve => setTimeout(resolve, 1200))

      expect(fs.unlink).toHaveBeenCalledWith('/repo/worktree-2/src/deleted.ts')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🗑️  削除: src/deleted.ts'))

      mockWatcher.emit('error', new Error('Test complete'))
    })
  })

  describe('オプション処理', () => {
    it('--patternsでカスタムパターンを指定できる', async () => {
      const watchPromise = watchCommand.parseAsync([
        'node',
        'test',
        '--patterns',
        '*.js',
        '*.ts',
        'lib/**/*',
        '--all',
      ])

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(chokidar.watch).toHaveBeenCalledWith(['*.js', '*.ts', 'lib/**/*'], expect.any(Object))

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('--excludeで除外パターンを追加できる', async () => {
      const watchPromise = watchCommand.parseAsync([
        'node',
        'test',
        '--exclude',
        '*.test.ts',
        'dist/**',
        '--all',
      ])

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(chokidar.watch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          ignored: ['*.test.ts', 'dist/**'],
        })
      )

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('--allで全worktree間で双方向同期する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // 1つのwatcherが作成され、全てのworktreeを同期対象とする
      expect(chokidar.watch).toHaveBeenCalledTimes(1)

      // コンソールメッセージで同期先確認
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('同期先: refs/heads/main, refs/heads/feature-b')
      )

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('--dryでドライランモードで実行する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--dry', '--all'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', 'src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 1100))

      // 実際のファイル操作は行われない
      expect(fs.copyFile).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[DRY]'))

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('--autoで確認なしに同期する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--auto', '--all'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', 'src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 1100))

      // inquirerが同期確認で呼ばれない（ただし初期の同期先選択がないため呼ばれない）
      expect(fs.copyFile).toHaveBeenCalled()

      mockWatcher.emit('error', new Error('Test complete'))
    })
  })

  describe('インタラクティブモード', () => {
    it('--autoなしの場合は同期確認を行う', async () => {
      // 簡単にするため、--allを使って同期先選択をスキップし、同期確認のみテスト
      vi.mocked(inquirer.prompt).mockResolvedValue({ proceed: true })

      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all'])

      await new Promise(resolve => setTimeout(resolve, 100))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', 'src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 1200))

      // 同期確認が行われたことを確認
      expect(inquirer.prompt).toHaveBeenCalled()
      expect(fs.copyFile).toHaveBeenCalled()

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('同期をキャンセルできる', async () => {
      // 同期確認で拒否
      vi.mocked(inquirer.prompt).mockResolvedValue({ proceed: false })

      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all'])

      await new Promise(resolve => setTimeout(resolve, 100))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', 'src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 1200))

      expect(fs.copyFile).not.toHaveBeenCalled()
      // スキップメッセージが出力されることを確認
      const consoleCalls = vi.mocked(console.log).mock.calls.map(call => call[0])
      expect(
        consoleCalls.some(
          call => typeof call === 'string' && call.includes('同期をスキップしました')
        )
      ).toBe(true)

      mockWatcher.emit('error', new Error('Test complete'))
    })
  })

  describe('エラーハンドリング', () => {
    it('Gitリポジトリでない場合エラーを表示する', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(watchCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('このディレクトリはGitリポジトリではありません')
    })

    it('worktreeが存在しない場合エラーを表示する', async () => {
      vi.spyOn(process, 'cwd').mockReturnValue('/other/path')

      await expect(watchCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('現在のディレクトリはworktreeではありません')
    })

    it('他のworktreeが存在しない場合メッセージを表示する', async () => {
      // 現在のworktreeのみが存在する場合
      mockGitManager.listWorktrees.mockResolvedValue([
        createMockWorktree({
          path: '/repo/worktree-1', // process.cwd() と同じパス
          branch: 'refs/heads/feature-a',
        }),
      ])

      // process.exitをモックして例外を投げないように
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        return undefined as never
      })

      // コマンドを実行
      await watchCommand.parseAsync(['node', 'test'])

      // 他のworktreeがないため、exit(0)で終了
      expect(exitSpy).toHaveBeenCalledWith(0)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('他のworktreeが存在しません')
      )

      // exitSpyをリストア
      exitSpy.mockRestore()
    })

    it('ファイル同期エラーを処理する', async () => {
      vi.mocked(fs.copyFile).mockRejectedValue(new Error('Permission denied'))

      // --allオプションと--autoを追加
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all', '--auto'])

      await new Promise(resolve => setTimeout(resolve, 100))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', 'src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 1200))

      // エラーが発生してもwatchは継続する
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('✗ refs/heads/main: エラー - Error: Permission denied')
      )

      mockWatcher.emit('error', new Error('Test complete'))
    })
  })

  describe('終了処理', () => {
    it('watcherが正常に初期化される', async () => {
      // --allオプションを追加
      watchCommand.parseAsync(['node', 'test', '--all'])

      await new Promise(resolve => setTimeout(resolve, 100))

      // watcherが正常に初期化されていることを確認
      expect(chokidar.watch).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🔍 ファイル監視設定:'))
    })
  })
})

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
  createMockSpinner
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
    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([
        createMockWorktree({ 
          path: '/repo/.', 
          branch: 'refs/heads/main' 
        }),
        createMockWorktree({ 
          path: '/repo/worktree-1', 
          branch: 'refs/heads/feature-a' 
        }),
        createMockWorktree({ 
          path: '/repo/worktree-2', 
          branch: 'refs/heads/feature-b' 
        }),
      ]),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    // ConfigManagerのモック
    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue({
        ...createMockConfig(),
        watch: {
          patterns: ['src/**/*', 'config/**/*'],
          exclude: ['node_modules/**', '*.log']
        }
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

    // fs.accessのモック
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
      digest: vi.fn().mockReturnValue('mock-hash-value')
    } as any)

    // pathのモック
    vi.spyOn(path, 'relative').mockImplementation((from, to) => {
      if (to.startsWith(from)) {
        return to.slice(from.length + 1)
      }
      return to
    })
    vi.spyOn(path, 'join').mockImplementation((...args) => args.join('/'))
    vi.spyOn(path, 'dirname').mockImplementation((p) => p.split('/').slice(0, -1).join('/'))

    // process.cwdのモック
    vi.spyOn(process, 'cwd').mockReturnValue('/repo/worktree-1')

    // consoleのモック
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // process.exitのモック
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with code ${code}`)
    })

    // process.onのモック（SIGINT handling）
    vi.spyOn(process, 'on').mockImplementation(() => process)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基本的な動作', () => {
    it('現在のworktreeの変更を監視する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test'])

      // 少し待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(chokidar.watch).toHaveBeenCalledWith(
        ['src/**/*', 'config/**/*'],
        expect.objectContaining({
          cwd: '/repo/worktree-1',
          ignored: ['node_modules/**', '*.log'],
          persistent: true
        })
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🔍 ファイル監視を開始しました'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('監視パターン: src/**/*、config/**/*'))

      // watcherを閉じる
      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('ファイル追加を検出して同期する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test'])

      // 少し待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', '/repo/worktree-1/src/new-file.ts')

      // 処理を待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(fs.copyFile).toHaveBeenCalledWith(
        '/repo/worktree-1/src/new-file.ts',
        '/repo/worktree-2/src/new-file.ts'
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📝 ファイル追加: src/new-file.ts'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✓ refs/heads/feature-b: src/new-file.ts'))

      // watcherを閉じる
      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('ファイル変更を検出して同期する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル変更イベントを発火
      mockWatcher.emit('change', '/repo/worktree-1/src/existing.ts')

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(fs.copyFile).toHaveBeenCalledWith(
        '/repo/worktree-1/src/existing.ts',
        '/repo/worktree-2/src/existing.ts'
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✏️  ファイル変更: src/existing.ts'))

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('ファイル削除を検出して同期する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル削除イベントを発火
      mockWatcher.emit('unlink', '/repo/worktree-1/src/deleted.ts')

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(fs.unlink).toHaveBeenCalledWith('/repo/worktree-2/src/deleted.ts')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🗑️  ファイル削除: src/deleted.ts'))

      mockWatcher.emit('error', new Error('Test complete'))
    })
  })

  describe('オプション処理', () => {
    it('--patternsでカスタムパターンを指定できる', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--patterns', '*.js,*.ts,lib/**/*'])

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(chokidar.watch).toHaveBeenCalledWith(
        ['*.js', '*.ts', 'lib/**/*'],
        expect.any(Object)
      )

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('--excludeで除外パターンを追加できる', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--exclude', '*.test.ts,dist/**'])

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(chokidar.watch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          ignored: ['node_modules/**', '*.log', '*.test.ts', 'dist/**']
        })
      )

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('--allで全worktree間で双方向同期する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--all'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // 複数のwatcherが作成される
      expect(chokidar.watch).toHaveBeenCalledTimes(2) // feature-aとfeature-b

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('--dryでドライランモードで実行する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--dry'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', '/repo/worktree-1/src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 50))

      // 実際のファイル操作は行われない
      expect(fs.copyFile).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[DRY]'))

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('--autoで確認なしに同期する', async () => {
      const watchPromise = watchCommand.parseAsync(['node', 'test', '--auto'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', '/repo/worktree-1/src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 50))

      // inquirerが呼ばれない
      expect(inquirer.prompt).not.toHaveBeenCalled()
      expect(fs.copyFile).toHaveBeenCalled()

      mockWatcher.emit('error', new Error('Test complete'))
    })
  })

  describe('インタラクティブモード', () => {
    it('--autoなしの場合は同期確認を行う', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmSync: true })

      const watchPromise = watchCommand.parseAsync(['node', 'test'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', '/repo/worktree-1/src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(inquirer.prompt).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          name: 'confirmSync',
          message: expect.stringContaining('他のworktreeに同期しますか？')
        })
      ]))
      expect(fs.copyFile).toHaveBeenCalled()

      mockWatcher.emit('error', new Error('Test complete'))
    })

    it('同期をキャンセルできる', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmSync: false })

      const watchPromise = watchCommand.parseAsync(['node', 'test'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', '/repo/worktree-1/src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(fs.copyFile).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('スキップしました'))

      mockWatcher.emit('error', new Error('Test complete'))
    })
  })

  describe('エラーハンドリング', () => {
    it('Gitリポジトリでない場合エラーを表示する', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(watchCommand.parseAsync(['node', 'test'])).rejects.toThrow('process.exit called with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith('このディレクトリはGitリポジトリではありません')
    })

    it('worktreeが存在しない場合エラーを表示する', async () => {
      vi.spyOn(process, 'cwd').mockReturnValue('/other/path')

      await expect(watchCommand.parseAsync(['node', 'test'])).rejects.toThrow('process.exit called with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith('現在のディレクトリはworktreeではありません')
    })

    it('影分身が存在しない場合エラーを表示する', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([
        createMockWorktree({ path: '/repo/.', branch: 'refs/heads/main' })
      ])

      await expect(watchCommand.parseAsync(['node', 'test'])).rejects.toThrow('process.exit called with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith('他の影分身が存在しません')
    })

    it('ファイル同期エラーを処理する', async () => {
      vi.mocked(fs.copyFile).mockRejectedValue(new Error('Permission denied'))

      const watchPromise = watchCommand.parseAsync(['node', 'test'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // ファイル追加イベントを発火
      mockWatcher.emit('add', '/repo/worktree-1/src/new-file.ts')

      await new Promise(resolve => setTimeout(resolve, 50))

      // エラーが発生してもwatchは継続する
      expect(console.error).not.toHaveBeenCalled()

      mockWatcher.emit('error', new Error('Test complete'))
    })
  })

  describe('終了処理', () => {
    it('SIGINTで適切に終了する', async () => {
      const listeners: { [key: string]: Function } = {}
      vi.spyOn(process, 'on').mockImplementation((event: string, listener: Function) => {
        listeners[event] = listener
        return process
      })

      const watchPromise = watchCommand.parseAsync(['node', 'test'])

      await new Promise(resolve => setTimeout(resolve, 50))

      // SIGINTをトリガー
      listeners['SIGINT']()

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ファイル監視を停止しています...'))
      expect(mockWatcher.close).toHaveBeenCalled()
    })
  })
})
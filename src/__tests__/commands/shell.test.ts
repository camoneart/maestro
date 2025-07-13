import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { spawn } from 'child_process'
import inquirer from 'inquirer'
import { execa } from 'execa'
import { shellCommand } from '../../commands/shell'
import {
  createMockWorktree,
  createMockWorktrees,
  createMockExecaResponse,
} from '../utils/test-helpers'
import { EventEmitter } from 'events'

// モック設定
vi.mock('../../core/git')
vi.mock('child_process')
vi.mock('inquirer')
vi.mock('execa')

describe('shell command', () => {
  let mockGitManager: any
  let mockShellProcess: any
  let mockFzfProcess: any

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
          locked: true,
        }),
      ]),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    // シェルプロセスのモック
    mockShellProcess = new EventEmitter() as any
    mockShellProcess.pid = 12345

    // fzfプロセスのモック
    mockFzfProcess = new EventEmitter() as any
    mockFzfProcess.stdin = {
      write: vi.fn(),
      end: vi.fn(),
    }
    mockFzfProcess.stdout = new EventEmitter()

    // spawnのモック
    vi.mocked(spawn).mockImplementation((command: string) => {
      if (command === 'fzf') {
        return mockFzfProcess
      }
      return mockShellProcess
    })

    // execaのモック
    vi.mocked(execa).mockResolvedValue(createMockExecaResponse() as any)

    // process.envのモック
    process.env.SHELL = '/bin/zsh'

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
    it('指定したブランチのシェルに入る', async () => {
      await shellCommand.parseAsync(['node', 'test', 'feature-a'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("🥷 影分身 'feature-a' に入ります...")
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('📁 /repo/worktree-1'))
      expect(spawn).toHaveBeenCalledWith(
        '/bin/zsh',
        [],
        expect.objectContaining({
          cwd: '/repo/worktree-1',
          stdio: 'inherit',
          env: expect.objectContaining({
            SHADOW_CLONE: 'feature-a',
            SHADOW_CLONE_PATH: '/repo/worktree-1',
          }),
        })
      )
    })

    it('影分身が存在しない場合は警告を表示', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([
        createMockWorktree({ path: '/repo/.', branch: 'refs/heads/main' }),
      ])

      await expect(shellCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('影分身が存在しません'))
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('scj create <branch-name> で影分身を作り出してください')
      )
    })

    it('存在しないブランチを指定した場合エラーを表示', async () => {
      await expect(shellCommand.parseAsync(['node', 'test', 'non-existent'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("エラー: 影分身 'non-existent' が見つかりません")
      )
    })

    it('類似したブランチ名を提案する', async () => {
      await expect(shellCommand.parseAsync(['node', 'test', 'feat'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('類似した影分身:'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature-a'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature-b'))
    })
  })

  describe('ブランチ選択', () => {
    it('inquirerでブランチを選択できる', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ selectedBranch: 'feature-b' })

      await shellCommand.parseAsync(['node', 'test'])

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'list',
            name: 'selectedBranch',
            message: 'どの影分身に入りますか？',
          }),
        ])
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("🥷 影分身 'feature-b' に入ります...")
      )
    })

    it('--fzfオプションでfzfを使用して選択できる', async () => {
      // fzf選択をシミュレート
      const fzfPromise = new Promise<void>(resolve => {
        setTimeout(() => {
          mockFzfProcess.stdout.emit('data', 'feature-a | /repo/worktree-1\n')
          mockFzfProcess.emit('close', 0)
          resolve()
        }, 50)
      })

      const commandPromise = shellCommand.parseAsync(['node', 'test', '--fzf'])
      
      await fzfPromise
      await commandPromise

      expect(spawn).toHaveBeenCalledWith(
        'fzf',
        expect.arrayContaining([
          '--ansi',
          '--header=影分身を選択してシェルに入る (Ctrl-C でキャンセル)',
        ]),
        expect.any(Object)
      )
      expect(mockFzfProcess.stdin.write).toHaveBeenCalled()
    })

    it('fzfでキャンセルした場合は終了する', async () => {
      // fzfプロセスのモックをキャンセル状態で作成
      const canceledFzfProcess = new EventEmitter() as any
      canceledFzfProcess.stdin = {
        write: vi.fn(),
        end: vi.fn(),
      }
      canceledFzfProcess.stdout = new EventEmitter()

      // beforeEachで設定されたspawnのモックを上書き
      const mockSpawn = vi.mocked(spawn)
      mockSpawn.mockReset()
      mockSpawn.mockReturnValue(canceledFzfProcess)

      // parseAsyncを開始して、その後即座にキャンセルを発火
      const commandPromise = shellCommand.parseAsync(['node', 'test', '--fzf'])
      
      // 非同期でキャンセルを実行
      process.nextTick(() => {
        canceledFzfProcess.emit('close', 1)
      })

      // コマンドがexitで終了することを確認
      await expect(commandPromise).rejects.toThrow('process.exit called with code 0')

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('キャンセルされました'))
    })
  })

  describe('コマンド実行オプション', () => {
    it('--cmdオプションでコマンドを実行して終了する', async () => {
      vi.mocked(execa).mockResolvedValue({
        ...createMockExecaResponse('Hello from feature-a'),
        exitCode: 0,
      } as any)

      await shellCommand.parseAsync(['node', 'test', 'feature-a', '--cmd', 'echo "Hello"'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🔧 コマンド実行: echo "Hello"')
      )
      expect(execa).toHaveBeenCalledWith(
        'echo "Hello"',
        [],
        expect.objectContaining({
          cwd: '/repo/worktree-1',
          stdio: 'inherit',
          shell: true,
          env: expect.objectContaining({
            SHADOW_CLONE: 'feature-a',
            SHADOW_CLONE_PATH: '/repo/worktree-1',
          }),
        })
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ コマンド実行完了 (exit code: 0)')
      )
    })

    it('コマンド実行が失敗した場合エラーを表示', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('Command failed'))

      await expect(
        shellCommand.parseAsync(['node', 'test', 'feature-a', '--cmd', 'invalid-command'])
      ).rejects.toThrow('process.exit called with code 1')

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ コマンド実行失敗: Command failed')
      )
    })
  })

  describe('tmuxオプション', () => {
    it('--tmuxオプションで既存のtmuxセッションにアタッチする', async () => {
      vi.mocked(execa).mockResolvedValue({
        ...createMockExecaResponse('shadow-clone-feature-a\nother-session'),
        stdout: 'shadow-clone-feature-a\nother-session',
      } as any)

      await shellCommand.parseAsync(['node', 'test', 'feature-a', '--tmux'])

      expect(execa).toHaveBeenCalledWith(
        'tmux',
        ['list-sessions', '-F', '#{session_name}'],
        expect.any(Object)
      )
      expect(spawn).toHaveBeenCalledWith(
        'tmux',
        ['attach-session', '-t', 'shadow-clone-feature-a'],
        expect.objectContaining({
          stdio: 'inherit',
        })
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("📺 既存のtmuxセッション 'shadow-clone-feature-a' にアタッチします")
      )
    })

    it('--tmuxオプションで新しいtmuxセッションを作成する', async () => {
      vi.mocked(execa).mockResolvedValue({
        ...createMockExecaResponse(''),
        stdout: '',
      } as any)

      await shellCommand.parseAsync(['node', 'test', 'feature-a', '--tmux'])

      expect(spawn).toHaveBeenCalledWith(
        'tmux',
        ['new-session', '-s', 'shadow-clone-feature-a'],
        expect.objectContaining({
          cwd: '/repo/worktree-1',
          stdio: 'inherit',
          env: expect.objectContaining({
            SHADOW_CLONE: 'feature-a',
            SHADOW_CLONE_PATH: '/repo/worktree-1',
          }),
        })
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("📺 新しいtmuxセッション 'shadow-clone-feature-a' を作成します")
      )
    })

    it('tmuxエラー時は通常のシェルで起動する', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('tmux not found'))

      await shellCommand.parseAsync(['node', 'test', 'feature-a', '--tmux'])

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ tmuxセッション処理に失敗: tmux not found')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('通常のシェルで起動します...')
      )
      expect(spawn).toHaveBeenCalledWith('/bin/zsh', [], expect.any(Object))
    })
  })

  describe('シェル環境設定', () => {
    it('zshの場合は適切なプロンプトを設定する', async () => {
      process.env.SHELL = '/bin/zsh'

      await shellCommand.parseAsync(['node', 'test', 'feature-a'])

      expect(spawn).toHaveBeenCalledWith(
        '/bin/zsh',
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            PS1: expect.stringContaining('🥷'),
            PROMPT: expect.stringContaining('🥷'),
          }),
        })
      )
    })

    it('bashの場合は適切なプロンプトを設定する', async () => {
      process.env.SHELL = '/bin/bash'

      await shellCommand.parseAsync(['node', 'test', 'feature-a'])

      expect(spawn).toHaveBeenCalledWith(
        '/bin/bash',
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            PS1: expect.stringContaining('🥷'),
          }),
        })
      )
    })

    it('fishの場合は適切なプロンプトを設定する', async () => {
      process.env.SHELL = '/usr/bin/fish'

      await shellCommand.parseAsync(['node', 'test', 'feature-a'])

      expect(spawn).toHaveBeenCalledWith(
        '/usr/bin/fish',
        [],
        expect.objectContaining({
          env: expect.objectContaining({
            fish_prompt: expect.stringContaining('🥷'),
          }),
        })
      )
    })

    it('SHELL環境変数が未設定の場合はbashを使用する', async () => {
      delete process.env.SHELL

      await shellCommand.parseAsync(['node', 'test', 'feature-a'])

      expect(spawn).toHaveBeenCalledWith('/bin/bash', [], expect.any(Object))
    })
  })

  describe('エラーハンドリング', () => {
    it('Gitリポジトリでない場合エラーを表示する', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      await expect(shellCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('エラー: このディレクトリはGitリポジトリではありません')
      )
    })

    it('一般的なエラーを処理する', async () => {
      mockGitManager.listWorktrees.mockRejectedValue(new Error('Git error'))

      await expect(shellCommand.parseAsync(['node', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('エラー:'),
        expect.stringContaining('Git error')
      )
    })
  })

  describe('シェル終了処理', () => {
    it('シェル終了時にメッセージを表示する', async () => {
      await shellCommand.parseAsync(['node', 'test', 'feature-a'])

      // シェル起動後の確認を無効化（spawnMockの行動に依存）
      // spawnコールを確認
      expect(spawn).toHaveBeenCalledWith(
        '/bin/zsh',
        [],
        expect.objectContaining({
          cwd: '/repo/worktree-1',
          stdio: 'inherit',
        })
      )

      // exitイベントに対するリスナーが設定されていることを確認
      // シェル終了をシミュレート
      mockShellProcess.emit('exit', 0)

      // 非同期処理を待つ
      await new Promise(resolve => setImmediate(resolve))

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('影分身から戻りました (exit code: 0)')
      )
    })
  })
})
import { describe, it, expect, beforeEach, afterEach, vi, SpyInstance, Mock } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { execa } from 'execa'
import fs from 'fs/promises'
import open from 'open'
import http from 'http'
import {
  createMockWorktree,
  createMockWorktrees,
  createMockExecaResponse,
  createMockSpinner,
} from '../utils/test-helpers'
import ora from 'ora'

// モック設定
vi.mock('../../core/git')
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('open')
vi.mock('ora')
vi.mock('http')

// dashboardCommand のインポートは最後に行う（モックが適用された後）
import { dashboardCommand } from '../../commands/dashboard'

describe('dashboard command', () => {
  let mockGitManager: any
  let mockSpinner: any
  let mockServer: any
  let mockCreateServer: Mock
  let processOnSpy: SpyInstance
  let processExitSpy: SpyInstance

  beforeEach(() => {
    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue(createMockWorktrees(3)),
      getLastCommit: vi.fn().mockResolvedValue({
        date: new Date().toISOString(),
        message: 'Initial commit',
        hash: 'abc123',
      }),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    // Spinnerのモック
    mockSpinner = createMockSpinner()
    vi.mocked(ora).mockImplementation(() => mockSpinner)

    // HTTPサーバーのモック
    mockServer = {
      listen: vi.fn((port, callback) => {
        // コールバックを非同期で実行
        if (callback) {
          process.nextTick(callback)
        }
      }),
      close: vi.fn(callback => {
        if (callback) {
          process.nextTick(callback)
        }
      }),
      on: vi.fn(),
    }

    // createServerのモック
    mockCreateServer = vi.fn(handler => {
      // リクエストハンドラーを保存
      if (typeof handler === 'function') {
        mockServer._requestHandler = handler
      }
      return mockServer
    })
    vi.mocked(http.createServer).mockImplementation(mockCreateServer)

    // process.on のモック（SIGINT ハンドラーを登録しないように）
    const originalOn = process.on.bind(process)
    processOnSpy = vi.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (event === 'SIGINT') {
        // SIGINT の場合は何もしない
        return process
      }
      return originalOn(event, handler)
    })

    // process.exit のモック
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      // process.exit をモックして、実際には終了しない
      return undefined as never
    }) as any)

    // openのモック
    vi.mocked(open).mockResolvedValue()

    // execaのモック
    vi.mocked(execa).mockResolvedValue(createMockExecaResponse())

    // fs.readFileのモック
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        createdAt: new Date().toISOString(),
        branch: 'feature-test',
        worktreePath: '/path/to/worktree',
        github: {
          type: 'issue',
          title: 'Test Issue',
          body: 'Test body',
          author: 'testuser',
          labels: ['bug'],
          assignees: ['testuser'],
          url: 'https://github.com/owner/repo/issues/123',
          issueNumber: '123',
        },
      })
    )

    // consoleのモック
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('サーバー起動', () => {
    it('デフォルトポートでサーバーを起動できる', async () => {
      const promise = dashboardCommand.parseAsync(['node', 'test'])

      // サーバーが起動するまで待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockCreateServer).toHaveBeenCalled()
      expect(mockServer.listen).toHaveBeenCalledWith(8765, expect.any(Function))
      expect(mockSpinner.succeed).toHaveBeenCalledWith('ダッシュボードサーバーが起動しました')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('http://localhost:8765'))
    })

    it('カスタムポートでサーバーを起動できる', async () => {
      const promise = dashboardCommand.parseAsync(['node', 'test', '--port', '3000'])

      // サーバーが起動するまで待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockServer.listen).toHaveBeenCalledWith(3000, expect.any(Function))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('http://localhost:3000'))
    })

    it('デフォルトでブラウザを自動で開く', async () => {
      const promise = dashboardCommand.parseAsync(['node', 'test'])

      // サーバーが起動するまで待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(open).toHaveBeenCalledWith('http://localhost:8765')
    })

    it('--no-openオプションでブラウザを開かない', async () => {
      const promise = dashboardCommand.parseAsync(['node', 'test', '--no-open'])

      // サーバーが起動するまで待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(open).not.toHaveBeenCalled()
    })
  })

  describe('APIエンドポイント', () => {
    let requestHandler: Function

    beforeEach(async () => {
      // コマンドを一度実行してサーバーを起動
      await dashboardCommand.parseAsync(['node', 'test'])

      // createServerが呼ばれたことを確認
      expect(mockCreateServer).toHaveBeenCalled()

      // createServerに渡されたリクエストハンドラーを取得
      requestHandler = mockCreateServer.mock.calls[0][0] as Function
    })

    it('/api/worktreesでworktreeデータを返す', async () => {
      expect(requestHandler).toBeDefined()
      expect(typeof requestHandler).toBe('function')

      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json',
      })
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('worktrees'))
    })

    it('メタデータとヘルスチェックを含む', async () => {
      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      const responseData = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(responseData).toHaveProperty('worktrees')
      expect(responseData).toHaveProperty('stats')
      expect(responseData.stats).toHaveProperty('active')
      expect(responseData.stats).toHaveProperty('githubLinked')
    })

    it('/でHTMLを返す', async () => {
      const mockReq = { url: '/', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html; charset=utf-8',
      })
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'))
    })

    it('/api/open-editorでエディタを開く', async () => {
      const mockReq = {
        url: '/api/open-editor',
        method: 'POST',
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({ path: '/path/to/worktree' }))
          } else if (event === 'end') {
            callback()
          }
        }),
      }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(execa).toHaveBeenCalledWith('cursor', ['/path/to/worktree'])
      expect(mockRes.writeHead).toHaveBeenCalledWith(200)
    })

    it('/api/open-terminalでターミナルを開く', async () => {
      const mockReq = {
        url: '/api/open-terminal',
        method: 'POST',
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({ path: '/path/to/worktree' }))
          } else if (event === 'end') {
            callback()
          }
        }),
      }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(execa).toHaveBeenCalledWith('open', ['-a', 'Terminal', '/path/to/worktree'])
      expect(mockRes.writeHead).toHaveBeenCalledWith(200)
    })

    it('存在しないエンドポイントで404を返す', async () => {
      const mockReq = { url: '/invalid', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalledWith(404)
      expect(mockRes.end).toHaveBeenCalledWith('Not Found')
    })

    it('CORSヘッダーを設定する', async () => {
      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
      )
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type')
    })

    it('OPTIONSリクエストに対応する', async () => {
      const mockReq = { url: '/api/worktrees', method: 'OPTIONS' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200)
      expect(mockRes.end).toHaveBeenCalled()
    })
  })

  describe('シグナルハンドリング', () => {
    it('SIGINTハンドラーが登録される', async () => {
      const promise = dashboardCommand.parseAsync(['node', 'test'])

      // サーバーが起動するまで待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      // SIGINTハンドラーが登録されたことを確認
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    })
  })

  describe('エラーハンドリング', () => {
    it('サーバー起動エラーを適切に処理する', async () => {
      // サーバー起動時にエラーを発生させる
      mockServer.listen.mockImplementation(() => {
        throw new Error('Failed to start server')
      })

      try {
        await dashboardCommand.parseAsync(['node', 'test'])
      } catch (error) {
        // エラーが発生することを期待
      }

      expect(mockSpinner.fail).toHaveBeenCalledWith('ダッシュボードサーバーの起動に失敗しました')
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to start server'))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('APIエラーを500エラーとして返す', async () => {
      // エラーを発生させるようにモックを設定
      mockGitManager.listWorktrees.mockRejectedValue(new Error('Database error'))

      const promise = dashboardCommand.parseAsync(['node', 'test'])

      // サーバーが起動するまで待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      const requestHandler = mockCreateServer.mock.calls[0][0] as Function

      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalledWith(500)
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Database error'))
    })

    it('メタデータ読み込みエラーを無視する', async () => {
      // メタデータ読み込みでエラーを発生させる
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

      const promise = dashboardCommand.parseAsync(['node', 'test'])

      // サーバーが起動するまで待つ
      await new Promise(resolve => setTimeout(resolve, 50))

      const requestHandler = mockCreateServer.mock.calls[0][0] as Function

      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      // エラーが発生してもレスポンスが返ることを確認
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json',
      })
      expect(mockRes.end).toHaveBeenCalled()
    })
  })
})

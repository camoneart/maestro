import { describe, it, expect, beforeEach, afterEach, vi, SpyInstance } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { execa } from 'execa'
import fs from 'fs/promises'
import open from 'open'
import http from 'http'
import { dashboardCommand } from '../../commands/dashboard'
import { 
  createMockWorktree, 
  createMockWorktrees,
  createMockExecaResponse,
  createMockSpinner
} from '../utils/test-helpers'
import ora from 'ora'

// モック設定
vi.mock('../../core/git')
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('open')
vi.mock('ora')

describe('dashboard command', () => {
  let mockGitManager: any
  let mockSpinner: any
  let mockServer: any
  let serverListenSpy: SpyInstance

  beforeEach(() => {
    // GitWorktreeManagerのモック
    mockGitManager = {
      listWorktrees: vi.fn().mockResolvedValue(createMockWorktrees(3)),
      getLastCommit: vi.fn().mockResolvedValue({
        date: new Date().toISOString(),
        message: 'Initial commit',
        hash: 'abc123'
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
        if (callback) process.nextTick(callback)
      }),
      close: vi.fn((callback) => {
        if (callback) process.nextTick(callback)
      }),
    }

    // createServerのモック
    serverListenSpy = vi.spyOn(http, 'createServer').mockReturnValue(mockServer as any)

    // openのモック
    vi.mocked(open).mockResolvedValue()

    // execaのモック
    vi.mocked(execa).mockResolvedValue(createMockExecaResponse())

    // fs.readFileのモック
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
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
        issueNumber: '123'
      }
    }))

    // consoleのモック
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // process.exitのモック
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with code ${code}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('サーバー起動', () => {
    it('デフォルトポートでサーバーを起動できる', async () => {
      await dashboardCommand.parseAsync(['node', 'test'])

      expect(mockServer.listen).toHaveBeenCalledWith(8765, expect.any(Function))
      expect(mockSpinner.succeed).toHaveBeenCalledWith('ダッシュボードサーバーが起動しました')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('http://localhost:8765'))
    })

    it('カスタムポートでサーバーを起動できる', async () => {
      await dashboardCommand.parseAsync(['node', 'test', '--port', '3000'])

      expect(mockServer.listen).toHaveBeenCalledWith(3000, expect.any(Function))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('http://localhost:3000'))
    })

    it('デフォルトでブラウザを自動で開く', async () => {
      await dashboardCommand.parseAsync(['node', 'test'])

      expect(open).toHaveBeenCalledWith('http://localhost:8765')
    })

    it('--no-openオプションでブラウザを開かない', async () => {
      await dashboardCommand.parseAsync(['node', 'test', '--no-open'])

      expect(open).not.toHaveBeenCalled()
    })
  })

  describe('APIエンドポイント', () => {
    let requestHandler: Function

    beforeEach(() => {
      // createServerに渡されるリクエストハンドラーをキャプチャ
      serverListenSpy.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })
    })

    it('/api/worktreesでworktreeデータを返す', async () => {
      await dashboardCommand.parseAsync(['node', 'test'])

      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('"worktrees"'))
      
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(responseData.worktrees).toHaveLength(3)
      expect(responseData.stats).toBeDefined()
    })

    it('メタデータとヘルスチェックを含む', async () => {
      // 古いコミット（31日前）を返す
      mockGitManager.getLastCommit.mockResolvedValue({
        date: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        message: 'Old commit',
        hash: 'old123'
      })

      // 未コミットの変更を返す
      vi.mocked(execa).mockImplementation((cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'status') {
          return Promise.resolve(createMockExecaResponse('M src/file.ts\n?? new-file.txt'))
        }
        return Promise.resolve(createMockExecaResponse())
      })

      await dashboardCommand.parseAsync(['node', 'test'])

      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      const responseData = JSON.parse(mockRes.end.mock.calls[0][0])
      const worktree = responseData.worktrees[0]
      
      expect(worktree.metadata).toBeDefined()
      expect(worktree.metadata.github).toBeDefined()
      expect(worktree.health).toContain('stale')
      expect(worktree.health).toContain('uncommitted')
    })

    it('/でHTMLを返す', async () => {
      await dashboardCommand.parseAsync(['node', 'test'])

      const mockReq = { url: '/', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html; charset=utf-8' })
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'))
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Shadow Clone Jutsu Dashboard'))
    })

    it('/api/open-editorでエディタを開く', async () => {
      await dashboardCommand.parseAsync(['node', 'test'])

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
      await dashboardCommand.parseAsync(['node', 'test'])

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
      await dashboardCommand.parseAsync(['node', 'test'])

      const mockReq = { url: '/api/unknown', method: 'GET' }
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
      await dashboardCommand.parseAsync(['node', 'test'])

      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type')
    })

    it('OPTIONSリクエストに対応する', async () => {
      await dashboardCommand.parseAsync(['node', 'test'])

      const mockReq = { method: 'OPTIONS' }
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
    it('SIGINTでサーバーを適切に停止する', async () => {
      const listeners: { [key: string]: Function } = {}
      vi.spyOn(process, 'on').mockImplementation((event: string, listener: Function) => {
        listeners[event] = listener
        return process
      })

      await dashboardCommand.parseAsync(['node', 'test'])

      // SIGINTハンドラーをトリガー
      await listeners['SIGINT']()

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('停止中...'))
      expect(mockServer.close).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('停止しました'))
    })
  })

  describe('エラーハンドリング', () => {
    it('サーバー起動エラーを適切に処理する', async () => {
      mockServer.listen.mockImplementation(() => {
        throw new Error('Port already in use')
      })

      await expect(dashboardCommand.parseAsync(['node', 'test'])).rejects.toThrow('process.exit called with code 1')
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('ダッシュボードサーバーの起動に失敗しました')
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Port already in use'))
    })

    it('APIエラーを500エラーとして返す', async () => {
      let requestHandler: Function
      serverListenSpy.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })

      // worktree取得をエラーにする
      mockGitManager.listWorktrees.mockRejectedValue(new Error('Git error'))

      await dashboardCommand.parseAsync(['node', 'test'])

      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      expect(mockRes.writeHead).toHaveBeenCalledWith(500)
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Git error'))
    })

    it('メタデータ読み込みエラーを無視する', async () => {
      let requestHandler: Function
      serverListenSpy.mockImplementation((handler) => {
        requestHandler = handler
        return mockServer
      })

      // メタデータ読み込みを失敗させる
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

      await dashboardCommand.parseAsync(['node', 'test'])

      const mockReq = { url: '/api/worktrees', method: 'GET' }
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      await requestHandler(mockReq, mockRes)

      // エラーが発生してもレスポンスが返ることを確認
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0])
      expect(responseData.worktrees[0].metadata).toBeNull()
    })
  })
})
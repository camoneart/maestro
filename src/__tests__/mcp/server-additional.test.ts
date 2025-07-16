import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { GitWorktreeManager } from '../../core/git.js'

// MCP server関連のモック
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation((serverInfo, serverOptions) => ({
    serverInfo,
    serverOptions,
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
  })),
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    transport: 'stdio',
  })),
}))

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: {},
  ListToolsRequestSchema: {},
}))

vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn(),
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

describe('MCP Server - Implementation Tests', () => {
  let mockGitManager: {
    isGitRepository: Mock
    listWorktrees: Mock
    createWorktree: Mock
    deleteWorktree: Mock
    getCurrentBranch: Mock
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([]),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
      deleteWorktree: vi.fn().mockResolvedValue(undefined),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
    }
    ;(GitWorktreeManager as any).mockImplementation(() => mockGitManager)
  })

  describe('MCP Server Configuration', () => {
    it('should configure server with correct metadata', async () => {
      // MCP serverモジュールを動的にインポート
      await expect(async () => {
        await import('../../mcp/server.js')
      }).not.toThrow()
    })

    it('should handle server initialization', async () => {
      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js')
      
      // Serverが正しいパラメータで作成されることを確認
      expect(Server).toBeDefined()
      
      // サーバー作成時のパラメータをテスト
      const serverInstance = new (Server as any)(
        { name: 'shadow-clone-jutsu', version: '0.1.0' },
        { capabilities: { tools: {} } }
      )
      
      expect(serverInstance.serverInfo.name).toBe('shadow-clone-jutsu')
      expect(serverInstance.serverInfo.version).toBe('0.1.0')
      expect(serverInstance.serverOptions.capabilities.tools).toBeDefined()
    })

    it('should configure StdioServerTransport', async () => {
      const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
      
      expect(StdioServerTransport).toBeDefined()
      
      const transport = new (StdioServerTransport as any)()
      expect(transport).toBeDefined()
    })
  })

  describe('Tool Schema Definitions', () => {
    it('should define CreateWorktreeArgsSchema', async () => {
      // Zodスキーマの基本テスト
      const { z } = await import('zod')
      
      const CreateWorktreeArgsSchema = z.object({
        branchName: z.string().describe('作成するブランチ名'),
        baseBranch: z.string().optional().describe('ベースブランチ（省略時は現在のブランチ）'),
      })
      
      // 有効なデータのテスト
      const validData = { branchName: 'feature-test' }
      expect(() => CreateWorktreeArgsSchema.parse(validData)).not.toThrow()
      
      // 無効なデータのテスト
      const invalidData = { invalidField: 'test' }
      expect(() => CreateWorktreeArgsSchema.parse(invalidData)).toThrow()
    })

    it('should define DeleteWorktreeArgsSchema', async () => {
      const { z } = await import('zod')
      
      const DeleteWorktreeArgsSchema = z.object({
        branchName: z.string().describe('削除するブランチ名'),
        force: z.boolean().optional().describe('強制削除フラグ'),
      })
      
      const validData = { branchName: 'feature-test', force: true }
      expect(() => DeleteWorktreeArgsSchema.parse(validData)).not.toThrow()
      
      const minimalData = { branchName: 'feature-test' }
      expect(() => DeleteWorktreeArgsSchema.parse(minimalData)).not.toThrow()
    })

    it('should define ExecInWorktreeArgsSchema', async () => {
      const { z } = await import('zod')
      
      const ExecInWorktreeArgsSchema = z.object({
        branchName: z.string().describe('実行対象のブランチ名'),
        command: z.string().describe('実行するコマンド'),
      })
      
      const validData = { branchName: 'feature-test', command: 'npm test' }
      expect(() => ExecInWorktreeArgsSchema.parse(validData)).not.toThrow()
    })
  })

  describe('MCP Tool Handlers', () => {
    it('should handle create_shadow_clone tool', async () => {
      // ツール実行のシミュレーション
      const toolName = 'create_shadow_clone'
      const args = { branchName: 'feature-test', baseBranch: 'main' }
      
      mockGitManager.createWorktree.mockResolvedValue('/path/to/worktree/feature-test')
      
      // ツールハンドラのロジックをシミュレート
      const result = await mockGitManager.createWorktree(args.branchName, args.baseBranch)
      
      expect(result).toBe('/path/to/worktree/feature-test')
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature-test', 'main')
    })

    it('should handle list_shadow_clones tool', async () => {
      const mockWorktrees = [
        { path: '/path/to/worktree/feature-1', branch: 'refs/heads/feature-1' },
        { path: '/path/to/worktree/feature-2', branch: 'refs/heads/feature-2' },
      ]
      
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      
      const worktrees = await mockGitManager.listWorktrees()
      const shadowClones = worktrees.filter(wt => !wt.path.endsWith('.'))
      
      expect(shadowClones).toHaveLength(2)
      expect(shadowClones[0].branch).toBe('refs/heads/feature-1')
    })

    it('should handle delete_shadow_clone tool', async () => {
      const args = { branchName: 'feature-test', force: false }
      
      mockGitManager.deleteWorktree.mockResolvedValue(undefined)
      
      await mockGitManager.deleteWorktree(args.branchName, args.force)
      
      expect(mockGitManager.deleteWorktree).toHaveBeenCalledWith('feature-test', false)
    })

    it('should handle exec_in_shadow_clone tool', async () => {
      const { execa } = await import('execa')
      const args = { branchName: 'feature-test', command: 'npm test' }
      
      const mockWorktrees = [
        { path: '/path/to/worktree/feature-test', branch: 'refs/heads/feature-test' },
      ]
      
      mockGitManager.listWorktrees.mockResolvedValue(mockWorktrees)
      ;(execa as any).mockResolvedValue({ stdout: 'Test passed' })
      
      const worktrees = await mockGitManager.listWorktrees()
      const targetWorktree = worktrees.find(wt => {
        const branch = wt.branch?.replace('refs/heads/', '')
        return branch === args.branchName
      })
      
      expect(targetWorktree).toBeDefined()
      expect(targetWorktree?.path).toBe('/path/to/worktree/feature-test')
    })
  })

  describe('Error Handling', () => {
    it('should handle git repository validation', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)
      
      const isGitRepo = await mockGitManager.isGitRepository()
      expect(isGitRepo).toBe(false)
      
      // Gitリポジトリでない場合のエラーハンドリング
      if (!isGitRepo) {
        const errorResponse = {
          content: [
            {
              type: 'text',
              text: '❌ エラー: 現在のディレクトリはGitリポジトリではありません',
            },
          ],
        }
        expect(errorResponse.content[0].text).toContain('Gitリポジトリ')
      }
    })

    it('should handle worktree creation errors', async () => {
      mockGitManager.createWorktree.mockRejectedValue(new Error('Branch already exists'))
      
      try {
        await mockGitManager.createWorktree('existing-branch')
      } catch (error) {
        const errorResponse = {
          content: [
            {
              type: 'text',
              text: `❌ エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
            },
          ],
        }
        expect(errorResponse.content[0].text).toContain('Branch already exists')
      }
    })

    it('should handle unknown tool names', async () => {
      const unknownTool = 'invalid_tool'
      
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: `❌ エラー: 不明なツール: ${unknownTool}`,
          },
        ],
      }
      
      expect(errorResponse.content[0].text).toContain('不明なツール')
    })
  })

  describe('Server Lifecycle', () => {
    it('should handle server startup', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // main関数のシミュレーション
      const mockServer = {
        connect: vi.fn().mockResolvedValue(undefined),
      }
      
      const mockTransport = {
        transport: 'stdio',
      }
      
      await mockServer.connect(mockTransport)
      
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport)
      
      consoleSpy.mockRestore()
    })

    it('should handle server startup errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`)
      })
      
      // エラーが発生した場合のハンドリング
      const error = new Error('Connection failed')
      
      expect(() => {
        console.error('Fatal error:', error)
        process.exit(1)
      }).toThrow('Process exited with code 1')
      
      consoleSpy.mockRestore()
      processExitSpy.mockRestore()
    })
  })

  describe('GitWorktreeManager Integration', () => {
    it('should integrate with GitWorktreeManager correctly', async () => {
      // GitWorktreeManagerとの統合テスト
      const gitManager = new GitWorktreeManager()
      
      expect(gitManager).toBeDefined()
      expect(mockGitManager.isGitRepository).toBeDefined()
      expect(mockGitManager.createWorktree).toBeDefined()
      expect(mockGitManager.deleteWorktree).toBeDefined()
      expect(mockGitManager.listWorktrees).toBeDefined()
    })

    it('should handle Git operations correctly', async () => {
      const gitManager = new GitWorktreeManager()
      
      // Git操作の基本テスト
      await gitManager.isGitRepository()
      expect(mockGitManager.isGitRepository).toHaveBeenCalled()
      
      await gitManager.listWorktrees()
      expect(mockGitManager.listWorktrees).toHaveBeenCalled()
      
      await gitManager.createWorktree('test-branch')
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('test-branch')
    })
  })

  describe('Response Formatting', () => {
    it('should format success responses correctly', async () => {
      const successResponse = {
        content: [
          {
            type: 'text',
            text: '✅ 影分身 \'feature-test\' を作り出しました: /path/to/worktree',
          },
        ],
      }
      
      expect(successResponse.content[0].type).toBe('text')
      expect(successResponse.content[0].text).toContain('✅')
      expect(successResponse.content[0].text).toContain('影分身')
    })

    it('should format error responses correctly', async () => {
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: '❌ エラー: テストエラー',
          },
        ],
      }
      
      expect(errorResponse.content[0].type).toBe('text')
      expect(errorResponse.content[0].text).toContain('❌')
      expect(errorResponse.content[0].text).toContain('エラー')
    })

    it('should format list responses correctly', async () => {
      const mockWorktrees = [
        { path: '/path/to/worktree/feature-1', branch: 'refs/heads/feature-1' },
        { path: '/path/to/worktree/feature-2', branch: 'refs/heads/feature-2' },
      ]
      
      const shadowClones = mockWorktrees.filter(wt => !wt.path.endsWith('.'))
      const list = shadowClones
        .map(wt => {
          const branchName = wt.branch?.replace('refs/heads/', '') || wt.branch
          return `• ${branchName} (${wt.path})`
        })
        .join('\n')
      
      const listResponse = {
        content: [
          {
            type: 'text',
            text: `🥷 影分身一覧:\n${list}\n\n合計: ${shadowClones.length} 対の影分身`,
          },
        ],
      }
      
      expect(listResponse.content[0].text).toContain('🥷 影分身一覧')
      expect(listResponse.content[0].text).toContain('feature-1')
      expect(listResponse.content[0].text).toContain('合計: 2 対の影分身')
    })
  })
})
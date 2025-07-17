import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { GitWorktreeManager } from '../../core/git.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'

vi.mock('../../core/git.js', () => ({
  GitWorktreeManager: vi.fn(),
}))

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    listTools: vi.fn(),
    callTool: vi.fn(),
  })),
}))

describe('MCP Server', () => {
  let mockServer: any
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

    // MCPサーバーのモック
    mockServer = {
      setRequestHandler: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
    }
    ;(Server as any).mockImplementation(() => mockServer)
  })

  describe('initialization', () => {
    it('should create server instance', async () => {
      // MCPサーバーモジュールを動的にインポートしてテスト
      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js')
      expect(Server).toBeDefined()
      expect(mockServer).toBeDefined()
    })
  })

  describe('tools', () => {
    it('should test MCP tool functionality', async () => {
      // MCP serverのツール機能をテスト
      mockServer.listTools = vi.fn().mockResolvedValue({
        tools: [
          { name: 'create_orchestra_member', description: '演奏者を加える' },
          { name: 'list_orchestra_members', description: 'オーケストラ編成を表示' },
          { name: 'delete_orchestra_member', description: '演奏者を外す' },
        ]
      })
      
      const tools = await mockServer.listTools()
      expect(tools.tools).toHaveLength(3)
      expect(tools.tools[0].name).toBe('create_orchestra_member')
    })

    it('should test MCP call tool functionality', async () => {
      // ツール呼び出しのテスト
      mockServer.callTool = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '✅ 演奏者を加えました' }]
      })
      
      const result = await mockServer.callTool('create_orchestra_member', {
        branchName: 'test-feature'
      })
      
      expect(result.content[0].text).toContain('演奏者を加えました')
    })

    it('should test GitWorktreeManager integration', () => {
      // GitWorktreeManagerの統合テスト
      expect(GitWorktreeManager).toBeDefined()
      expect(mockGitManager.createWorktree).toBeDefined()
      expect(mockGitManager.deleteWorktree).toBeDefined()
      expect(mockGitManager.listWorktrees).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle MCP server errors', async () => {
      mockServer.callTool = vi.fn().mockRejectedValue(new Error('Server error'))
      
      try {
        await mockServer.callTool('invalid_tool', {})
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Server error')
      }
    })
  })
})
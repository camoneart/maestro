#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// テスト環境では早期リターンしてprocess.exitを避ける
if (process.env.NODE_ENV === 'test') {
  console.log('🥷 shadow-clone-jutsu MCP server started')
  // process.exit(0) を削除し、モジュールの読み込みを継続
}
import { z } from 'zod'
import { GitWorktreeManager } from '../core/git.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'))

// ツールのスキーマ定義
const CreateWorktreeArgsSchema = z.object({
  branchName: z.string().describe('作成するブランチ名'),
  baseBranch: z.string().optional().describe('ベースブランチ（省略時は現在のブランチ）'),
})

const DeleteWorktreeArgsSchema = z.object({
  branchName: z.string().describe('削除するブランチ名'),
  force: z.boolean().optional().describe('強制削除フラグ'),
})

const ExecInWorktreeArgsSchema = z.object({
  branchName: z.string().describe('実行対象のブランチ名'),
  command: z.string().describe('実行するコマンド'),
})

// MCPサーバーの作成
const server = new Server(
  {
    name: 'shadow-clone-jutsu',
    version: packageJson.version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// GitWorktreeManagerのインスタンス
const gitManager = new GitWorktreeManager()

// ツール定義
const TOOLS = [
  {
    name: 'create_shadow_clone',
    description: '新しい影分身（Git worktree）を作り出す',
    inputSchema: {
      type: 'object',
      properties: {
        branchName: {
          type: 'string',
          description: '作成するブランチ名',
        },
        baseBranch: {
          type: 'string',
          description: 'ベースブランチ（省略時は現在のブランチ）',
        },
      },
      required: ['branchName'],
    },
  },
  {
    name: 'list_shadow_clones',
    description: 'すべての影分身（Git worktree）を一覧表示',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'delete_shadow_clone',
    description: '影分身（Git worktree）を削除',
    inputSchema: {
      type: 'object',
      properties: {
        branchName: {
          type: 'string',
          description: '削除するブランチ名',
        },
        force: {
          type: 'boolean',
          description: '強制削除フラグ',
        },
      },
      required: ['branchName'],
    },
  },
  {
    name: 'exec_in_shadow_clone',
    description: '影分身でコマンドを実行',
    inputSchema: {
      type: 'object',
      properties: {
        branchName: {
          type: 'string',
          description: '実行対象のブランチ名',
        },
        command: {
          type: 'string',
          description: '実行するコマンド',
        },
      },
      required: ['branchName', 'command'],
    },
  },
]

// ツール一覧のハンドラー
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  }
})

// ツール実行のハンドラー
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'create_shadow_clone': {
        const validatedArgs = CreateWorktreeArgsSchema.parse(args)
        const worktreePath = await gitManager.createWorktree(
          validatedArgs.branchName,
          validatedArgs.baseBranch
        )
        return {
          content: [
            {
              type: 'text',
              text: `✅ 影分身 '${validatedArgs.branchName}' を作り出しました！\n📁 ${worktreePath}`,
            },
          ],
        }
      }

      case 'list_shadow_clones': {
        const worktrees = await gitManager.listWorktrees()
        const shadowClones = worktrees.filter(wt => !wt.path.endsWith('.'))

        const list = shadowClones
          .map(wt => {
            const branchName = wt.branch?.replace('refs/heads/', '') || wt.branch
            return `• ${branchName} (${wt.path})`
          })
          .join('\n')

        return {
          content: [
            {
              type: 'text',
              text:
                shadowClones.length > 0
                  ? `🥷 影分身一覧:\n${list}\n\n合計: ${shadowClones.length} 個の影分身`
                  : '影分身が存在しません',
            },
          ],
        }
      }

      case 'delete_shadow_clone': {
        const validatedArgs = DeleteWorktreeArgsSchema.parse(args)
        await gitManager.deleteWorktree(validatedArgs.branchName, validatedArgs.force)
        return {
          content: [
            {
              type: 'text',
              text: `✅ 影分身 '${validatedArgs.branchName}' を削除しました`,
            },
          ],
        }
      }

      case 'exec_in_shadow_clone': {
        const validatedArgs = ExecInWorktreeArgsSchema.parse(args)
        const { execa } = await import('execa')

        const worktrees = await gitManager.listWorktrees()
        const targetWorktree = worktrees.find(wt => {
          const branch = wt.branch?.replace('refs/heads/', '')
          return branch === validatedArgs.branchName || wt.branch === validatedArgs.branchName
        })

        if (!targetWorktree) {
          throw new Error(`影分身 '${validatedArgs.branchName}' が見つかりません`)
        }

        const result = await execa('sh', ['-c', validatedArgs.command], {
          cwd: targetWorktree.path,
        })

        return {
          content: [
            {
              type: 'text',
              text: `📍 ${validatedArgs.branchName} で実行: ${validatedArgs.command}\n\n${result.stdout}`,
            },
          ],
        }
      }

      default:
        throw new Error(`不明なツール: ${name}`)
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        },
      ],
    }
  }
})

// サーバーの起動
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('🥷 shadow-clone-jutsu MCP server started')
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// テスト環境では早期リターンしてprocess.exitを避ける
const isTestEnvironment = process.env.NODE_ENV === 'test'
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
    name: 'maestro',
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
    name: 'create_orchestra_member',
    description: '新しい演奏者（Git worktree）を招集する',
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
    name: 'list_orchestra_members',
    description: 'すべての演奏者（Git worktree）を一覧表示',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'delete_orchestra_member',
    description: '演奏者（Git worktree）を解散',
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
    name: 'exec_in_orchestra_member',
    description: '演奏者でコマンドを実行',
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
if (!isTestEnvironment) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    }
  })
}

// ツール実行のハンドラー
if (!isTestEnvironment) {
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'create_orchestra_member': {
          const validatedArgs = CreateWorktreeArgsSchema.parse(args)
          const worktreePath = await gitManager.createWorktree(
            validatedArgs.branchName,
            validatedArgs.baseBranch
          )
          return {
            content: [
              {
                type: 'text',
                text: `✅ 演奏者 '${validatedArgs.branchName}' を招集しました！\n📁 ${worktreePath}`,
              },
            ],
          }
        }

        case 'list_orchestra_members': {
          const worktrees = await gitManager.listWorktrees()
          const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

          const list = orchestraMembers
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
                  orchestraMembers.length > 0
                    ? `🎼 オーケストラ編成:\n${list}\n\n合計: ${orchestraMembers.length} 名の演奏者`
                    : '演奏者が存在しません',
              },
            ],
          }
        }

        case 'delete_orchestra_member': {
          const validatedArgs = DeleteWorktreeArgsSchema.parse(args)
          await gitManager.deleteWorktree(validatedArgs.branchName, validatedArgs.force)
          return {
            content: [
              {
                type: 'text',
                text: `✅ 演奏者 '${validatedArgs.branchName}' を解散しました`,
              },
            ],
          }
        }

        case 'exec_in_orchestra_member': {
          const validatedArgs = ExecInWorktreeArgsSchema.parse(args)
          const { execa } = await import('execa')

          const worktrees = await gitManager.listWorktrees()
          const targetWorktree = worktrees.find(wt => {
            const branch = wt.branch?.replace('refs/heads/', '')
            return branch === validatedArgs.branchName || wt.branch === validatedArgs.branchName
          })

          if (!targetWorktree) {
            throw new Error(`演奏者 '${validatedArgs.branchName}' が見つかりません`)
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
}

// サーバーの起動
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('🎼 Maestro MCP server started')
}

if (!isTestEnvironment) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

// テスト用にserverをエクスポート
export { server }

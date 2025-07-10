import { Command } from 'commander'
import chalk from 'chalk'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const mcpCommand = new Command('mcp')
  .description('MCPサーバーを起動')
  .argument('[subcommand]', 'サブコマンド (serve)')
  .action(async (subcommand?: string) => {
    if (subcommand !== 'serve') {
      console.log(chalk.yellow('使い方: scj mcp serve'))
      console.log(
        chalk.gray('\nMCPサーバーを起動して、Claude CodeやCursorから影分身を操作できるようにします')
      )
      process.exit(0)
    }

    console.log(chalk.green('🥷 shadow-clone-jutsu MCPサーバーを起動中...'))
    console.log(chalk.gray('\nClaude CodeやCursorの設定に以下を追加してください:'))
    console.log(
      chalk.cyan(`
{
  "mcpServers": {
    "shadow-clone-jutsu": {
      "command": "scj",
      "args": ["mcp", "serve"]
    }
  }
}
`)
    )

    // MCPサーバーを起動
    const serverPath = path.join(__dirname, '..', '..', 'dist', 'mcp', 'server.js')
    const serverProcess = spawn('node', [serverPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
      },
    })

    serverProcess.on('error', (error) => {
      console.error(chalk.red('MCPサーバーの起動に失敗しました:'), error.message)
      process.exit(1)
    })

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(chalk.red(`MCPサーバーが異常終了しました (exit code: ${code})`))
        process.exit(code || 1)
      }
    })

    // プロセス終了時のクリーンアップ
    process.on('SIGINT', () => {
      serverProcess.kill('SIGINT')
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      serverProcess.kill('SIGTERM')
      process.exit(0)
    })
  })

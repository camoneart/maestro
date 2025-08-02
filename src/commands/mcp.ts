import { Command } from 'commander'
import chalk from 'chalk'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { processManager } from '../utils/process.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const mcpCommand = new Command('mcp')
  .description('MCPサーバーを起動')
  .argument('[subcommand]', 'サブコマンド (serve)')
  .exitOverride()
  .action(async (subcommand?: string) => {
    if (subcommand !== 'serve') {
      console.log(chalk.yellow('使い方: maestro mcp serve'))
      console.log(
        chalk.gray('\nMCPサーバーを起動して、Claude CodeやCursorから演奏者を操作できるようにします')
      )
      process.exit(0)
    }

    console.log(chalk.green('🎼 orchestra-conductor MCPサーバーを起動中...'))
    console.log(chalk.gray('\nClaude CodeやCursorの設定に以下を追加してください:'))
    console.log(
      chalk.cyan(`
{
  "mcpServers": {
    "maestro": {
      "command": "maestro",
      "args": ["mcp", "serve"]
    }
  }
}
`)
    )

    // MCPサーバーを起動
    const serverPath = path.join(__dirname, 'mcp', 'server.js')
    const serverProcess = spawn('node', [serverPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
      },
    })

    serverProcess.on('error', error => {
      console.error(chalk.red('MCPサーバーの起動に失敗しました:'), error.message)
      process.exit(1)
    })

    serverProcess.on('exit', code => {
      if (code !== 0) {
        console.error(chalk.red(`MCPサーバーが異常終了しました (exit code: ${code})`))
        process.exit(code || 1)
      }
    })

    // MCPサーバープロセスのクリーンアップを登録
    processManager.addCleanupHandler(() => {
      if (serverProcess && !serverProcess.killed && typeof serverProcess.kill === 'function') {
        serverProcess.kill('SIGTERM')
      }
    })
  })

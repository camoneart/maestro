#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'))
import { createCommand } from './commands/create.js'
import { listCommand } from './commands/list.js'
import { deleteCommand } from './commands/delete.js'
import { shellCommand } from './commands/shell.js'
import { execCommand } from './commands/exec.js'
import { attachCommand } from './commands/attach.js'
import { mcpCommand } from './commands/mcp.js'
import { configCommand } from './commands/config.js'
import { githubCommand } from './commands/github.js'
import { completionCommand } from './commands/completion.js'
import { tmuxCommand } from './commands/tmux.js'
import { whereCommand } from './commands/where.js'
import { syncCommand } from './commands/sync.js'
import { reviewCommand } from './commands/review.js'
import { issueCommand } from './commands/issue.js'
import { batchCommand } from './commands/batch.js'
import { historyCommand } from './commands/history.js'
import { suggestCommand } from './commands/suggest.js'
import { graphCommand } from './commands/graph.js'
import { templateCommand } from './commands/template.js'
import { watchCommand } from './commands/watch.js'
import { healthCommand } from './commands/health.js'
import { dashboardCommand } from './commands/dashboard.js'
import { snapshotCommand } from './commands/snapshot.js'

const program = new Command()

program
  .name('maestro')
  .description('🎼 Maestro - Git Worktreeオーケストレーションで Claude Codeとパラレル開発')
  .version(packageJson.version)

// サブコマンドを追加
program.addCommand(createCommand)
program.addCommand(listCommand)
program.addCommand(deleteCommand)
program.addCommand(shellCommand)
program.addCommand(execCommand)
program.addCommand(attachCommand)
program.addCommand(mcpCommand)
program.addCommand(configCommand)
program.addCommand(githubCommand)
program.addCommand(completionCommand)
program.addCommand(tmuxCommand)
program.addCommand(whereCommand)
program.addCommand(syncCommand)
program.addCommand(reviewCommand)
program.addCommand(issueCommand)
program.addCommand(batchCommand)
program.addCommand(historyCommand)
program.addCommand(suggestCommand)
program.addCommand(graphCommand)
program.addCommand(templateCommand)
program.addCommand(watchCommand)
program.addCommand(healthCommand)
program.addCommand(dashboardCommand)
program.addCommand(snapshotCommand)

// エラーハンドリング
program.exitOverride()

interface CommanderError extends Error {
  code?: string
  exitCode?: number
}

try {
  await program.parseAsync(process.argv)
} catch (error) {
  if (error instanceof Error) {
    // Commander の --version や --help はCommanderErrorをthrowするが、これは正常な終了
    if (error.name === 'CommanderError') {
      const commanderError = error as CommanderError
      if (
        commanderError.code === 'commander.version' ||
        commanderError.code === 'commander.helpDisplayed'
      ) {
        process.exit(0)
      }
    }
    console.error(chalk.red('エラー:'), error.message)
  }
  process.exit(1)
}

export { program }

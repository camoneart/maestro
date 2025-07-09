#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { createCommand } from './commands/create.js'
import { listCommand } from './commands/list.js'
import { deleteCommand } from './commands/delete.js'
import { shellCommand } from './commands/shell.js'
import { execCommand } from './commands/exec.js'
import { attachCommand } from './commands/attach.js'
import { mcpCommand } from './commands/mcp.js'
import { configCommand } from './commands/config.js'

const program = new Command()

program
  .name('scj')
  .description('🥷 shadow-clone-jutsu - 影分身の術でClaude Codeとパラレル開発')
  .version('0.1.0')

// サブコマンドを追加
program.addCommand(createCommand)
program.addCommand(listCommand)
program.addCommand(deleteCommand)
program.addCommand(shellCommand)
program.addCommand(execCommand)
program.addCommand(attachCommand)
program.addCommand(mcpCommand)
program.addCommand(configCommand)

// エラーハンドリング
program.exitOverride()

try {
  await program.parseAsync(process.argv)
} catch (error) {
  if (error instanceof Error) {
    console.error(chalk.red('エラー:'), error.message)
  }
  process.exit(1)
}
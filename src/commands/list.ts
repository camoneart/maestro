import { Command } from 'commander'
import chalk from 'chalk'
import { GitWorktreeManager } from '../core/git.js'
import { Worktree } from '../types/index.js'

export const listCommand = new Command('list')
  .alias('ls')
  .description('影分身（worktree）の一覧を表示')
  .option('-j, --json', 'JSON形式で出力')
  .action(async (options: { json?: boolean }) => {
    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
        process.exit(1)
      }

      const worktrees = await gitManager.listWorktrees()

      if (options.json) {
        console.log(JSON.stringify(worktrees, null, 2))
        return
      }

      if (worktrees.length === 0) {
        console.log(chalk.yellow('影分身が存在しません'))
        return
      }

      console.log(chalk.bold('\n🥷 影分身一覧:\n'))

      // メインワークツリーを先頭に表示
      const mainWorktree = worktrees.find(wt => wt.path.endsWith('.'))
      const cloneWorktrees = worktrees.filter(wt => !wt.path.endsWith('.'))

      if (mainWorktree) {
        displayWorktree(mainWorktree, true)
      }

      cloneWorktrees.forEach(wt => displayWorktree(wt, false))

      console.log(chalk.gray(`\n合計: ${worktrees.length} 個の影分身`))

    } catch (error) {
      console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
      process.exit(1)
    }
  })

function displayWorktree(worktree: Worktree, isMain: boolean) {
  const prefix = isMain ? '📍' : '🥷'
  const branchName = worktree.branch || '(detached)'
  const status = []

  if (worktree.locked) {
    status.push(chalk.red('🔒 ロック中'))
    if (worktree.reason) {
      status.push(chalk.gray(`(${worktree.reason})`))
    }
  }

  if (worktree.prunable) {
    status.push(chalk.yellow('⚠️  削除可能'))
  }

  console.log(
    `${prefix} ${chalk.cyan(branchName.padEnd(30))} ` +
    `${chalk.gray(worktree.path)} ` +
    `${status.join(' ')}`
  )
}
import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { DeleteOptions } from '../types/index.js'

export const deleteCommand = new Command('delete')
  .alias('rm')
  .description('影分身（worktree）を削除')
  .argument('<branch-name>', '削除するブランチ名')
  .option('-f, --force', '強制削除')
  .option('-r, --remove-remote', 'リモートブランチも削除')
  .action(async (branchName: string, options: DeleteOptions) => {
    const spinner = ora('影分身を確認中...').start()

    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      // ワークツリーの存在確認
      const worktrees = await gitManager.listWorktrees()
      const targetWorktree = worktrees.find(wt => wt.branch === branchName)

      if (!targetWorktree) {
        spinner.fail(`影分身 '${branchName}' が見つかりません`)
        
        // 類似した名前を提案
        const similarBranches = worktrees
          .filter(wt => wt.branch && wt.branch.includes(branchName))
          .map(wt => wt.branch)
        
        if (similarBranches.length > 0) {
          console.log(chalk.yellow('\n類似した影分身:'))
          similarBranches.forEach(branch => {
            console.log(`  - ${chalk.cyan(branch)}`)
          })
        }
        
        process.exit(1)
      }

      spinner.stop()

      // 削除確認
      if (!options.force) {
        const { confirmDelete } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmDelete',
            message: chalk.yellow(
              `本当に影分身 '${chalk.cyan(branchName)}' を削除しますか？\n` +
              `  📁 ${chalk.gray(targetWorktree.path)}`
            ),
            default: false,
          },
        ])

        if (!confirmDelete) {
          console.log(chalk.gray('キャンセルされました'))
          return
        }
      }

      spinner.start('影分身を削除中...')

      // ワークツリーを削除
      await gitManager.deleteWorktree(branchName, options.force)

      spinner.succeed(`影分身 '${chalk.cyan(branchName)}' を削除しました`)

      // リモートブランチの削除
      if (options.removeRemote) {
        const remoteSpinner = ora('リモートブランチを削除中...').start()
        try {
          // TODO: リモートブランチの削除実装
          remoteSpinner.warn('リモートブランチの削除は未実装です')
        } catch (error) {
          remoteSpinner.fail('リモートブランチの削除に失敗しました')
        }
      }

      console.log(chalk.green('\n✨ 影分身の削除が完了しました！'))

    } catch (error) {
      spinner.fail('影分身の削除に失敗しました')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
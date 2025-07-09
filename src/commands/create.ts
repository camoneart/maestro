import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { CreateOptions } from '../types/index.js'
import { execa } from 'execa'
import path from 'path'

export const createCommand = new Command('create')
  .description('新しい影分身（worktree）を作り出す')
  .argument('<branch-name>', 'ブランチ名')
  .option('-b, --base <branch>', 'ベースブランチ (デフォルト: 現在のブランチ)')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .action(async (branchName: string, options: CreateOptions) => {
    const spinner = ora('影分身の術！').start()

    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      // ブランチ名の確認
      const { confirmCreate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmCreate',
          message: `ブランチ '${chalk.cyan(branchName)}' で影分身を作り出しますか？`,
          default: true,
        },
      ])

      if (!confirmCreate) {
        spinner.info('キャンセルされました')
        return
      }

      spinner.text = '影分身を作り出し中...'

      // ワークツリーを作成
      const worktreePath = await gitManager.createWorktree(branchName, options.base)
      
      spinner.succeed(
        `影分身 '${chalk.cyan(branchName)}' を作り出しました！\n` +
        `  📁 ${chalk.gray(worktreePath)}`
      )

      // 環境セットアップ
      if (options.setup) {
        const setupSpinner = ora('環境をセットアップ中...').start()
        
        // package.jsonが存在する場合はnpm install
        try {
          await execa('npm', ['install'], { cwd: worktreePath })
          setupSpinner.succeed('npm install 完了')
        } catch (error) {
          setupSpinner.warn('npm install をスキップ')
        }
      }

      // エディタで開く
      if (options.open) {
        const openSpinner = ora('エディタで開いています...').start()
        try {
          // まずCursorを試す
          await execa('cursor', [worktreePath])
          openSpinner.succeed('Cursorで開きました')
        } catch {
          // 次にVSCodeを試す
          try {
            await execa('code', [worktreePath])
            openSpinner.succeed('VSCodeで開きました')
          } catch {
            openSpinner.warn('エディタが見つかりません')
          }
        }
      }

      console.log(chalk.green('\n✨ 影分身を作り出しました！'))
      console.log(chalk.gray(`\ncd ${worktreePath} で移動できます`))

    } catch (error) {
      spinner.fail('影分身を作り出せませんでした')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { CreateOptions } from '../types/index.js'
import { ConfigManager } from '../core/config.js'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'

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
      const configManager = new ConfigManager()
      await configManager.loadProjectConfig()
      
      const config = configManager.getAll()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      // ブランチ名にプレフィックスを追加
      if (config.worktrees?.branchPrefix && !branchName.startsWith(config.worktrees.branchPrefix)) {
        branchName = config.worktrees.branchPrefix + branchName
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

      // 環境セットアップ（設定またはオプションで有効な場合）
      if (options.setup || (options.setup === undefined && config.development?.autoSetup)) {
        const setupSpinner = ora('環境をセットアップ中...').start()
        
        // package.jsonが存在する場合はnpm install
        try {
          await execa('npm', ['install'], { cwd: worktreePath })
          setupSpinner.succeed('npm install 完了')
        } catch (error) {
          setupSpinner.warn('npm install をスキップ')
        }

        // 同期ファイルのコピー
        if (config.development?.syncFiles) {
          for (const file of config.development.syncFiles) {
            try {
              const sourcePath = path.join(process.cwd(), file)
              const destPath = path.join(worktreePath, file)
              await fs.copyFile(sourcePath, destPath)
              setupSpinner.succeed(`${file} をコピーしました`)
            } catch {
              // ファイルが存在しない場合はスキップ
            }
          }
        }
      }

      // エディタで開く（設定またはオプションで有効な場合）
      if (options.open || (options.open === undefined && config.development?.defaultEditor !== 'none')) {
        const openSpinner = ora('エディタで開いています...').start()
        const editor = config.development?.defaultEditor || 'cursor'
        
        try {
          if (editor === 'cursor') {
            await execa('cursor', [worktreePath])
            openSpinner.succeed('Cursorで開きました')
          } else if (editor === 'vscode') {
            await execa('code', [worktreePath])
            openSpinner.succeed('VSCodeで開きました')
          }
        } catch {
          openSpinner.warn(`${editor}が見つかりません`)
        }
      }

      // フック実行（afterCreate）
      if (config.hooks?.afterCreate) {
        const hookSpinner = ora('フックを実行中...').start()
        try {
          await execa('sh', ['-c', config.hooks.afterCreate], {
            cwd: worktreePath,
            env: {
              ...process.env,
              SHADOW_CLONE: branchName,
              SHADOW_CLONE_PATH: worktreePath,
            },
          })
          hookSpinner.succeed('フックを実行しました')
        } catch (error) {
          hookSpinner.warn('フックの実行に失敗しました')
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
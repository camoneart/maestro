import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'

export const attachCommand = new Command('attach')
  .alias('a')
  .description('既存のブランチから影分身を作り出す')
  .argument('[branch-name]', 'ブランチ名（省略時は選択）')
  .option('-r, --remote', 'リモートブランチも含める')
  .option('-f, --fetch', '最初にfetchを実行')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .action(async (branchName?: string, options?: { remote?: boolean; fetch?: boolean; open?: boolean; setup?: boolean }) => {
    const spinner = ora('影分身の術！').start()

    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      // fetchオプションが指定されている場合
      if (options.fetch) {
        spinner.text = 'リモートから最新情報を取得中...'
        await gitManager.fetchAll()
      }

      spinner.text = 'ブランチ一覧を取得中...'
      const branches = await gitManager.getAllBranches()
      
      // 既存のワークツリーを取得
      const worktrees = await gitManager.listWorktrees()
      const attachedBranches = worktrees.map(wt => wt.branch?.replace('refs/heads/', '')).filter(Boolean)

      // 利用可能なブランチをフィルタリング
      let availableBranches = branches.local.filter(b => !attachedBranches.includes(b))
      
      if (options.remote) {
        const remoteAvailable = branches.remote.filter(b => !attachedBranches.includes(b.split('/').slice(1).join('/')))
        availableBranches = [...availableBranches, ...remoteAvailable]
      }

      if (availableBranches.length === 0) {
        spinner.fail('利用可能なブランチがありません')
        console.log(chalk.yellow('すべてのブランチは既に影分身として存在します'))
        process.exit(0)
      }

      spinner.stop()

      // ブランチ名が指定されていない場合は選択
      if (!branchName) {
        const { selectedBranch } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedBranch',
            message: 'どのブランチから影分身を作り出しますか？',
            choices: availableBranches.map(branch => ({
              name: branch.includes('origin/') ? 
                `${chalk.yellow('[remote]')} ${chalk.cyan(branch)}` : 
                `${chalk.green('[local]')} ${chalk.cyan(branch)}`,
              value: branch,
            })),
            pageSize: 15,
          },
        ])
        branchName = selectedBranch
      } else {
        // 指定されたブランチが存在するか確認
        if (!availableBranches.includes(branchName)) {
          console.error(chalk.red(`エラー: ブランチ '${branchName}' が見つかりません`))
          
          // 類似した名前を提案
          const similarBranches = availableBranches.filter(b => b.includes(branchName))
          if (similarBranches.length > 0) {
            console.log(chalk.yellow('\n利用可能なブランチ:'))
            similarBranches.forEach(branch => {
              console.log(`  - ${chalk.cyan(branch)}`)
            })
          }
          
          process.exit(1)
        }
      }

      spinner.start(`影分身を作り出し中...`)

      // ワークツリーを作成
      const worktreePath = await gitManager.attachWorktree(branchName)
      
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

      console.log(chalk.green('\n✨ 影分身の作成が完了しました！'))
      console.log(chalk.gray(`\ncd ${worktreePath} で移動できます`))

    } catch (error) {
      spinner.fail('影分身を作り出せませんでした')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
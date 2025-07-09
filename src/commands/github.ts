import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { ConfigManager } from '../core/config.js'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'

export const githubCommand = new Command('github')
  .alias('gh')
  .description('GitHub PR/Issueから影分身を作り出す')
  .argument('[type]', 'タイプ (checkout, pr, issue)')
  .argument('[number]', 'PR/Issue番号')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .action(async (type?: string, number?: string, options?: { open?: boolean; setup?: boolean }) => {
    const spinner = ora('影分身の術！').start()

    try {
      // gh CLIがインストールされているか確認
      try {
        await execa('gh', ['--version'])
      } catch {
        spinner.fail('GitHub CLI (gh) がインストールされていません')
        console.log(chalk.yellow('\nインストール方法:'))
        console.log('  brew install gh')
        console.log('  または https://cli.github.com/')
        process.exit(1)
      }

      // 認証状態を確認
      try {
        await execa('gh', ['auth', 'status'])
      } catch {
        spinner.fail('GitHub CLIが認証されていません')
        console.log(chalk.yellow('\n認証方法:'))
        console.log('  gh auth login')
        process.exit(1)
      }

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

      // typeとnumberの処理
      if (!type || type === 'checkout') {
        // checkout または引数なしの場合
        if (!number && type === 'checkout') {
          console.error(chalk.red('PR/Issue番号を指定してください'))
          console.log(chalk.gray('使い方: scj github checkout <number>'))
          process.exit(1)
        }
        
        // typeが番号の場合（scj github 123）
        if (type && !isNaN(parseInt(type))) {
          number = type
          type = 'checkout'
        }
      }

      if (!number) {
        spinner.stop()
        
        // インタラクティブモード
        const { selectType } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectType',
            message: '何から影分身を作り出しますか？',
            choices: [
              { name: 'Pull Request', value: 'pr' },
              { name: 'Issue', value: 'issue' },
            ],
          },
        ])
        type = selectType

        // PR/Issue一覧を取得
        spinner.start(`${type === 'pr' ? 'Pull Request' : 'Issue'}一覧を取得中...`)
        
        let items: any[] = []
        try {
          if (type === 'pr') {
            const result = await execa('gh', ['pr', 'list', '--json', 'number,title,author,draft', '--limit', '20'])
            items = JSON.parse(result.stdout)
          } else {
            const result = await execa('gh', ['issue', 'list', '--json', 'number,title,author', '--limit', '20'])
            items = JSON.parse(result.stdout)
          }
        } catch (error) {
          spinner.fail('一覧の取得に失敗しました')
          console.error(error)
          process.exit(1)
        }

        spinner.stop()

        if (items.length === 0) {
          console.log(chalk.yellow(`開いている${type === 'pr' ? 'Pull Request' : 'Issue'}がありません`))
          process.exit(0)
        }

        const { selectedNumber } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedNumber',
            message: `${type === 'pr' ? 'Pull Request' : 'Issue'}を選択:`,
            choices: items.map(item => ({
              name: `#${item.number} ${item.title} ${chalk.gray(`by ${item.author.login}`)}${item.draft ? chalk.yellow(' [draft]') : ''}`,
              value: item.number.toString(),
            })),
            pageSize: 15,
          },
        ])
        number = selectedNumber
      }

      spinner.start('情報を取得中...')

      // PR/Issueの情報を取得
      let branchName: string
      let title: string
      
      try {
        if (type === 'pr' || type === 'checkout') {
          // まずPRとして試す
          try {
            const prInfo = await execa('gh', ['pr', 'view', number, '--json', 'number,title,headRefName'])
            const pr = JSON.parse(prInfo.stdout)
            branchName = pr.headRefName
            title = pr.title
            type = 'pr'
          } catch {
            // PRでなければIssueとして試す
            const issueInfo = await execa('gh', ['issue', 'view', number, '--json', 'number,title'])
            const issue = JSON.parse(issueInfo.stdout)
            branchName = `issue-${number}`
            title = issue.title
            type = 'issue'
          }
        } else if (type === 'issue') {
          const issueInfo = await execa('gh', ['issue', 'view', number, '--json', 'number,title'])
          const issue = JSON.parse(issueInfo.stdout)
          branchName = `issue-${number}`
          title = issue.title
        } else {
          throw new Error(`不明なタイプ: ${type}`)
        }
      } catch (error) {
        spinner.fail(`${type} #${number} の情報取得に失敗しました`)
        console.error(error)
        process.exit(1)
      }

      spinner.succeed(`${type === 'pr' ? 'PR' : 'Issue'} #${number}: ${title}`)

      // ブランチ名にプレフィックスを追加
      if (config.worktrees?.branchPrefix && !branchName.startsWith(config.worktrees.branchPrefix)) {
        branchName = config.worktrees.branchPrefix + branchName
      }

      // 確認
      const { confirmCreate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmCreate',
          message: `ブランチ '${chalk.cyan(branchName)}' で影分身を作り出しますか？`,
          default: true,
        },
      ])

      if (!confirmCreate) {
        console.log(chalk.gray('キャンセルされました'))
        return
      }

      spinner.start('影分身を作り出し中...')

      let worktreePath: string

      if (type === 'pr') {
        // PRの場合はgh pr checkoutを使用
        const tempBranch = `pr-${number}-checkout`
        
        // 一時的にcheckout
        await execa('gh', ['pr', 'checkout', number, '-b', tempBranch])
        
        // worktreeを作成
        worktreePath = await gitManager.attachWorktree(branchName)
        
        // 元のブランチに戻る
        await execa('git', ['checkout', '-'])
        
        // 一時ブランチを削除
        await execa('git', ['branch', '-D', tempBranch])
      } else {
        // Issueの場合は新規ブランチを作成
        worktreePath = await gitManager.createWorktree(branchName)
      }

      spinner.succeed(
        `影分身 '${chalk.cyan(branchName)}' を作り出しました！\n` +
        `  📁 ${chalk.gray(worktreePath)}\n` +
        `  🔗 ${chalk.blue(`${type === 'pr' ? 'PR' : 'Issue'} #${number}`)}`
      )

      // 環境セットアップ
      if (options?.setup || (options?.setup === undefined && config.development?.autoSetup)) {
        const setupSpinner = ora('環境をセットアップ中...').start()
        
        try {
          await execa('npm', ['install'], { cwd: worktreePath })
          setupSpinner.succeed('npm install 完了')
        } catch {
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

      // エディタで開く
      if (options?.open || (options?.open === undefined && config.development?.defaultEditor !== 'none')) {
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

      console.log(chalk.green('\n✨ GitHub統合による影分身の作成が完了しました！'))
      console.log(chalk.gray(`\ncd ${worktreePath} で移動できます`))

    } catch (error) {
      spinner.fail('影分身を作り出せませんでした')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
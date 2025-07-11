import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { ConfigManager } from '../core/config.js'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'

// 型定義
interface GithubOptions {
  open?: boolean
  setup?: boolean
  message?: string
  reopen?: boolean
  close?: boolean
}

// エラークラス
class GithubCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GithubCommandError'
  }
}

// コメント追加処理
async function addComment(number: string, message: string, type: 'pr' | 'issue'): Promise<void> {
  const commentSpinner = ora('コメントを投稿中...').start()
  try {
    await execa('gh', [type, 'comment', number, '--body', message])
    commentSpinner.succeed(`${type === 'pr' ? 'PR' : 'Issue'} #${number} にコメントを投稿しました`)
  } catch (error) {
    commentSpinner.fail('コメントの投稿に失敗しました')
    throw new GithubCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

// Issue/PRの状態変更
async function changeState(
  number: string,
  action: 'close' | 'reopen',
  type: 'pr' | 'issue'
): Promise<void> {
  const stateSpinner = ora(`${action === 'close' ? 'クローズ' : '再開'}中...`).start()
  try {
    await execa('gh', [type, action, number])
    stateSpinner.succeed(
      `${type === 'pr' ? 'PR' : 'Issue'} #${number} を${action === 'close' ? 'クローズ' : '再開'}しました`
    )
  } catch (error) {
    stateSpinner.fail(`${action === 'close' ? 'クローズ' : '再開'}に失敗しました`)
    throw new GithubCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

// PR/Issueの自動判定
async function detectType(number: string): Promise<'pr' | 'issue'> {
  try {
    await execa('gh', ['pr', 'view', number])
    return 'pr'
  } catch {
    try {
      await execa('gh', ['issue', 'view', number])
      return 'issue'
    } catch {
      throw new GithubCommandError(`PR/Issue #${number} が見つかりません`)
    }
  }
}

// ブランチ名を生成
function generateBranchName(
  template: string,
  number: string,
  title: string,
  type: 'pr' | 'issue'
): string {
  // タイトルをブランチ名に適した形式に変換
  const sanitizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) // 長すぎるタイトルは切り詰める

  return template
    .replace('{number}', number)
    .replace('{title}', sanitizedTitle)
    .replace('{type}', type)
}

export const githubCommand = new Command('github')
  .alias('gh')
  .description('GitHub PR/Issueから影分身を作り出す')
  .argument('[type]', 'タイプ (checkout, pr, issue, comment)')
  .argument('[number]', 'PR/Issue番号')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .option('-m, --message <message>', 'コメントメッセージ')
  .option('--reopen', 'PR/Issueを再開')
  .option('--close', 'PR/Issueをクローズ')
  .action(async (type?: string, number?: string, options: GithubOptions = {}) => {
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

      // commentサブコマンドの処理
      if (type === 'comment') {
        if (!number) {
          throw new GithubCommandError('PR/Issue番号を指定してください')
        }

        spinner.text = 'PR/Issueを確認中...'
        const targetType = await detectType(number)
        spinner.stop()

        // コメント処理
        if (options.message) {
          await addComment(number, options.message, targetType)
        } else {
          // インタラクティブにコメントを入力
          const { comment } = await inquirer.prompt([
            {
              type: 'input',
              name: 'comment',
              message: 'コメント内容:',
              validate: input => input.trim().length > 0 || 'コメントを入力してください',
            },
          ])
          await addComment(number, comment, targetType)
        }

        // 状態変更オプション
        if (options.reopen) {
          await changeState(number, 'reopen', targetType)
        } else if (options.close) {
          await changeState(number, 'close', targetType)
        }

        return
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
              { name: 'コメントを追加', value: 'comment' },
            ],
          },
        ])
        type = selectType

        // コメントの場合は番号を入力
        if (type === 'comment') {
          const { inputNumber } = await inquirer.prompt([
            {
              type: 'input',
              name: 'inputNumber',
              message: 'PR/Issue番号:',
              validate: input => {
                const num = parseInt(input)
                return (!isNaN(num) && num > 0) || '有効な番号を入力してください'
              },
            },
          ])
          number = inputNumber

          spinner.start('PR/Issueを確認中...')
          if (!number) {
            throw new GithubCommandError('PR/Issue番号が指定されていません')
          }
          const targetType = await detectType(number)
          spinner.stop()

          const { comment } = await inquirer.prompt([
            {
              type: 'input',
              name: 'comment',
              message: 'コメント内容:',
              validate: input => input.trim().length > 0 || 'コメントを入力してください',
            },
          ])

          await addComment(number, comment, targetType)
          return
        }

        // PR/Issue一覧を取得
        spinner.start(`${type === 'pr' ? 'Pull Request' : 'Issue'}一覧を取得中...`)

        let items: Array<{
          number: number
          title: string
          author: { login: string }
          draft?: boolean
        }> = []
        try {
          if (type === 'pr') {
            const result = await execa('gh', [
              'pr',
              'list',
              '--json',
              'number,title,author,draft',
              '--limit',
              '20',
            ])
            items = JSON.parse(result.stdout)
          } else {
            const result = await execa('gh', [
              'issue',
              'list',
              '--json',
              'number,title,author',
              '--limit',
              '20',
            ])
            items = JSON.parse(result.stdout)
          }
        } catch (error) {
          spinner.fail('一覧の取得に失敗しました')
          console.error(error)
          process.exit(1)
        }

        spinner.stop()

        if (items.length === 0) {
          console.log(
            chalk.yellow(`開いている${type === 'pr' ? 'Pull Request' : 'Issue'}がありません`)
          )
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
            const prInfo = await execa('gh', [
              'pr',
              'view',
              number || '',
              '--json',
              'number,title,headRefName',
            ])
            const pr = JSON.parse(prInfo.stdout)
            title = pr.title
            type = 'pr'

            // ブランチ命名規則を適用
            const prTemplate = config.github?.branchNaming?.prTemplate || 'pr-{number}'
            branchName = generateBranchName(prTemplate, number || '', title, 'pr')
          } catch {
            // PRでなければIssueとして試す
            const issueInfo = await execa('gh', [
              'issue',
              'view',
              number || '',
              '--json',
              'number,title',
            ])
            const issue = JSON.parse(issueInfo.stdout)
            title = issue.title
            type = 'issue'

            // ブランチ命名規則を適用
            const issueTemplate = config.github?.branchNaming?.issueTemplate || 'issue-{number}'
            branchName = generateBranchName(issueTemplate, number || '', title, 'issue')
          }
        } else if (type === 'issue') {
          const issueInfo = await execa('gh', [
            'issue',
            'view',
            number || '',
            '--json',
            'number,title',
          ])
          const issue = JSON.parse(issueInfo.stdout)
          title = issue.title

          // ブランチ命名規則を適用
          const issueTemplate = config.github?.branchNaming?.issueTemplate || 'issue-{number}'
          branchName = generateBranchName(issueTemplate, number || '', title, 'issue')
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
        await execa('gh', ['pr', 'checkout', number || '', '-b', tempBranch])

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
      if (
        options?.open ||
        (options?.open === undefined && config.development?.defaultEditor !== 'none')
      ) {
        const openSpinner = ora('エディタで開いています...').start()
        const editor = config.development?.defaultEditor || 'cursor'

        try {
          if (editor === 'cursor') {
            await execa('cursor', [worktreePath])
            openSpinner.succeed('Cursorで開きました')
          } else if (editor === 'vscode') {
            await execa('code', [worktreePath])
            openSpinner.succeed('VSCodeで開きました')
          } else if (editor) {
            // カスタムエディタコマンドのサポート
            await execa(editor, [worktreePath])
            openSpinner.succeed(`${editor}で開きました`)
          }
        } catch {
          openSpinner.warn(`${editor}が見つかりません`)
        }
      }

      console.log(chalk.green('\n✨ GitHub統合による影分身の作成が完了しました！'))
      console.log(chalk.gray(`\ncd ${worktreePath} で移動できます`))
    } catch (error) {
      spinner.fail('エラーが発生しました')
      if (error instanceof GithubCommandError) {
        console.error(chalk.red(error.message))
        process.exitCode = 1
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
        process.exitCode = 1
      }
    }
  })

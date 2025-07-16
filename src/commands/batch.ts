import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { ConfigManager, Config } from '../core/config.js'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'
import pLimit from 'p-limit'

interface BatchCreateOptions {
  base?: string
  open?: boolean
  setup?: boolean
  tmux?: boolean
  claude?: boolean
  fromFile?: string
  interactive?: boolean
  concurrency?: number
}

interface BatchWorktree {
  name: string
  description?: string
  issueNumber?: string
  prNumber?: string
}

// GitHub Issue型定義
interface GithubLabel {
  name: string
}

interface GithubIssue {
  number: number
  title: string
  labels: GithubLabel[]
  assignees: Array<{ login: string }>
}

// ファイルから一括作成リストを読み込む
async function loadBatchFile(filePath: string): Promise<BatchWorktree[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'))

    return lines.map(line => {
      // フォーマット: "branch-name | description | #123"
      const parts = line.split('|').map(p => p.trim())
      const name = parts[0]
      const description = parts[1]
      const issueOrPr = parts[2]

      const result: BatchWorktree = { name: name || '' }
      if (description) result.description = description

      if (issueOrPr) {
        if (issueOrPr.startsWith('#')) {
          result.issueNumber = issueOrPr.slice(1)
        } else if (issueOrPr.startsWith('pr-')) {
          result.prNumber = issueOrPr.slice(3)
        }
      }

      return result
    })
  } catch (error) {
    throw new Error(`バッチファイルの読み込みに失敗しました: ${error}`)
  }
}

// GitHub Issuesから複数選択
async function selectIssues(): Promise<BatchWorktree[]> {
  const spinner = ora('GitHub Issueを取得中...').start()

  try {
    const { stdout: issuesJson } = await execa('gh', [
      'issue',
      'list',
      '--json',
      'number,title,labels,assignees',
      '--limit',
      '30',
    ])

    const issues = JSON.parse(issuesJson)
    spinner.stop()

    if (issues.length === 0) {
      console.log(chalk.yellow('オープンなIssueが見つかりません'))
      return []
    }

    const { selectedIssues } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedIssues',
        message: '作業するIssueを選択（スペースで選択、Enterで確定）:',
        choices: issues.map((issue: GithubIssue) => ({
          name: `#${issue.number} ${issue.title} ${
            issue.labels.length > 0
              ? chalk.gray(`[${issue.labels.map((l: GithubLabel) => l.name).join(', ')}]`)
              : ''
          }`,
          value: {
            name: `issue-${issue.number}`,
            description: issue.title,
            issueNumber: issue.number.toString(),
          },
        })),
        pageSize: 15,
      },
    ])

    return selectedIssues
  } catch (error) {
    spinner.fail('GitHub Issueの取得に失敗しました')
    throw error
  }
}

// インタラクティブに入力
async function inputBatchWorktrees(): Promise<BatchWorktree[]> {
  const worktrees: BatchWorktree[] = []
  let addMore = true

  while (addMore) {
    const { branchName, description, continueAdding } = await inquirer.prompt([
      {
        type: 'input',
        name: 'branchName',
        message: 'ブランチ名:',
        validate: input => input.trim().length > 0 || 'ブランチ名を入力してください',
      },
      {
        type: 'input',
        name: 'description',
        message: '説明（オプション）:',
      },
      {
        type: 'confirm',
        name: 'continueAdding',
        message: 'さらに追加しますか？',
        default: true,
      },
    ])

    worktrees.push({
      name: branchName,
      description: description || undefined,
    })

    addMore = continueAdding
  }

  return worktrees
}

// 並列でworktreeを作成
async function createWorktreesInParallel(
  worktrees: BatchWorktree[],
  gitManager: GitWorktreeManager,
  config: Config,
  options: BatchCreateOptions
): Promise<void> {
  const results: Array<{
    worktree: BatchWorktree
    status: 'success' | 'failed'
    path?: string
    error?: string
  }> = []

  console.log(chalk.bold(`\n🥷 ${worktrees.length}つの影分身を並列で作り出します...\n`))

  // 並列実行制限を設定
  const concurrency = options.concurrency || 5
  const limit = pLimit(concurrency)

  // 並列実行
  const promises = worktrees.map(worktree =>
    limit(async () => {
      const spinner = ora(`${worktree.name} を作成中...`).start()

      try {
        // ブランチ名にプレフィックスを追加
        let branchName = worktree.name
        if (
          config.worktrees?.branchPrefix &&
          !branchName.startsWith(config.worktrees.branchPrefix)
        ) {
          branchName = config.worktrees.branchPrefix + branchName
        }

        // ワークツリーを作成
        const worktreePath = await gitManager.createWorktree(branchName, options.base)

        // 環境セットアップ（必要な場合）
        if (options.setup || (options.setup === undefined && config.development?.autoSetup)) {
          try {
            await execa('npm', ['install'], { cwd: worktreePath })
          } catch {
            // npm installが失敗してもworktree作成は成功とする
          }

          // 同期ファイルのコピー
          if (config.development?.syncFiles) {
            for (const file of config.development.syncFiles) {
              try {
                const sourcePath = path.join(process.cwd(), file)
                const destPath = path.join(worktreePath, file)
                await fs.copyFile(sourcePath, destPath)
              } catch {
                // ファイルコピーエラーは無視
              }
            }
          }
        }

        spinner.succeed(`${worktree.name} を作成しました`)

        results.push({
          worktree,
          status: 'success',
          path: worktreePath,
        })
      } catch (error) {
        spinner.fail(`${worktree.name} の作成に失敗しました`)
        results.push({
          worktree,
          status: 'failed',
          error: error instanceof Error ? error.message : '不明なエラー',
        })
      }
    })
  )

  await Promise.all(promises)

  // 結果サマリー
  console.log(chalk.bold('\n📊 作成結果:\n'))

  const successCount = results.filter(r => r.status === 'success').length
  const failedCount = results.filter(r => r.status === 'failed').length

  if (successCount > 0) {
    console.log(chalk.green(`✅ 成功: ${successCount}個`))
    results
      .filter(r => r.status === 'success')
      .forEach(r => {
        console.log(chalk.gray(`   - ${r.worktree.name}: ${r.path}`))
      })
  }

  if (failedCount > 0) {
    console.log(chalk.red(`\n❌ 失敗: ${failedCount}個`))
    results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(chalk.gray(`   - ${r.worktree.name}: ${r.error}`))
      })
  }

  // エディタで開く（成功したもののみ）
  if (options.open && successCount > 0) {
    const { openAll } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openAll',
        message: `${successCount}個のworktreeをエディタで開きますか？`,
        default: false,
      },
    ])

    if (openAll) {
      const editor = config.development?.defaultEditor || 'cursor'
      const successfulPaths = results
        .filter(r => r.status === 'success' && r.path)
        .map(r => r.path!)

      for (const worktreePath of successfulPaths) {
        try {
          if (editor === 'cursor') {
            await execa('cursor', [worktreePath])
          } else if (editor === 'vscode') {
            await execa('code', [worktreePath])
          }
        } catch {
          console.warn(chalk.yellow(`${editor}で${worktreePath}を開けませんでした`))
        }
      }
    }
  }
}

export const batchCommand = new Command('batch')
  .alias('b')
  .description('複数の影分身を一括で作り出す')
  .option('-b, --base <branch>', 'ベースブランチ (デフォルト: 現在のブランチ)')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .option('-f, --from-file <path>', 'バッチファイルから読み込む')
  .option('-i, --interactive', 'インタラクティブモードで入力')
  .option('--from-issues', 'GitHub Issuesから選択')
  .option('-c, --concurrency <number>', '並列実行数 (デフォルト: 5)', parseInt)
  .action(async (options: BatchCreateOptions) => {
    const spinner = ora('準備中...').start()

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

      spinner.stop()

      let worktrees: BatchWorktree[] = []

      // 入力方法を選択
      if (options.fromFile) {
        worktrees = await loadBatchFile(options.fromFile)
      } else if (options.interactive) {
        worktrees = await inputBatchWorktrees()
      } else {
        // デフォルトはIssueから選択
        const { inputMethod } = await inquirer.prompt([
          {
            type: 'list',
            name: 'inputMethod',
            message: 'どのように影分身を作成しますか？',
            choices: [
              { name: '🐙 GitHub Issuesから選択', value: 'issues' },
              { name: '✍️  手動で入力', value: 'manual' },
              { name: '📄 ファイルから読み込む', value: 'file' },
            ],
          },
        ])

        switch (inputMethod) {
          case 'issues': {
            worktrees = await selectIssues()
            break
          }
          case 'manual': {
            worktrees = await inputBatchWorktrees()
            break
          }
          case 'file': {
            const { filePath } = await inquirer.prompt([
              {
                type: 'input',
                name: 'filePath',
                message: 'バッチファイルのパス:',
                default: 'worktrees.txt',
              },
            ])
            worktrees = await loadBatchFile(filePath)
            break
          }
        }
      }

      if (worktrees.length === 0) {
        console.log(chalk.yellow('作成するworktreeがありません'))
        return
      }

      // 確認
      console.log(chalk.bold('\n以下のworktreeを作成します:\n'))
      worktrees.forEach((wt, i) => {
        console.log(
          `${i + 1}. ${chalk.cyan(wt.name)} ${
            wt.description ? chalk.gray(`- ${wt.description}`) : ''
          }`
        )
      })

      const { confirmCreate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmCreate',
          message: `${worktrees.length}対の影分身を作成しますか？`,
          default: true,
        },
      ])

      if (!confirmCreate) {
        console.log(chalk.gray('キャンセルされました'))
        return
      }

      // 並列作成実行
      await createWorktreesInParallel(worktrees, gitManager, config, options)
    } catch (error) {
      spinner.fail('エラーが発生しました')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })

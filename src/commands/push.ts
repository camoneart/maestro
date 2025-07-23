import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'

interface PushOptions {
  pr?: boolean
  draftPr?: boolean
  base?: string
  title?: string
  body?: string
  noEdit?: boolean
  force?: boolean
  all?: boolean
  issue?: number
}

class PushCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PushCommandError'
  }
}

async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout } = await execa('git', ['branch', '--show-current'])
    return stdout.trim()
  } catch {
    throw new PushCommandError('現在のブランチを取得できませんでした')
  }
}

async function hasRemoteOrigin(): Promise<boolean> {
  try {
    await execa('git', ['remote', 'get-url', 'origin'])
    return true
  } catch {
    return false
  }
}

async function pushToRemote(branchName: string, force: boolean = false): Promise<void> {
  const pushSpinner = ora('リモートにプッシュ中...').start()

  try {
    const args = ['push']

    if (force) {
      args.push('--force-with-lease')
    }

    // リモートブランチが存在しない場合は -u を追加
    try {
      await execa('git', ['rev-parse', `origin/${branchName}`])
    } catch {
      args.push('-u', 'origin', branchName)
    }

    await execa('git', args)
    pushSpinner.succeed(chalk.green(`✨ ブランチ '${branchName}' をリモートにプッシュしました`))
  } catch (error) {
    pushSpinner.fail(chalk.red('プッシュに失敗しました'))
    throw new PushCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function createPullRequest(branchName: string, options: PushOptions): Promise<void> {
  const prSpinner = ora('Pull Requestを作成中...').start()

  try {
    const args = ['pr', 'create']

    if (options.draftPr) {
      args.push('--draft')
    }

    if (options.base) {
      args.push('--base', options.base)
    }

    if (options.title) {
      args.push('--title', options.title)
    } else {
      // デフォルトタイトル
      const defaultTitle = options.draftPr ? `WIP: ${branchName}` : branchName
      args.push('--title', defaultTitle)
    }

    if (options.body) {
      args.push('--body', options.body)
    } else if (options.draftPr) {
      args.push('--body', 'Work in progress')
    }

    if (options.noEdit) {
      args.push('--fill')
    }

    await execa('gh', args)

    const prType = options.draftPr ? 'Draft PR' : 'PR'
    prSpinner.succeed(chalk.green(`✨ ${prType}を作成しました`))
  } catch (error) {
    const prType = options.draftPr ? 'Draft PR' : 'PR'
    prSpinner.fail(chalk.red(`${prType}の作成に失敗しました`))
    throw new PushCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function pushWorktree(branchName: string, options: PushOptions): Promise<void> {
  // リモートの存在確認
  if (!(await hasRemoteOrigin())) {
    throw new PushCommandError('リモートリポジトリ (origin) が設定されていません')
  }

  // GitHub CLIの確認（PR作成時のみ）
  if (options.pr || options.draftPr) {
    try {
      await execa('gh', ['auth', 'status'])
    } catch {
      throw new PushCommandError(
        'GitHub CLIが認証されていません。`gh auth login` を実行してください'
      )
    }
  }

  // プッシュ実行
  await pushToRemote(branchName, options.force)

  // PR作成
  if (options.pr || options.draftPr) {
    await createPullRequest(branchName, options)
  }
}

async function pushAllWorktrees(options: PushOptions): Promise<void> {
  const gitManager = new GitWorktreeManager()
  const worktrees = await gitManager.listWorktrees()

  // メインworktreeを除外
  const orchestraMembers = worktrees.filter(wt => wt.path !== process.cwd())

  if (orchestraMembers.length === 0) {
    console.log(chalk.yellow('プッシュ対象の演奏者（worktree）が見つかりません'))
    return
  }

  console.log(chalk.cyan(`\n📋 ${orchestraMembers.length}個の演奏者を処理します:`))

  for (const worktree of orchestraMembers) {
    const branchName = worktree.branch
    if (!branchName) continue

    console.log(chalk.blue(`\n🎼 演奏者 '${branchName}' を処理中...`))

    try {
      // worktreeディレクトリに移動して処理
      const originalCwd = process.cwd()
      process.chdir(worktree.path)

      await pushWorktree(branchName, options)

      // 元のディレクトリに戻る
      process.chdir(originalCwd)
    } catch (error) {
      console.error(
        chalk.red(
          `✖ 演奏者 '${branchName}' の処理に失敗: ${error instanceof Error ? error.message : '不明なエラー'}`
        )
      )
    }
  }
}

export const pushCommand = new Command('push')
  .description('現在のブランチをリモートにプッシュし、オプションでPRを作成')
  .option('--pr', '通常のPull Requestを作成')
  .option('--draft-pr', 'Draft Pull Requestを作成')
  .option('--base <branch>', 'ベースブランチを指定 (デフォルト: main)')
  .option('--title <title>', 'PRタイトルを指定')
  .option('--body <body>', 'PR本文を指定')
  .option('--no-edit', 'エディタを開かずにPRを作成')
  .option('--force', 'force pushを実行（--force-with-lease）')
  .option('--all', 'すべての演奏者（worktree）をプッシュ')
  .option('--issue <number>', '関連Issue番号を指定', parseInt)
  .action(async (options: PushOptions) => {
    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリの確認
      if (!(await gitManager.isGitRepository())) {
        throw new PushCommandError('このディレクトリはGitリポジトリではありません')
      }

      // 全worktree処理
      if (options.all) {
        await pushAllWorktrees(options)
        return
      }

      // 現在のブランチを取得
      const currentBranch = await getCurrentBranch()

      if (!currentBranch) {
        throw new PushCommandError('ブランチが detached HEAD 状態です')
      }

      // メインブランチの場合は警告
      const mainBranches = ['main', 'master', 'develop', 'development']
      if (mainBranches.includes(currentBranch)) {
        const { confirmPush } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmPush',
            message: `メインブランチ '${currentBranch}' をプッシュしますか？`,
            default: false,
          },
        ])

        if (!confirmPush) {
          console.log(chalk.yellow('キャンセルされました'))
          return
        }
      }

      // プッシュ実行
      await pushWorktree(currentBranch, options)
    } catch (error) {
      if (error instanceof PushCommandError) {
        console.error(chalk.red(`✖ ${error.message}`))
        process.exitCode = 1
      } else {
        console.error(
          chalk.red(
            `✖ 予期しないエラー: ${error instanceof Error ? error.message : '不明なエラー'}`
          )
        )
        process.exitCode = 1
      }
    }
  })

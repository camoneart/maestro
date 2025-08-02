import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { ConfigManager } from '../core/config.js'
import { execa } from 'execa'
import { formatPath } from '../utils/path.js'

// 型定義
interface ReviewOptions {
  checkout?: boolean
  diff?: boolean
  web?: boolean
  approve?: boolean
  requestChanges?: boolean
  comment?: string
  assign?: string
  autoFlow?: boolean
}

interface GithubUser {
  login: string
}

interface PullRequest {
  number: number
  title: string
  author: GithubUser
  body?: string
  headRefName: string
  baseRefName: string
  state: string
  url: string
  isDraft?: boolean
  reviewers?: GithubUser[]
  assignees?: GithubUser[]
}

// エラークラス
class ReviewCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReviewCommandError'
  }
}

// ハンドラ関数
async function checkoutPR(pr: PullRequest, gitManager: GitWorktreeManager): Promise<void> {
  const checkoutSpinner = ora('PRを演奏者として招集中...').start()

  try {
    // 既存のワークツリーを確認
    const worktrees = await gitManager.listWorktrees()
    const prBranchName = `pr/${pr.number}`
    const existingWorktree = worktrees.find(wt => wt.branch?.includes(prBranchName))

    if (existingWorktree) {
      checkoutSpinner.warn(`演奏者 '${prBranchName}' は既に存在します`)
      const configManager = new ConfigManager()
      await configManager.loadProjectConfig()
      const config = configManager.getAll()
      console.log(chalk.gray(`📁 ${formatPath(existingWorktree.path, config)}`))
    } else {
      // gh pr checkoutを使用してPRをフェッチ
      await execa('gh', ['pr', 'checkout', pr.number.toString(), '--recurse-submodules'])

      // 現在のブランチ名を取得
      const { stdout: currentBranch } = await execa('git', ['branch', '--show-current'])

      // ワークツリーを作成
      const worktreePath = await gitManager.createWorktree(currentBranch)

      checkoutSpinner.succeed(`PR #${pr.number} を演奏者 '${currentBranch}' として招集しました`)
      const configManager = new ConfigManager()
      await configManager.loadProjectConfig()
      const config = configManager.getAll()
      console.log(chalk.gray(`📁 ${formatPath(worktreePath, config)}`))
      console.log(chalk.green(`\ncd ${formatPath(worktreePath, config)} で移動できます`))
    }
  } catch (error) {
    checkoutSpinner.fail('PRのチェックアウトに失敗しました')
    throw new ReviewCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function showDiff(prNumber: string): Promise<void> {
  console.log(chalk.bold('\n📝 PRの差分:\n'))
  await execa('gh', ['pr', 'diff', prNumber], { stdio: 'inherit' })
}

async function openInBrowser(prNumber: string): Promise<void> {
  console.log(chalk.cyan(`\n🌐 ブラウザでPR #${prNumber} を開いています...`))
  await execa('gh', ['pr', 'view', prNumber, '--web'])
}

async function addComment(prNumber: string, comment: string): Promise<void> {
  const commentSpinner = ora('コメントを投稿中...').start()
  try {
    await execa('gh', ['pr', 'comment', prNumber, '--body', comment])
    commentSpinner.succeed('コメントを投稿しました')
  } catch (error) {
    commentSpinner.fail('コメントの投稿に失敗しました')
    throw new ReviewCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function approvePR(prNumber: string): Promise<void> {
  const approveSpinner = ora('PRを承認中...').start()
  try {
    await execa('gh', ['pr', 'review', prNumber, '--approve'])
    approveSpinner.succeed(`PR #${prNumber} を承認しました`)
  } catch (error) {
    approveSpinner.fail('PRの承認に失敗しました')
    throw new ReviewCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function requestChanges(prNumber: string, comment?: string): Promise<void> {
  const requestSpinner = ora('変更を要求中...').start()
  try {
    const args = ['pr', 'review', prNumber, '--request-changes']
    if (comment) {
      args.push('--body', comment)
    }
    await execa('gh', args)
    requestSpinner.succeed(`PR #${prNumber} に変更を要求しました`)
  } catch (error) {
    requestSpinner.fail('変更要求に失敗しました')
    throw new ReviewCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function addReviewer(prNumber: string, reviewer: string): Promise<void> {
  const reviewerSpinner = ora(`${reviewer} をレビュアーに追加中...`).start()
  try {
    await execa('gh', ['pr', 'edit', prNumber, '--add-reviewer', reviewer])
    reviewerSpinner.succeed(`PR #${prNumber} に ${reviewer} をレビュアーとして追加しました`)
  } catch (error) {
    reviewerSpinner.fail('レビュアーの追加に失敗しました')
    throw new ReviewCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function refreshStatus(prNumber: string): Promise<PullRequest> {
  const statusSpinner = ora('PR情報を再取得中...').start()
  try {
    const { stdout: prJson } = await execa('gh', [
      'pr',
      'view',
      prNumber,
      '--json',
      'number,title,author,body,headRefName,baseRefName,state,url,reviewers,assignees',
    ])

    const pr = JSON.parse(prJson) as PullRequest
    statusSpinner.succeed('PR情報を更新しました')

    // 更新された情報を表示
    console.log(chalk.bold(`\n📋 PR #${pr.number}: ${pr.title}\n`))
    console.log(chalk.gray(`Author: ${pr.author.login}`))
    console.log(chalk.gray(`Branch: ${pr.headRefName} → ${pr.baseRefName}`))
    console.log(chalk.gray(`State: ${pr.state}`))

    if (pr.reviewers && pr.reviewers.length > 0) {
      console.log(chalk.gray(`Reviewers: ${pr.reviewers.map(r => r.login).join(', ')}`))
    }

    if (pr.assignees && pr.assignees.length > 0) {
      console.log(chalk.gray(`Assignees: ${pr.assignees.map(a => a.login).join(', ')}`))
    }

    return pr
  } catch (error) {
    statusSpinner.fail('PR情報の取得に失敗しました')
    throw new ReviewCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

// 自動レビュー&マージフロー
async function autoReviewFlow(_branchName: string, baseBranch: string = 'main'): Promise<void> {
  const autoSpinner = ora('自動レビュー&マージフローを開始中...').start()

  try {
    // 1. fetch origin main && rebase origin/main
    autoSpinner.text = 'ベースブランチをフェッチ中...'
    await execa('git', ['fetch', 'origin', baseBranch])

    autoSpinner.text = 'リベース中...'
    try {
      await execa('git', ['rebase', `origin/${baseBranch}`])
      autoSpinner.succeed('リベースが完了しました')
    } catch {
      autoSpinner.warn('競合が発生しました')

      // 2. 競合が出たらclaude /resolve-conflictを起動
      console.log(chalk.yellow('\n🔧 競合を解決するためにClaude Codeを起動します...'))
      console.log(chalk.gray('Claude Codeで以下のコマンドを実行してください:'))
      console.log(chalk.cyan('  /resolve-conflict'))

      try {
        await execa('claude', [], { stdio: 'inherit' })
      } catch {
        console.log(chalk.red('Claude Codeの起動に失敗しました'))
        throw new ReviewCommandError('競合解決のためにClaude Codeを手動で起動してください')
      }

      return
    }

    // 3. claude /review --diff origin/main でコードレビュー
    console.log(chalk.blue('\n📝 Claude Codeでコードレビューを実行します...'))
    console.log(chalk.gray('Claude Codeで以下のコマンドを実行してください:'))
    console.log(chalk.cyan(`  /review --diff origin/${baseBranch}`))

    try {
      await execa('claude', [], { stdio: 'inherit' })
    } catch {
      console.log(chalk.yellow('Claude Codeの起動に失敗しました'))
    }

    // 4. claude "Generate Conventional Commit message" でコミット作成
    const { useConventionalCommit } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useConventionalCommit',
        message: 'Conventional Commitメッセージを自動生成しますか？',
        default: true,
      },
    ])

    if (useConventionalCommit) {
      console.log(chalk.blue('\n💬 Conventional Commitメッセージを生成中...'))
      console.log(chalk.gray('Claude Codeで以下のコマンドを実行してください:'))
      console.log(chalk.cyan('  "Generate Conventional Commit message for current changes"'))

      try {
        await execa('claude', [], { stdio: 'inherit' })
      } catch {
        console.log(chalk.yellow('Claude Codeの起動に失敗しました'))
      }
    }

    // 5. GitHub PR を API 経由で作成
    const { createPR } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createPR',
        message: 'GitHub PRを作成しますか？',
        default: true,
      },
    ])

    if (createPR) {
      const prSpinner = ora('GitHub PRを作成中...').start()
      try {
        await execa('gh', ['pr', 'create', '--fill'])
        prSpinner.succeed('GitHub PRを作成しました')
      } catch (error) {
        prSpinner.fail('GitHub PRの作成に失敗しました')
        console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      }
    }
  } catch (error) {
    autoSpinner.fail('自動レビューフローでエラーが発生しました')
    throw new ReviewCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

export const reviewCommand = new Command('review')
  .alias('r')
  .description('PRレビューをサポート')
  .argument('[pr-number]', 'PR番号')
  .option('-c, --checkout', 'PRを演奏者として招集してチェックアウト')
  .option('-d, --diff', 'PRの差分を表示')
  .option('-w, --web', 'ブラウザでPRを開く')
  .option('-a, --approve', 'PRを承認')
  .option('--request-changes', '変更を要求')
  .option('--comment <comment>', 'コメントを追加')
  .option('--assign <user>', 'レビュアーを追加')
  .option('--auto-flow', '自動レビュー&マージフローを実行')
  .exitOverride()
  .action(async (prNumber?: string, options: ReviewOptions = {}) => {
    const spinner = ora('PR情報を取得中...').start()

    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        throw new ReviewCommandError('このディレクトリはGitリポジトリではありません')
      }

      // GitHubリポジトリか確認
      try {
        await execa('gh', ['repo', 'view'])
      } catch {
        spinner.fail('GitHubリポジトリではありません')
        console.log(chalk.yellow('gh CLIがインストールされていないか、認証されていません'))
        throw new ReviewCommandError('GitHubリポジトリへのアクセスに失敗しました')
      }

      // PR番号が指定されていない場合は一覧から選択
      if (!prNumber) {
        spinner.text = 'PR一覧を取得中...'

        const { stdout: prListJson } = await execa('gh', [
          'pr',
          'list',
          '--json',
          'number,title,author,isDraft,state',
          '--limit',
          '30',
        ])

        const prs = JSON.parse(prListJson) as PullRequest[]

        if (prs.length === 0) {
          throw new ReviewCommandError('オープンなPRが見つかりません')
        }

        spinner.stop()

        const { selectedPR } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedPR',
            message: 'レビューするPRを選択:',
            choices: prs.map(pr => ({
              name: `#${pr.number} ${pr.title} ${chalk.gray(`by ${pr.author.login}`)}${
                pr.isDraft ? chalk.yellow(' [draft]') : ''
              }`,
              value: pr.number.toString(),
            })),
            pageSize: 15,
          },
        ])

        prNumber = selectedPR
      }

      if (!prNumber) {
        throw new ReviewCommandError('PR番号が指定されていません')
      }

      spinner.text = `PR #${prNumber} の情報を取得中...`

      // PR情報を取得
      const { stdout: prJson } = await execa('gh', [
        'pr',
        'view',
        prNumber,
        '--json',
        'number,title,author,body,headRefName,baseRefName,state,url',
      ])

      const pr = JSON.parse(prJson) as PullRequest

      spinner.succeed(`PR #${pr.number}: ${pr.title}`)
      console.log(chalk.gray(`Author: ${pr.author.login}`))
      console.log(chalk.gray(`Branch: ${pr.headRefName} → ${pr.baseRefName}`))
      console.log(chalk.gray(`URL: ${pr.url}`))

      // 自動レビューフローの処理
      if (options.autoFlow) {
        await autoReviewFlow(pr.headRefName, pr.baseRefName)
        return
      }

      // コマンドラインオプションの処理
      if (options.checkout) {
        await checkoutPR(pr, gitManager)
        return
      }

      if (options.diff) {
        await showDiff(prNumber)
        return
      }

      if (options.web) {
        await openInBrowser(prNumber)
        return
      }

      if (options.comment) {
        await addComment(prNumber, options.comment)
        return
      }

      if (options.approve) {
        await approvePR(prNumber)
        return
      }

      if (options.requestChanges) {
        await requestChanges(prNumber)
        return
      }

      if (options.assign) {
        await addReviewer(prNumber, options.assign)
        return
      }

      // インタラクティブメニュー
      console.log()
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '何をしますか？',
          choices: [
            { name: '🎼 PRを演奏者として招集する', value: 'checkout' },
            { name: '📝 差分を表示', value: 'diff' },
            { name: '🌐 ブラウザで開く', value: 'web' },
            { name: '💬 コメントを追加', value: 'comment' },
            { name: '✅ PRを承認', value: 'approve' },
            { name: '🛠️  変更を要求', value: 'request-changes' },
            { name: '👥 レビュアーを追加', value: 'add-reviewer' },
            { name: '🚀 自動レビュー&マージフロー', value: 'auto-flow' },
            { name: '🔄 ステータスを再取得', value: 'refresh' },
            { name: '❌ キャンセル', value: 'cancel' },
          ],
        },
      ])

      switch (action) {
        case 'checkout':
          await checkoutPR(pr, gitManager)
          break
        case 'diff':
          await showDiff(prNumber)
          break
        case 'web':
          await openInBrowser(prNumber)
          break
        case 'comment': {
          const { comment } = await inquirer.prompt([
            {
              type: 'input',
              name: 'comment',
              message: 'コメント内容:',
              validate: input => input.trim().length > 0 || 'コメントを入力してください',
            },
          ])
          await addComment(prNumber, comment)
          break
        }
        case 'approve':
          await approvePR(prNumber)
          break
        case 'request-changes': {
          const { includeComment } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'includeComment',
              message: 'コメントを含めますか？',
              default: true,
            },
          ])

          let comment
          if (includeComment) {
            const response = await inquirer.prompt([
              {
                type: 'input',
                name: 'comment',
                message: '変更要求の理由:',
                validate: input => input.trim().length > 0 || '理由を入力してください',
              },
            ])
            comment = response.comment
          }

          await requestChanges(prNumber, comment)
          break
        }
        case 'add-reviewer': {
          const { reviewer } = await inquirer.prompt([
            {
              type: 'input',
              name: 'reviewer',
              message: 'レビュアーのユーザー名:',
              validate: input => input.trim().length > 0 || 'ユーザー名を入力してください',
            },
          ])
          await addReviewer(prNumber, reviewer)
          break
        }
        case 'auto-flow':
          await autoReviewFlow(pr.headRefName, pr.baseRefName)
          break
        case 'refresh':
          await refreshStatus(prNumber)
          break
        case 'cancel':
          console.log(chalk.gray('キャンセルされました'))
          break
      }
    } catch (error) {
      spinner.fail('エラーが発生しました')
      if (error instanceof ReviewCommandError) {
        console.error(chalk.red(error.message))
        process.exitCode = 1
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
        process.exitCode = 1
      }
    }
  })

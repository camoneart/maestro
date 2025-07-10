import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'

// 型定義
interface ReviewOptions {
  checkout?: boolean
  diff?: boolean
  web?: boolean
  approve?: boolean
  requestChanges?: boolean
  comment?: string
  assign?: string
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
  draft?: boolean
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
  const checkoutSpinner = ora('PRを影分身として作り出し中...').start()

  try {
    // 既存のワークツリーを確認
    const worktrees = await gitManager.listWorktrees()
    const prBranchName = `pr/${pr.number}`
    const existingWorktree = worktrees.find(wt => wt.branch?.includes(prBranchName))

    if (existingWorktree) {
      checkoutSpinner.warn(`影分身 '${prBranchName}' は既に存在します`)
      console.log(chalk.gray(`📁 ${existingWorktree.path}`))
    } else {
      // gh pr checkoutを使用してPRをフェッチ
      await execa('gh', ['pr', 'checkout', pr.number.toString(), '--recurse-submodules'])

      // 現在のブランチ名を取得
      const { stdout: currentBranch } = await execa('git', ['branch', '--show-current'])

      // ワークツリーを作成
      const worktreePath = await gitManager.createWorktree(currentBranch)

      checkoutSpinner.succeed(`PR #${pr.number} を影分身 '${currentBranch}' として作り出しました`)
      console.log(chalk.gray(`📁 ${worktreePath}`))
      console.log(chalk.green(`\ncd ${worktreePath} で移動できます`))
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

export const reviewCommand = new Command('review')
  .alias('r')
  .description('PRレビューをサポート')
  .argument('[pr-number]', 'PR番号')
  .option('-c, --checkout', 'PRを影分身として作り出してチェックアウト')
  .option('-d, --diff', 'PRの差分を表示')
  .option('-w, --web', 'ブラウザでPRを開く')
  .option('-a, --approve', 'PRを承認')
  .option('--request-changes', '変更を要求')
  .option('--comment <comment>', 'コメントを追加')
  .option('--assign <user>', 'レビュアーを追加')
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
          'number,title,author,draft,state',
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
                pr.draft ? chalk.yellow(' [draft]') : ''
              }`,
              value: pr.number.toString(),
            })),
            pageSize: 15,
          },
        ])

        prNumber = selectedPR
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
            { name: '🥷 PRを影分身として作り出す', value: 'checkout' },
            { name: '📝 差分を表示', value: 'diff' },
            { name: '🌐 ブラウザで開く', value: 'web' },
            { name: '💬 コメントを追加', value: 'comment' },
            { name: '✅ PRを承認', value: 'approve' },
            { name: '🛠️  変更を要求', value: 'request-changes' },
            { name: '👥 レビュアーを追加', value: 'add-reviewer' },
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

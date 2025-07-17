import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'

// 型定義
interface IssueOptions {
  list?: boolean
  create?: boolean
  close?: boolean
  web?: boolean
  assign?: string
  label?: string
  milestone?: string
}

interface GithubLabel {
  name: string
  color: string
}

interface GithubUser {
  login: string
}

interface GithubIssue {
  number: number
  title: string
  author: GithubUser
  body?: string
  state: string
  url: string
  labels: GithubLabel[]
  assignees: GithubUser[]
}

// エラークラス
class IssueCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IssueCommandError'
  }
}

// ハンドラ関数
async function closeIssue(issueNumber: string): Promise<void> {
  const closeSpinner = ora('Issueをクローズ中...').start()
  try {
    await execa('gh', ['issue', 'close', issueNumber])
    closeSpinner.succeed(`Issue #${issueNumber} をクローズしました`)
  } catch (error) {
    closeSpinner.fail('Issueのクローズに失敗しました')
    throw new IssueCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function openInBrowser(issueNumber: string): Promise<void> {
  console.log(chalk.cyan(`\n🌐 ブラウザでIssue #${issueNumber} を開いています...`))
  await execa('gh', ['issue', 'view', issueNumber, '--web'])
}

async function assignUser(issueNumber: string, assignee: string): Promise<void> {
  const assignSpinner = ora(`${assignee} にアサイン中...`).start()
  try {
    await execa('gh', ['issue', 'edit', issueNumber, '--add-assignee', assignee])
    assignSpinner.succeed(`Issue #${issueNumber} を ${assignee} にアサインしました`)
  } catch (error) {
    assignSpinner.fail('アサインに失敗しました')
    throw new IssueCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function addLabels(issueNumber: string, labels: string): Promise<void> {
  const labelList = labels
    .split(',')
    .map(l => l.trim())
    .filter(Boolean)
  const labelSpinner = ora(`ラベル '${labelList.join(', ')}' を追加中...`).start()

  try {
    const args = ['issue', 'edit', issueNumber]
    labelList.forEach(label => {
      args.push('--add-label', label)
    })

    await execa('gh', args)
    labelSpinner.succeed(`Issue #${issueNumber} にラベル '${labelList.join(', ')}' を追加しました`)
  } catch (error) {
    labelSpinner.fail('ラベルの追加に失敗しました')
    throw new IssueCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

async function setMilestone(issueNumber: string, milestone: string): Promise<void> {
  const milestoneSpinner = ora(`マイルストーン '${milestone}' を設定中...`).start()
  try {
    await execa('gh', ['issue', 'edit', issueNumber, '--milestone', milestone])
    milestoneSpinner.succeed(`Issue #${issueNumber} にマイルストーン '${milestone}' を設定しました`)
  } catch (error) {
    milestoneSpinner.fail('マイルストーンの設定に失敗しました')
    throw new IssueCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

export const issueCommand = new Command('issue')
  .alias('i')
  .description('GitHub Issueを管理')
  .argument('[issue-number]', 'Issue番号')
  .option('-l, --list', 'Issue一覧を表示')
  .option('-c, --create', '新しいIssueを作成')
  .option('--close', 'Issueをクローズ')
  .option('-w, --web', 'ブラウザでIssueを開く')
  .option('-a, --assign <user>', 'Issueをアサイン')
  .option('--label <label>', 'ラベルを追加（カンマ区切りで複数指定可）')
  .option('--milestone <milestone>', 'マイルストーンを設定')
  .action(async (issueNumber?: string, options: IssueOptions = {}) => {
    const spinner = ora('Issue情報を取得中...').start()

    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        throw new IssueCommandError('このディレクトリはGitリポジトリではありません')
      }

      // GitHubリポジトリか確認
      try {
        await execa('gh', ['repo', 'view'])
      } catch {
        spinner.fail('GitHubリポジトリではありません')
        console.log(chalk.yellow('gh CLIがインストールされていないか、認証されていません'))
        throw new IssueCommandError('GitHubリポジトリへのアクセスに失敗しました')
      }

      // Issue一覧を表示
      if (options.list) {
        spinner.text = 'Issue一覧を取得中...'

        const { stdout: issueListJson } = await execa('gh', [
          'issue',
          'list',
          '--json',
          'number,title,author,state,labels,assignees',
          '--limit',
          '30',
        ])

        const issues = JSON.parse(issueListJson) as GithubIssue[]
        spinner.stop()

        if (issues.length === 0) {
          console.log(chalk.yellow('オープンなIssueが見つかりません'))
          return
        }

        console.log(chalk.bold('\n📋 Issue一覧:\n'))

        issues.forEach(issue => {
          const labels = issue.labels.map(l => chalk.hex('#' + l.color)(`[${l.name}]`)).join(' ')
          const assignees =
            issue.assignees.length > 0
              ? chalk.gray(` → ${issue.assignees.map(a => a.login).join(', ')}`)
              : ''

          console.log(
            `#${chalk.cyan(issue.number.toString().padEnd(5))} ${issue.title} ${labels}${assignees}`
          )
          console.log(chalk.gray(`        by ${issue.author.login}\n`))
        })

        return
      }

      // 新しいIssueを作成
      if (options.create) {
        spinner.stop()

        const { title } = await inquirer.prompt([
          {
            type: 'input',
            name: 'title',
            message: 'Issueのタイトル:',
            validate: input => input.trim().length > 0 || 'タイトルを入力してください',
          },
        ])

        const { body } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'body',
            message: 'Issueの本文 (エディタが開きます):',
          },
        ])

        const createSpinner = ora('Issueを作成中...').start()

        try {
          const { stdout } = await execa('gh', [
            'issue',
            'create',
            '--title',
            title,
            '--body',
            body,
          ])

          const issueUrl = stdout.trim()
          createSpinner.succeed('Issueを作成しました')
          console.log(chalk.gray(`URL: ${issueUrl}`))

          // 作成したIssueから演奏者を招集するか確認
          const { createBranch } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'createBranch',
              message: 'このIssueから演奏者を招集しますか？',
              default: true,
            },
          ])

          if (createBranch) {
            const issueNumberMatch = issueUrl.match(/\/(\d+)$/)
            if (issueNumberMatch) {
              const newIssueNumber = issueNumberMatch[1]
              const branchName = `issue-${newIssueNumber}`

              const branchSpinner = ora('演奏者を招集中...').start()
              const worktreePath = await gitManager.createWorktree(branchName)
              branchSpinner.succeed(`演奏者 '${chalk.cyan(branchName)}' を招集しました`)
              console.log(chalk.gray(`📁 ${worktreePath}`))
            }
          }
        } catch (error) {
          createSpinner.fail('Issueの作成に失敗しました')
          throw new IssueCommandError(error instanceof Error ? error.message : '不明なエラー')
        }

        return
      }

      // Issue番号が必要な操作
      if (!issueNumber && !options.list && !options.create) {
        spinner.text = 'Issue一覧を取得中...'

        const { stdout: issueListJson } = await execa('gh', [
          'issue',
          'list',
          '--json',
          'number,title,author,state',
          '--limit',
          '30',
        ])

        const issues = JSON.parse(issueListJson) as GithubIssue[]

        if (issues.length === 0) {
          throw new IssueCommandError('オープンなIssueが見つかりません')
        }

        spinner.stop()

        const { selectedIssue } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedIssue',
            message: 'Issueを選択:',
            choices: issues.map(issue => ({
              name: `#${issue.number} ${issue.title} ${chalk.gray(`by ${issue.author.login}`)}`,
              value: issue.number.toString(),
            })),
            pageSize: 15,
          },
        ])

        issueNumber = selectedIssue
      }

      if (issueNumber) {
        spinner.text = `Issue #${issueNumber} の情報を取得中...`

        // Issue情報を取得
        const { stdout: issueJson } = await execa('gh', [
          'issue',
          'view',
          issueNumber,
          '--json',
          'number,title,author,body,state,url,labels,assignees',
        ])

        const issue = JSON.parse(issueJson) as GithubIssue
        spinner.stop()

        // コマンドラインオプションの処理
        if (options.close) {
          await closeIssue(issueNumber)
          return
        }

        if (options.web) {
          await openInBrowser(issueNumber)
          return
        }

        if (options.assign) {
          await assignUser(issueNumber, options.assign)
          return
        }

        if (options.label) {
          await addLabels(issueNumber, options.label)
          return
        }

        if (options.milestone) {
          await setMilestone(issueNumber, options.milestone)
          return
        }

        // Issue詳細を表示
        console.log(chalk.bold(`\n📋 Issue #${issue.number}: ${issue.title}\n`))
        console.log(chalk.gray(`Author: ${issue.author.login}`))
        console.log(chalk.gray(`State: ${issue.state}`))

        if (issue.labels.length > 0) {
          const labels = issue.labels.map(l => chalk.hex('#' + l.color)(`[${l.name}]`)).join(' ')
          console.log(chalk.gray(`Labels: ${labels}`))
        }

        if (issue.assignees.length > 0) {
          console.log(chalk.gray(`Assignees: ${issue.assignees.map(a => a.login).join(', ')}`))
        }

        console.log(chalk.gray(`URL: ${issue.url}`))

        if (issue.body) {
          console.log(chalk.gray('\n--- 本文 ---'))
          console.log(issue.body)
        }

        // インタラクティブメニュー
        console.log()
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: '何をしますか？',
            choices: [
              { name: '🎼 このIssueから演奏者を招集する', value: 'create-branch' },
              { name: '🌐 ブラウザで開く', value: 'web' },
              { name: '✅ Issueをクローズ', value: 'close' },
              { name: '👤 アサイン', value: 'assign' },
              { name: '🏷️  ラベルを追加', value: 'label' },
              { name: '🏁 マイルストーンを設定', value: 'milestone' },
              { name: '❌ キャンセル', value: 'cancel' },
            ],
          },
        ])

        switch (action) {
          case 'create-branch': {
            const branchName = `issue-${issueNumber}`
            const branchSpinner = ora('演奏者を招集中...').start()

            try {
              const worktreePath = await gitManager.createWorktree(branchName)
              branchSpinner.succeed(`演奏者 '${chalk.cyan(branchName)}' を招集しました`)
              console.log(chalk.gray(`📁 ${worktreePath}`))
            } catch (error) {
              branchSpinner.fail('演奏者の招集に失敗しました')
              throw new IssueCommandError(error instanceof Error ? error.message : '不明なエラー')
            }
            break
          }
          case 'web':
            await openInBrowser(issueNumber)
            break
          case 'close':
            await closeIssue(issueNumber)
            break
          case 'assign': {
            const { assignee } = await inquirer.prompt([
              {
                type: 'input',
                name: 'assignee',
                message: 'アサインするユーザー名:',
                validate: input => input.trim().length > 0 || 'ユーザー名を入力してください',
              },
            ])
            await assignUser(issueNumber, assignee)
            break
          }
          case 'label': {
            const { label } = await inquirer.prompt([
              {
                type: 'input',
                name: 'label',
                message: 'ラベル名（カンマ区切りで複数指定可）:',
                validate: input => input.trim().length > 0 || 'ラベル名を入力してください',
              },
            ])
            await addLabels(issueNumber, label)
            break
          }
          case 'milestone': {
            const { milestone } = await inquirer.prompt([
              {
                type: 'input',
                name: 'milestone',
                message: 'マイルストーン名:',
                validate: input => input.trim().length > 0 || 'マイルストーン名を入力してください',
              },
            ])
            await setMilestone(issueNumber, milestone)
            break
          }
          case 'cancel':
            console.log(chalk.gray('キャンセルされました'))
            break
        }
      }
    } catch (error) {
      spinner.fail('エラーが発生しました')
      if (error instanceof IssueCommandError) {
        console.error(chalk.red(error.message))
        process.exitCode = 1
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
        process.exitCode = 1
      }
    }
  })

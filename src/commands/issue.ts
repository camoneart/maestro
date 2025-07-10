import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'

interface IssueOptions {
  list?: boolean
  create?: boolean
  close?: boolean
  web?: boolean
  assign?: string
  label?: string
  milestone?: string
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
  .option('--label <label>', 'ラベルを追加')
  .option('--milestone <milestone>', 'マイルストーンを設定')
  .action(async (issueNumber?: string, options: IssueOptions = {}) => {
    const spinner = ora('Issue情報を取得中...').start()

    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      // GitHubリポジトリか確認
      try {
        await execa('gh', ['repo', 'view'])
      } catch {
        spinner.fail('GitHubリポジトリではありません')
        console.log(chalk.yellow('gh CLIがインストールされていないか、認証されていません'))
        process.exit(1)
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

        const issues = JSON.parse(issueListJson)
        spinner.stop()

        if (issues.length === 0) {
          console.log(chalk.yellow('オープンなIssueが見つかりません'))
          return
        }

        console.log(chalk.bold('\n📋 Issue一覧:\n'))

        issues.forEach(
          (issue: {
            number: number
            title: string
            author: { login: string }
            labels: Array<{ name: string; color: string }>
            assignees: Array<{ login: string }>
          }) => {
            const labels = issue.labels.map(l => chalk.hex(`#${l.color}`)(`[${l.name}]`)).join(' ')
            const assignees =
              issue.assignees.length > 0
                ? chalk.gray(` → ${issue.assignees.map(a => a.login).join(', ')}`)
                : ''

            console.log(
              `#${chalk.cyan(issue.number.toString().padEnd(5))} ${issue.title} ${labels}${assignees}`
            )
            console.log(chalk.gray(`        by ${issue.author.login}\n`))
          }
        )

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

          // 作成したIssueから影分身を作るか確認
          const { createBranch } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'createBranch',
              message: 'このIssueから影分身を作り出しますか？',
              default: true,
            },
          ])

          if (createBranch) {
            const issueNumberMatch = issueUrl.match(/\/(\d+)$/)
            if (issueNumberMatch) {
              const newIssueNumber = issueNumberMatch[1]
              const branchName = `issue-${newIssueNumber}`

              const branchSpinner = ora('影分身を作り出し中...').start()
              const worktreePath = await gitManager.createWorktree(branchName)
              branchSpinner.succeed(`影分身 '${chalk.cyan(branchName)}' を作り出しました`)
              console.log(chalk.gray(`📁 ${worktreePath}`))
            }
          }
        } catch (error) {
          createSpinner.fail('Issueの作成に失敗しました')
          console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
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

        const issues = JSON.parse(issueListJson)

        if (issues.length === 0) {
          spinner.fail('オープンなIssueが見つかりません')
          process.exit(0)
        }

        spinner.stop()

        const { selectedIssue } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedIssue',
            message: 'Issueを選択:',
            choices: issues.map(
              (issue: { number: number; title: string; author: { login: string } }) => ({
                name: `#${issue.number} ${issue.title} ${chalk.gray(`by ${issue.author.login}`)}`,
                value: issue.number.toString(),
              })
            ),
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

        const issue = JSON.parse(issueJson)
        spinner.stop()

        // Issueをクローズ
        if (options.close) {
          const closeSpinner = ora('Issueをクローズ中...').start()
          try {
            await execa('gh', ['issue', 'close', issueNumber])
            closeSpinner.succeed(`Issue #${issueNumber} をクローズしました`)
          } catch (error) {
            closeSpinner.fail('Issueのクローズに失敗しました')
            console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
          }
          return
        }

        // ブラウザで開く
        if (options.web) {
          console.log(chalk.cyan(`\n🌐 ブラウザでIssue #${issueNumber} を開いています...`))
          await execa('gh', ['issue', 'view', issueNumber, '--web'])
          return
        }

        // アサイン
        if (options.assign) {
          const assignSpinner = ora(`${options.assign} にアサイン中...`).start()
          try {
            await execa('gh', ['issue', 'edit', issueNumber, '--add-assignee', options.assign])
            assignSpinner.succeed(`Issue #${issueNumber} を ${options.assign} にアサインしました`)
          } catch (error) {
            assignSpinner.fail('アサインに失敗しました')
            console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
          }
          return
        }

        // ラベル追加
        if (options.label) {
          const labelSpinner = ora(`ラベル '${options.label}' を追加中...`).start()
          try {
            await execa('gh', ['issue', 'edit', issueNumber, '--add-label', options.label])
            labelSpinner.succeed(`Issue #${issueNumber} にラベル '${options.label}' を追加しました`)
          } catch (error) {
            labelSpinner.fail('ラベルの追加に失敗しました')
            console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
          }
          return
        }

        // Issue詳細を表示
        console.log(chalk.bold(`\n📋 Issue #${issue.number}: ${issue.title}\n`))
        console.log(chalk.gray(`Author: ${issue.author.login}`))
        console.log(chalk.gray(`State: ${issue.state}`))

        if (issue.labels.length > 0) {
          const labels = issue.labels
            .map((l: { name: string; color: string }) => chalk.hex(`#${l.color}`)(`[${l.name}]`))
            .join(' ')
          console.log(chalk.gray(`Labels: ${labels}`))
        }

        if (issue.assignees.length > 0) {
          console.log(
            chalk.gray(
              `Assignees: ${issue.assignees.map((a: { login: string }) => a.login).join(', ')}`
            )
          )
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
              { name: '🥷 このIssueから影分身を作り出す', value: 'create-branch' },
              { name: '🌐 ブラウザで開く', value: 'web' },
              { name: '✅ Issueをクローズ', value: 'close' },
              { name: '👤 アサイン', value: 'assign' },
              { name: '🏷️  ラベルを追加', value: 'label' },
              { name: '❌ キャンセル', value: 'cancel' },
            ],
          },
        ])

        switch (action) {
          case 'create-branch': {
            const branchName = `issue-${issueNumber}`
            const branchSpinner = ora('影分身を作り出し中...').start()

            try {
              const worktreePath = await gitManager.createWorktree(branchName)
              branchSpinner.succeed(`影分身 '${chalk.cyan(branchName)}' を作り出しました`)
              console.log(chalk.gray(`📁 ${worktreePath}`))
            } catch (error) {
              branchSpinner.fail('影分身の作成に失敗しました')
              console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
            }
            break
          }
          case 'web':
            await issueCommand.parseAsync([issueNumber, '--web'], { from: 'user' })
            break
          case 'close':
            await issueCommand.parseAsync([issueNumber, '--close'], { from: 'user' })
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
            await issueCommand.parseAsync([issueNumber, '--assign', assignee], { from: 'user' })
            break
          }
          case 'label': {
            const { label } = await inquirer.prompt([
              {
                type: 'input',
                name: 'label',
                message: 'ラベル名:',
                validate: input => input.trim().length > 0 || 'ラベル名を入力してください',
              },
            ])
            await issueCommand.parseAsync([issueNumber, '--label', label], { from: 'user' })
            break
          }
          case 'cancel':
            console.log(chalk.gray('キャンセルされました'))
            break
        }
      }
    } catch (error) {
      spinner.fail('エラーが発生しました')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })

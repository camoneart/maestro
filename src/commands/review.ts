import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'

interface ReviewOptions {
  checkout?: boolean
  diff?: boolean
  web?: boolean
  approve?: boolean
  comment?: string
}

export const reviewCommand = new Command('review')
  .alias('r')
  .description('PRレビューをサポート')
  .argument('[pr-number]', 'PR番号')
  .option('-c, --checkout', 'PRを影分身として作り出してチェックアウト')
  .option('-d, --diff', 'PRの差分を表示')
  .option('-w, --web', 'ブラウザでPRを開く')
  .option('-a, --approve', 'PRを承認')
  .option('--comment <comment>', 'コメントを追加')
  .action(async (prNumber?: string, options: ReviewOptions = {}) => {
    const spinner = ora('PR情報を取得中...').start()

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

        const prs = JSON.parse(prListJson)

        if (prs.length === 0) {
          spinner.fail('オープンなPRが見つかりません')
          process.exit(0)
        }

        spinner.stop()

        const { selectedPR } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedPR',
            message: 'レビューするPRを選択:',
            choices: prs.map(
              (pr: {
                number: number
                title: string
                author: { login: string }
                draft?: boolean
              }) => ({
                name: `#${pr.number} ${pr.title} ${chalk.gray(`by ${pr.author.login}`)}${
                  pr.draft ? chalk.yellow(' [draft]') : ''
                }`,
                value: pr.number.toString(),
              })
            ),
            pageSize: 15,
          },
        ])

        prNumber = selectedPR
      }

      spinner.start(`PR #${prNumber} の情報を取得中...`)

      // PR情報を取得
      const { stdout: prJson } = await execa('gh', [
        'pr',
        'view',
        prNumber,
        '--json',
        'number,title,author,body,headRefName,baseRefName,state,url',
      ])

      const pr = JSON.parse(prJson)

      spinner.succeed(`PR #${pr.number}: ${pr.title}`)
      console.log(chalk.gray(`Author: ${pr.author.login}`))
      console.log(chalk.gray(`Branch: ${pr.headRefName} → ${pr.baseRefName}`))
      console.log(chalk.gray(`URL: ${pr.url}`))

      // オプションに応じた処理
      if (options.checkout) {
        // PRを影分身として作り出す
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

            checkoutSpinner.succeed(
              `PR #${pr.number} を影分身 '${currentBranch}' として作り出しました`
            )
            console.log(chalk.gray(`📁 ${worktreePath}`))
            console.log(chalk.green(`\ncd ${worktreePath} で移動できます`))
          }
        } catch (error) {
          checkoutSpinner.fail('PRのチェックアウトに失敗しました')
          console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
        }
      }

      if (options.diff) {
        // PRの差分を表示
        console.log(chalk.bold('\n📝 PRの差分:\n'))
        await execa('gh', ['pr', 'diff', pr.number.toString()], { stdio: 'inherit' })
      }

      if (options.web) {
        // ブラウザでPRを開く
        console.log(chalk.cyan(`\n🌐 ブラウザでPR #${pr.number} を開いています...`))
        await execa('gh', ['pr', 'view', pr.number.toString(), '--web'])
      }

      if (options.comment) {
        // コメントを追加
        const commentSpinner = ora('コメントを投稿中...').start()
        try {
          await execa('gh', ['pr', 'comment', pr.number.toString(), '--body', options.comment])
          commentSpinner.succeed('コメントを投稿しました')
        } catch (error) {
          commentSpinner.fail('コメントの投稿に失敗しました')
          console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
        }
      }

      if (options.approve) {
        // PRを承認
        const approveSpinner = ora('PRを承認中...').start()
        try {
          await execa('gh', ['pr', 'review', pr.number.toString(), '--approve'])
          approveSpinner.succeed(`PR #${pr.number} を承認しました`)
        } catch (error) {
          approveSpinner.fail('PRの承認に失敗しました')
          console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
        }
      }

      // オプションが何も指定されていない場合はインタラクティブメニュー
      if (
        !options.checkout &&
        !options.diff &&
        !options.web &&
        !options.comment &&
        !options.approve
      ) {
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
              { name: '❌ キャンセル', value: 'cancel' },
            ],
          },
        ])

        switch (action) {
          case 'checkout':
            await reviewCommand.parseAsync([pr.number.toString(), '--checkout'], { from: 'user' })
            break
          case 'diff':
            await reviewCommand.parseAsync([pr.number.toString(), '--diff'], { from: 'user' })
            break
          case 'web':
            await reviewCommand.parseAsync([pr.number.toString(), '--web'], { from: 'user' })
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
            await reviewCommand.parseAsync([pr.number.toString(), '--comment', comment], {
              from: 'user',
            })
            break
          }
          case 'approve':
            await reviewCommand.parseAsync([pr.number.toString(), '--approve'], { from: 'user' })
            break
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

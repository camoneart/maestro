import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'
import { spawn } from 'child_process'

interface SyncOptions {
  all?: boolean
  main?: string
  fzf?: boolean
  rebase?: boolean
}

export const syncCommand = new Command('sync')
  .alias('s')
  .description('メインブランチの変更を影分身に同期')
  .argument('[branch-name]', '同期する影分身のブランチ名')
  .option('-a, --all', '全ての影分身に同期')
  .option('-m, --main <branch>', 'メインブランチを指定 (デフォルト: main または master)')
  .option('--fzf', 'fzfで同期する影分身を選択')
  .option('--rebase', 'マージの代わりにrebaseを使用')
  .action(async (branchName?: string, options: SyncOptions = {}) => {
    const spinner = ora('影分身を確認中...').start()

    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      // メインブランチを特定
      let mainBranch = options.main
      if (!mainBranch) {
        try {
          // デフォルトブランチを取得
          const { stdout } = await execa('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'])
          mainBranch = stdout.replace('refs/remotes/origin/', '')
        } catch {
          // フォールバック
          mainBranch = 'main'
          const branches = await gitManager.listBranches()
          if (!branches.includes('main') && branches.includes('master')) {
            mainBranch = 'master'
          }
        }
      }

      spinner.text = 'ワークツリーを取得中...'
      const worktrees = await gitManager.listWorktrees()
      const shadowClones = worktrees.filter(wt => !wt.path.endsWith('.'))

      if (shadowClones.length === 0) {
        spinner.fail('影分身が存在しません')
        process.exit(0)
      }

      let targetWorktrees: typeof shadowClones = []

      // 同期対象を決定
      if (options.all) {
        targetWorktrees = shadowClones
      } else if (options.fzf && !branchName) {
        spinner.stop()

        // fzfで選択（複数選択可能）
        const fzfInput = shadowClones
          .map(w => {
            const branch = w.branch?.replace('refs/heads/', '') || w.branch
            return `${branch} | ${w.path}`
          })
          .join('\n')

        const fzfProcess = spawn(
          'fzf',
          [
            '--ansi',
            '--multi',
            '--header=同期する影分身を選択 (Tab で複数選択, Ctrl-C でキャンセル)',
            '--preview',
            'echo {} | cut -d"|" -f2 | xargs ls -la',
            '--preview-window=right:50%:wrap',
          ],
          {
            stdio: ['pipe', 'pipe', 'inherit'],
          }
        )

        fzfProcess.stdin.write(fzfInput)
        fzfProcess.stdin.end()

        let selected = ''
        fzfProcess.stdout.on('data', data => {
          selected += data.toString()
        })

        await new Promise<void>(resolve => {
          fzfProcess.on('close', code => {
            if (code !== 0 || !selected.trim()) {
              console.log(chalk.gray('キャンセルされました'))
              process.exit(0)
            }

            const selectedBranches = selected
              .trim()
              .split('\n')
              .map(line => line.split('|')[0]?.trim())
              .filter(Boolean)

            targetWorktrees = shadowClones.filter(wt => {
              const branch = wt.branch?.replace('refs/heads/', '')
              return selectedBranches.includes(branch)
            })

            resolve()
          })
        })

        spinner.start()
      } else if (branchName) {
        // 特定のブランチ
        const target = shadowClones.find(wt => {
          const branch = wt.branch?.replace('refs/heads/', '')
          return branch === branchName || wt.branch === branchName
        })

        if (!target) {
          spinner.fail(`影分身 '${branchName}' が見つかりません`)
          process.exit(1)
        }

        targetWorktrees = [target]
      } else {
        // インタラクティブ選択
        spinner.stop()

        const { selectedBranches } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedBranches',
            message: '同期する影分身を選択してください:',
            choices: shadowClones.map(wt => {
              const branchName = wt.branch?.replace('refs/heads/', '') || wt.branch
              return {
                name: `${chalk.cyan(branchName)} ${chalk.gray(wt.path)}`,
                value: wt,
              }
            }),
          },
        ])

        if (selectedBranches.length === 0) {
          console.log(chalk.gray('キャンセルされました'))
          process.exit(0)
        }

        targetWorktrees = selectedBranches
        spinner.start()
      }

      spinner.text = `${mainBranch} ブランチを最新に更新中...`

      // メインワークツリーに移動して最新を取得
      const mainWorktree = worktrees.find(wt => wt.path.endsWith('.'))
      if (mainWorktree) {
        await execa('git', ['fetch', 'origin', mainBranch], { cwd: mainWorktree.path })
        await execa('git', ['checkout', mainBranch], { cwd: mainWorktree.path })
        await execa('git', ['pull', 'origin', mainBranch], { cwd: mainWorktree.path })
      }

      spinner.succeed(`${mainBranch} ブランチを最新に更新しました`)

      // 各影分身を同期
      const results = []
      for (const worktree of targetWorktrees) {
        const branchName = worktree.branch?.replace('refs/heads/', '') || worktree.branch
        const syncSpinner = ora(`${branchName} を同期中...`).start()

        try {
          // 現在のブランチの状態を保存
          const { stdout: status } = await execa('git', ['status', '--porcelain'], {
            cwd: worktree.path,
          })

          if (status.trim()) {
            syncSpinner.warn(`${branchName} に未コミットの変更があります`)
            results.push({ branch: branchName, status: 'skipped', reason: '未コミットの変更' })
            continue
          }

          // 同期実行
          if (options.rebase) {
            await execa('git', ['rebase', mainBranch], { cwd: worktree.path })
            syncSpinner.succeed(`${branchName} をrebaseしました`)
            results.push({ branch: branchName, status: 'success', method: 'rebase' })
          } else {
            await execa('git', ['merge', mainBranch, '--no-edit'], { cwd: worktree.path })
            syncSpinner.succeed(`${branchName} をマージしました`)
            results.push({ branch: branchName, status: 'success', method: 'merge' })
          }
        } catch (error) {
          syncSpinner.fail(`${branchName} の同期に失敗しました`)
          results.push({
            branch: branchName,
            status: 'failed',
            error: error instanceof Error ? error.message : '不明なエラー',
          })
        }
      }

      // 結果サマリー
      console.log('\n' + chalk.bold('🥷 同期結果:\n'))

      const successCount = results.filter(r => r.status === 'success').length
      const failedCount = results.filter(r => r.status === 'failed').length
      const skippedCount = results.filter(r => r.status === 'skipped').length

      results.forEach(result => {
        const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏭️'
        const statusText =
          result.status === 'success'
            ? chalk.green(`成功 (${result.method})`)
            : result.status === 'failed'
              ? chalk.red('失敗')
              : chalk.yellow('スキップ')

        console.log(`${icon} ${chalk.cyan(result.branch)} - ${statusText}`)
        if (result.reason) {
          console.log(`   ${chalk.gray(result.reason)}`)
        }
        if (result.error) {
          console.log(`   ${chalk.red(result.error)}`)
        }
      })

      console.log(
        chalk.gray(`\n合計: ${successCount} 成功, ${failedCount} 失敗, ${skippedCount} スキップ`)
      )

      if (failedCount > 0) {
        console.log(
          chalk.yellow('\n💡 ヒント: 競合が発生した場合は、各影分身で手動で解決してください')
        )
      }
    } catch (error) {
      spinner.fail('同期に失敗しました')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })

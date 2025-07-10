import { Command } from 'commander'
import chalk from 'chalk'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'
import ora from 'ora'

export const execCommand = new Command('exec')
  .alias('e')
  .description('影分身でコマンドを実行')
  .argument('<branch-name>', 'ブランチ名')
  .argument('<command...>', '実行するコマンド')
  .option('-s, --silent', '出力を抑制')
  .option('-a, --all', 'すべての影分身で実行')
  .action(
    async (
      branchName: string,
      commandParts: string[],
      options: { silent?: boolean; all?: boolean } = {}
    ) => {
      try {
        const gitManager = new GitWorktreeManager()

        // Gitリポジトリかチェック
        const isGitRepo = await gitManager.isGitRepository()
        if (!isGitRepo) {
          console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
          process.exit(1)
        }

        const worktrees = await gitManager.listWorktrees()
        const shadowClones = worktrees.filter((wt) => !wt.path.endsWith('.'))

        if (shadowClones.length === 0) {
          console.log(chalk.yellow('影分身が存在しません'))
          console.log(chalk.gray('scj create <branch-name> で影分身を作り出してください'))
          process.exit(0)
        }

        // コマンドを結合
        const command = commandParts.join(' ')

        // すべての影分身で実行
        if (options?.all) {
          console.log(chalk.bold(`\n🥷 すべての影分身でコマンドを実行: ${chalk.cyan(command)}\n`))

          for (const worktree of shadowClones) {
            const branchName = worktree.branch?.replace('refs/heads/', '') || worktree.branch
            console.log(chalk.green(`▶ ${branchName}`))

            try {
              const result = await execa('sh', ['-c', command], {
                cwd: worktree.path,
                env: {
                  ...process.env,
                  SHADOW_CLONE: branchName,
                  SHADOW_CLONE_PATH: worktree.path,
                },
              })

              if (!options?.silent) {
                if (result.stdout) console.log(result.stdout)
                if (result.stderr) console.error(chalk.yellow(result.stderr))
              }
              console.log()
            } catch (error) {
              if (error instanceof Error && 'exitCode' in error) {
                console.error(chalk.red(`  エラー (exit code: ${error.exitCode})`))
                if (!options?.silent && 'stderr' in error && error.stderr) {
                  console.error(chalk.red(error.stderr))
                }
              }
              console.log()
            }
          }
          return
        }

        // 特定の影分身で実行
        const targetWorktree = shadowClones.find((wt) => {
          const branch = wt.branch?.replace('refs/heads/', '')
          return branch === branchName || wt.branch === branchName
        })

        if (!targetWorktree) {
          console.error(chalk.red(`エラー: 影分身 '${branchName}' が見つかりません`))

          // 類似した名前を提案
          const similarBranches = shadowClones
            .filter((wt) => {
              const branch = wt.branch?.replace('refs/heads/', '') || ''
              return branch.includes(branchName)
            })
            .map((wt) => wt.branch?.replace('refs/heads/', '') || wt.branch)

          if (similarBranches.length > 0) {
            console.log(chalk.yellow('\n類似した影分身:'))
            similarBranches.forEach((branch) => {
              console.log(`  - ${chalk.cyan(branch)}`)
            })
          }

          process.exit(1)
        }

        const displayBranchName =
          targetWorktree.branch?.replace('refs/heads/', '') || targetWorktree.branch

        if (!options?.silent) {
          console.log(
            chalk.green(`\n🥷 影分身 '${chalk.cyan(displayBranchName)}' でコマンドを実行`)
          )
          console.log(chalk.gray(`📁 ${targetWorktree.path}`))
          console.log(chalk.gray(`$ ${command}\n`))
        }

        const spinner = options?.silent ? null : ora('実行中...').start()

        try {
          const result = await execa('sh', ['-c', command], {
            cwd: targetWorktree.path,
            env: {
              ...process.env,
              SHADOW_CLONE: displayBranchName,
              SHADOW_CLONE_PATH: targetWorktree.path,
            },
          })

          if (spinner) spinner.succeed('完了')

          if (!options?.silent) {
            if (result.stdout) console.log('\n' + result.stdout)
            if (result.stderr) console.error('\n' + chalk.yellow(result.stderr))
          }
        } catch (error) {
          if (spinner) spinner.fail('失敗')

          if (error instanceof Error && 'exitCode' in error) {
            console.error(chalk.red(`\nコマンドが失敗しました (exit code: ${error.exitCode})`))
            if (!options?.silent && 'stderr' in error && error.stderr) {
              console.error(chalk.red(error.stderr))
            }
            process.exit(error.exitCode as number)
          }
          throw error
        }
      } catch (error) {
        console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
        process.exit(1)
      }
    }
  )

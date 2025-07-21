import { Command } from 'commander'
import chalk from 'chalk'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'
import ora from 'ora'
import { Worktree } from '../types/index.js'
import { executeTmuxCommandInPane, isInTmuxSession, TmuxPaneType } from '../utils/tmux.js'
import { selectWorktreeWithFzf, isFzfAvailable } from '../utils/fzf.js'

// すべての演奏者でコマンドを実行
async function executeOnAllMembers(
  orchestraMembers: Worktree[],
  command: string,
  silent?: boolean
): Promise<void> {
  console.log(chalk.bold(`\n🎼 すべての演奏者でコマンドを実行: ${chalk.cyan(command)}\n`))

  for (const worktree of orchestraMembers) {
    const branchName = worktree.branch?.replace('refs/heads/', '') || worktree.branch
    console.log(chalk.green(`▶ ${branchName}`))

    try {
      const result = await execa('sh', ['-c', command], {
        cwd: worktree.path,
        env: {
          ...process.env,
          MAESTRO_BRANCH: branchName,
          MAESTRO_PATH: worktree.path,
        },
      })

      if (!silent) {
        if (result.stdout) console.log(result.stdout)
        if (result.stderr) console.error(chalk.yellow(result.stderr))
      }
      console.log()
    } catch (error) {
      if (error instanceof Error && 'exitCode' in error) {
        console.error(chalk.red(`  エラー (exit code: ${error.exitCode})`))
        if (!silent && 'stderr' in error && error.stderr) {
          console.error(chalk.red(error.stderr))
        }
      }
      console.log()
    }
  }
}

// 類似のブランチ名を提案
function suggestSimilarBranches(orchestraMembers: Worktree[], branchName: string): void {
  const similarBranches = orchestraMembers
    .filter(wt => {
      const branch = wt.branch?.replace('refs/heads/', '') || ''
      return branch.includes(branchName)
    })
    .map(wt => wt.branch?.replace('refs/heads/', '') || wt.branch)

  if (similarBranches.length > 0) {
    console.log(chalk.yellow('\n類似した演奏者:'))
    similarBranches.forEach(branch => {
      console.log(`  - ${chalk.cyan(branch)}`)
    })
  }
}

// 特定の演奏者でコマンドを実行
async function executeOnSpecificMember(
  targetWorktree: Worktree,
  command: string,
  silent?: boolean
): Promise<void> {
  const displayBranchName =
    targetWorktree.branch?.replace('refs/heads/', '') || targetWorktree.branch

  if (!silent) {
    console.log(chalk.green(`\n🎼 演奏者 '${chalk.cyan(displayBranchName)}' でコマンドを実行`))
    console.log(chalk.gray(`📁 ${targetWorktree.path}`))
    console.log(chalk.gray(`$ ${command}\n`))
  }

  const spinner = silent ? null : ora('実行中...').start()

  try {
    const result = await execa('sh', ['-c', command], {
      cwd: targetWorktree.path,
      env: {
        ...process.env,
        MAESTRO_BRANCH: displayBranchName,
        MAESTRO_PATH: targetWorktree.path,
      },
    })

    if (spinner) spinner.succeed('完了')

    if (!silent) {
      if (result.stdout) console.log('\n' + result.stdout)
      if (result.stderr) console.error('\n' + chalk.yellow(result.stderr))
    }
  } catch (error) {
    if (spinner) spinner.fail('失敗')

    if (error instanceof Error && 'exitCode' in error) {
      console.error(chalk.red(`\nコマンドが失敗しました (exit code: ${error.exitCode})`))
      if (!silent && 'stderr' in error && error.stderr) {
        console.error(chalk.red(error.stderr))
      }
      process.exit(error.exitCode as number)
    }
    throw error
  }
}

interface ExecOptions {
  silent?: boolean
  all?: boolean
  fzf?: boolean
  tmux?: boolean
  tmuxVertical?: boolean
  tmuxHorizontal?: boolean
}

export const execCommand = new Command('exec')
  .alias('e')
  .description('演奏者でコマンドを実行')
  .argument('[branch-name]', 'ブランチ名（省略時またはfzfオプション時は選択）')
  .argument('[command...]', '実行するコマンド')
  .option('-s, --silent', '出力を抑制')
  .option('-a, --all', 'すべての演奏者で実行')
  .option('--fzf', 'fzfで演奏者を選択')
  .option('-t, --tmux', 'tmuxの新しいウィンドウで実行')
  .option('--tmux-vertical, --tmux-v', 'tmuxの縦分割ペインで実行')
  .option('--tmux-horizontal, --tmux-h', 'tmuxの横分割ペインで実行')
  .action(
    async (
      branchName: string | undefined,
      commandParts: string[],
      options: ExecOptions = {}
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
        const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

        if (orchestraMembers.length === 0) {
          console.log(chalk.yellow('演奏者が存在しません'))
          console.log(chalk.gray('maestro create <branch-name> で演奏者を招集してください'))
          process.exit(0)
        }

        // コマンドを結合
        const command = commandParts.join(' ')
        if (!command && !options.all) {
          console.error(chalk.red('エラー: 実行するコマンドを指定してください'))
          process.exit(1)
        }

        // --allオプションの処理
        if (options?.all) {
          await executeOnAllMembers(orchestraMembers, command, options.silent)
          return
        }

        // tmuxオプションの検証
        const tmuxOptionsCount = [options.tmux, options.tmuxVertical, options.tmuxHorizontal].filter(Boolean).length
        if (tmuxOptionsCount > 1) {
          console.error(chalk.red('エラー: tmuxオプションは一つだけ指定してください'))
          process.exit(1)
        }

        const isUsingTmux = options.tmux || options.tmuxVertical || options.tmuxHorizontal
        if (isUsingTmux && !(await isInTmuxSession())) {
          console.error(chalk.red('エラー: tmuxオプションを使用するにはtmuxセッション内にいる必要があります'))
          process.exit(1)
        }

        // ブランチ名が指定されていない場合またはfzfオプションが指定された場合
        if (!branchName || options?.fzf) {
          if (options?.fzf) {
            // fzfの利用可能性をチェック
            if (!(await isFzfAvailable())) {
              console.error(chalk.red('エラー: fzfがインストールされていません'))
              process.exit(1)
            }

            const selectedBranch = await selectWorktreeWithFzf(
              orchestraMembers,
              'コマンドを実行する演奏者を選択 (Ctrl-C でキャンセル)'
            )

            if (!selectedBranch) {
              console.log(chalk.gray('キャンセルされました'))
              process.exit(0)
            }

            branchName = selectedBranch
          } else {
            console.error(chalk.red('エラー: ブランチ名を指定するか --fzf オプションを使用してください'))
            process.exit(1)
          }
        }

        const targetWorktree = orchestraMembers.find(wt => {
          const branch = wt.branch?.replace('refs/heads/', '')
          return branch === branchName || wt.branch === branchName
        })

        if (!targetWorktree) {
          console.error(chalk.red(`エラー: 演奏者 '${branchName}' が見つかりません`))
          suggestSimilarBranches(orchestraMembers, branchName)
          process.exit(1)
        }

        // tmuxでの実行
        if (isUsingTmux) {
          const displayBranchName = targetWorktree.branch?.replace('refs/heads/', '') || targetWorktree.branch

          let paneType: TmuxPaneType = 'new-window'
          if (options.tmuxVertical) paneType = 'vertical-split'
          if (options.tmuxHorizontal) paneType = 'horizontal-split'

          console.log(chalk.green(`\n🎼 演奏者 '${chalk.cyan(displayBranchName)}' でtmux ${paneType}コマンドを実行`))
          console.log(chalk.gray(`📁 ${targetWorktree.path}`))
          console.log(chalk.gray(`$ ${command}\n`))

          await executeTmuxCommandInPane(command, {
            cwd: targetWorktree.path,
            branchName: displayBranchName,
            paneType,
            sessionName: displayBranchName,
          })

          return
        }

        // 通常の実行
        await executeOnSpecificMember(targetWorktree, command, options.silent)
      } catch (error) {
        console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
        process.exit(1)
      }
    }
  )

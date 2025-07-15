import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { DeleteOptions, Worktree } from '../types/index.js'
import { execa } from 'execa'
import { spawn } from 'child_process'

// エラークラス
class DeleteCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeleteCommandError'
  }
}

// ディレクトリサイズをフォーマットする関数
export function formatDirectorySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// worktree表示文字列を作成する関数
export function createWorktreeDisplay(worktree: Worktree): string {
  let display = worktree.branch || worktree.head
  
  if (worktree.locked) {
    display = `🔒 ${display}`
  }
  
  if (worktree.detached) {
    display = `⚠️  ${display} (detached)`
  }
  
  return display
}

// ディレクトリサイズを取得する関数
export async function getDirectorySize(dirPath: string): Promise<string> {
  try {
    const { stdout } = await execa('du', ['-sh', dirPath])
    const size = stdout.split('\t')[0]
    return size || 'unknown'
  } catch {
    return 'unknown'
  }
}

// リモートブランチを削除する関数
export async function deleteRemoteBranch(branchName: string): Promise<void> {
  const remoteSpinner = ora('リモートブランチを削除中...').start()

  try {
    // リモートブランチが存在するか確認
    const { stdout: remoteBranches } = await execa('git', ['branch', '-r'])
    const remoteBranchName = `origin/${branchName}`

    if (!remoteBranches.includes(remoteBranchName)) {
      remoteSpinner.warn(`リモートブランチ '${remoteBranchName}' は存在しません`)
      return
    }

    // リモートブランチを削除
    await execa('git', ['push', 'origin', '--delete', branchName])
    remoteSpinner.succeed(`リモートブランチ '${chalk.cyan(remoteBranchName)}' を削除しました`)
  } catch (error) {
    remoteSpinner.fail('リモートブランチの削除に失敗しました')
    throw new DeleteCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

export const deleteCommand = new Command('delete')
  .alias('rm')
  .description('影分身（worktree）を削除')
  .argument('[branch-name]', '削除するブランチ名')
  .option('-f, --force', '強制削除')
  .option('-r, --remove-remote', 'リモートブランチも削除')
  .option('--fzf', 'fzfで選択（複数選択可）')
  .option('--current', '現在のworktreeを削除')
  .action(
    async (
      branchName?: string,
      options: DeleteOptions & { fzf?: boolean; current?: boolean } = {}
    ) => {
      const spinner = ora('影分身を確認中...').start()

      try {
        const gitManager = new GitWorktreeManager()

        // Gitリポジトリかチェック
        const isGitRepo = await gitManager.isGitRepository()
        if (!isGitRepo) {
          throw new DeleteCommandError('このディレクトリはGitリポジトリではありません')
        }

        // ワークツリー一覧を取得
        const worktrees = await gitManager.listWorktrees()
        const shadowClones = worktrees.filter(wt => !wt.path.endsWith('.'))

        if (shadowClones.length === 0) {
          spinner.fail('影分身が存在しません')
          return
        }

        let targetWorktrees: Worktree[] = []

        // fzfで複数選択
        if (options.fzf && !branchName) {
          spinner.stop()

          const fzfInput = shadowClones
            .map(w => {
              const status = []
              if (w.locked) status.push(chalk.red('ロック'))
              if (w.prunable) status.push(chalk.yellow('削除可能'))

              const statusStr = status.length > 0 ? ` [${status.join(', ')}]` : ''
              const branch = w.branch?.replace('refs/heads/', '') || w.branch
              return `${branch}${statusStr} | ${w.path}`
            })
            .join('\n')

          const fzfProcess = spawn(
            'fzf',
            [
              '--ansi',
              '--multi',
              '--header=削除する影分身を選択 (Tab で複数選択, Ctrl-C でキャンセル)',
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

          await new Promise<void>((resolve, reject) => {
            fzfProcess.on('close', code => {
              if (code !== 0 || !selected.trim()) {
                reject(new DeleteCommandError('キャンセルされました'))
                return
              }

              const selectedBranches = selected
                .trim()
                .split('\n')
                .map(line =>
                  line
                    .split('|')[0]
                    ?.trim()
                    .replace(/\[.*\]/, '')
                    .trim()
                )
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
          // 単一のブランチを指定
          const targetWorktree = worktrees.find(wt => {
            const branch = wt.branch?.replace('refs/heads/', '')
            return branch === branchName || wt.branch === branchName
          })

          if (!targetWorktree) {
            spinner.fail(`影分身 '${branchName}' が見つかりません`)

            // 類似した名前を提案
            const similarBranches = worktrees
              .filter(wt => wt.branch && wt.branch.includes(branchName))
              .map(wt => wt.branch?.replace('refs/heads/', '') || wt.branch)

            if (similarBranches.length > 0) {
              console.log(chalk.yellow('\n類似した影分身:'))
              similarBranches.forEach(branch => {
                console.log(`  - ${chalk.cyan(branch)}`)
              })
            }

            throw new DeleteCommandError('指定された影分身が見つかりません')
          }

          targetWorktrees = [targetWorktree]
        } else if (options.current) {
          // 現在のworktreeを削除
          const currentPath = process.cwd()
          const currentWorktree = worktrees.find(wt => wt.path === currentPath)

          if (!currentWorktree) {
            throw new DeleteCommandError('現在のディレクトリはworktreeではありません')
          }

          if (currentWorktree.path.endsWith('.')) {
            throw new DeleteCommandError('メインworktreeは削除できません')
          }

          targetWorktrees = [currentWorktree]
        } else {
          throw new DeleteCommandError('削除対象を指定してください')
        }

        spinner.stop()

        // 削除対象の詳細表示
        console.log(chalk.bold('\n🗑️  削除対象の影分身:\n'))

        const deletionDetails = await Promise.all(
          targetWorktrees.map(async wt => {
            const branch = wt.branch?.replace('refs/heads/', '') || wt.branch
            const size = await getDirectorySize(wt.path)
            return { worktree: wt, branch, size }
          })
        )

        deletionDetails.forEach(({ branch, size, worktree }) => {
          console.log(
            `  ${chalk.cyan(branch || 'unknown')} ${chalk.gray(`(${size})`)} - ${chalk.gray(
              worktree.path
            )}`
          )
          if (worktree.locked) {
            console.log(
              `    ${chalk.red('⚠️  ロックされています')}: ${worktree.reason || '理由不明'}`
            )
          }
        })

        console.log(chalk.gray(`\n合計: ${targetWorktrees.length} 個の影分身`))

        // 削除確認
        if (!options.force) {
          const { confirmDelete } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmDelete',
              message: chalk.yellow('本当にこれらの影分身を削除しますか？'),
              default: false,
            },
          ])

          if (!confirmDelete) {
            console.log(chalk.gray('キャンセルされました'))
            return
          }
        }

        // 削除実行
        console.log()
        const results: { branch: string; status: 'success' | 'failed'; error?: string }[] = []

        for (const worktree of targetWorktrees) {
          const branch = worktree.branch?.replace('refs/heads/', '') || worktree.branch || 'unknown'
          const deleteSpinner = ora(`影分身 '${chalk.cyan(branch)}' を削除中...`).start()

          try {
            // ワークツリーを削除
            await gitManager.deleteWorktree(worktree.branch || '', options.force)
            deleteSpinner.succeed(`影分身 '${chalk.cyan(branch)}' を削除しました`)

            // リモートブランチも削除
            if (options.removeRemote && worktree.branch) {
              await deleteRemoteBranch(worktree.branch.replace('refs/heads/', ''))
            }

            results.push({ branch, status: 'success' })
          } catch (error) {
            deleteSpinner.fail(`影分身 '${chalk.cyan(branch)}' の削除に失敗しました`)
            results.push({
              branch,
              status: 'failed',
              error: error instanceof Error ? error.message : '不明なエラー',
            })
          }
        }

        // 結果サマリー
        console.log(chalk.bold('\n🥷 削除結果:\n'))

        const successCount = results.filter(r => r.status === 'success').length
        const failedCount = results.filter(r => r.status === 'failed').length

        results.forEach(result => {
          const icon = result.status === 'success' ? '✅' : '❌'
          const statusText = result.status === 'success' ? chalk.green('成功') : chalk.red('失敗')

          console.log(`${icon} ${chalk.cyan(result.branch)} - ${statusText}`)
          if (result.error) {
            console.log(`   ${chalk.red(result.error)}`)
          }
        })

        console.log(chalk.gray(`\n合計: ${successCount} 成功, ${failedCount} 失敗`))

        if (successCount > 0) {
          console.log(chalk.green('\n✨ 影分身の削除が完了しました！'))
        }
      } catch (error) {
        spinner.fail('エラーが発生しました')
        if (error instanceof DeleteCommandError) {
          console.error(chalk.red(error.message))
          process.exitCode = 1
        } else {
          console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
          process.exitCode = 1
        }
      }
    }
  )

import { Command } from 'commander'
import chalk from 'chalk'
import { GitWorktreeManager } from '../core/git.js'
import { Worktree } from '../types/index.js'
import { spawn } from 'child_process'

export const listCommand = new Command('list')
  .alias('ls')
  .description('影分身（worktree）の一覧を表示')
  .option('-j, --json', 'JSON形式で出力')
  .option('--fzf', 'fzfで選択し、選択したブランチ名を出力')
  .action(async (options: { json?: boolean; fzf?: boolean }) => {
    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
        process.exit(1)
      }

      const worktrees = await gitManager.listWorktrees()

      if (options.json) {
        console.log(JSON.stringify(worktrees, null, 2))
        return
      }

      if (worktrees.length === 0) {
        console.log(chalk.yellow('影分身が存在しません'))
        return
      }

      // fzfで選択
      if (options.fzf) {
        const fzfInput = worktrees
          .map(w => {
            const status = []
            if (w.isCurrentDirectory) status.push(chalk.green('現在'))
            if (w.isLocked) status.push(chalk.red('ロック'))
            if (w.isPrunable) status.push(chalk.yellow('削除可能'))
            
            const statusStr = status.length > 0 ? ` [${status.join(', ')}]` : ''
            return `${w.branch}${statusStr} | ${w.path}`
          })
          .join('\n')

        const fzfProcess = spawn('fzf', [
          '--ansi',
          '--header=影分身を選択 (Ctrl-C でキャンセル)',
          '--preview', 'echo {} | cut -d"|" -f2 | xargs ls -la',
          '--preview-window=right:50%:wrap'
        ], {
          stdio: ['pipe', 'pipe', 'inherit']
        })

        // fzfにデータを送る
        fzfProcess.stdin.write(fzfInput)
        fzfProcess.stdin.end()

        // 選択結果を取得
        let selected = ''
        fzfProcess.stdout.on('data', (data) => {
          selected += data.toString()
        })

        fzfProcess.on('close', (code) => {
          if (code !== 0 || !selected.trim()) {
            // キャンセルされた場合は何も出力しない
            return
          }

          // ブランチ名を抽出して出力
          const selectedBranch = selected.split('|')[0]?.trim().replace(/\[.*\]/, '').trim()
          if (selectedBranch) {
            console.log(selectedBranch.replace('refs/heads/', ''))
          }
        })
        return
      }

      console.log(chalk.bold('\n🥷 影分身一覧:\n'))

      // メインワークツリーを先頭に表示
      const mainWorktree = worktrees.find(wt => wt.path.endsWith('.'))
      const cloneWorktrees = worktrees.filter(wt => !wt.path.endsWith('.'))

      if (mainWorktree) {
        displayWorktree(mainWorktree, true)
      }

      cloneWorktrees.forEach(wt => displayWorktree(wt, false))

      console.log(chalk.gray(`\n合計: ${worktrees.length} 個の影分身`))

    } catch (error) {
      console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
      process.exit(1)
    }
  })

function displayWorktree(worktree: Worktree, isMain: boolean) {
  const prefix = isMain ? '📍' : '🥷'
  const branchName = worktree.branch || '(detached)'
  const status = []

  if (worktree.locked) {
    status.push(chalk.red('🔒 ロック中'))
    if (worktree.reason) {
      status.push(chalk.gray(`(${worktree.reason})`))
    }
  }

  if (worktree.prunable) {
    status.push(chalk.yellow('⚠️  削除可能'))
  }

  console.log(
    `${prefix} ${chalk.cyan(branchName.padEnd(30))} ` +
    `${chalk.gray(worktree.path)} ` +
    `${status.join(' ')}`
  )
}
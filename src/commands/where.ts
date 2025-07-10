import { Command } from 'commander'
import chalk from 'chalk'
import { GitWorktreeManager } from '../core/git.js'
import { spawn } from 'child_process'

export const whereCommand = new Command('where')
  .alias('w')
  .description('影分身（worktree）のパスを表示')
  .argument('[branch-name]', 'ブランチ名')
  .option('--fzf', 'fzfで選択')
  .option('--current', '現在のworktreeのパスを表示')
  .action(async (branchName?: string, options: { fzf?: boolean; current?: boolean } = {}) => {
    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
        process.exit(1)
      }

      // 現在のworktreeのパスを表示
      if (options?.current) {
        console.log(process.cwd())
        return
      }

      const worktrees = await gitManager.listWorktrees()

      // fzfで選択
      if (options?.fzf) {
        if (worktrees.length === 0) {
          console.log(chalk.yellow('影分身が存在しません'))
          process.exit(0)
        }

        // fzfで選択
        const fzfInput = worktrees
          .map(w => {
            const status = []
            if (w.isCurrentDirectory) status.push(chalk.green('現在'))
            if (w.locked) status.push(chalk.red('ロック'))
            if (w.prunable) status.push(chalk.yellow('削除可能'))
            
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
            console.log(chalk.gray('キャンセルされました'))
            return
          }

          // パスを抽出して表示
          const selectedPath = selected.split('|')[1]?.trim()
          if (selectedPath) {
            console.log(selectedPath)
          }
        })
        return
      }

      // ブランチ名が指定されていない場合
      if (!branchName) {
        console.error(chalk.red('エラー: ブランチ名を指定するか、--fzf または --current オプションを使用してください'))
        console.log(chalk.gray('使い方:'))
        console.log('  scj where <branch-name>    # 指定した影分身のパスを表示')
        console.log('  scj where --fzf            # fzfで影分身を選択')
        console.log('  scj where --current        # 現在のworktreeのパスを表示')
        process.exit(1)
      }

      // refs/heads/プレフィックスを処理
      const searchBranch = branchName.startsWith('refs/heads/') 
        ? branchName 
        : `refs/heads/${branchName}`

      // 指定されたブランチのworktreeを検索
      const worktree = worktrees.find(w => 
        w.branch === searchBranch || 
        w.branch === `refs/heads/${branchName}` ||
        w.branch.endsWith(`/${branchName}`)
      )

      if (!worktree) {
        console.error(chalk.red(`エラー: 影分身 '${branchName}' が見つかりません`))
        
        // 類似した影分身を提案
        const suggestions = worktrees
          .filter(w => w.branch.toLowerCase().includes(branchName.toLowerCase()))
          .map(w => w.branch.replace('refs/heads/', ''))
        
        if (suggestions.length > 0) {
          console.log(chalk.yellow('\n類似した影分身:'))
          suggestions.forEach(s => console.log(`  - ${s}`))
        }
        
        process.exit(1)
      }

      // パスを表示
      console.log(worktree.path)

    } catch (error) {
      console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
      process.exit(1)
    }
  })
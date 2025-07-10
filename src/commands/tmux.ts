import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'
import { spawn } from 'child_process'

export const tmuxCommand = new Command('tmux')
  .alias('t')
  .description('tmux/fzfで影分身を選択して開く')
  .option('-n, --new-window', '新しいウィンドウで開く')
  .option('-p, --split-pane', '現在のペインを分割して開く')
  .option('-v, --vertical', '垂直分割（-pと併用）')
  .action(async (options: { newWindow?: boolean; splitPane?: boolean; vertical?: boolean } = {}) => {
    const spinner = ora('影分身の術！').start()

    try {
      // tmuxがインストールされているか確認
      try {
        await execa('tmux', ['-V'])
      } catch {
        spinner.fail('tmuxがインストールされていません')
        console.log(chalk.yellow('\nインストール方法:'))
        console.log('  brew install tmux')
        console.log('  または https://github.com/tmux/tmux')
        process.exit(1)
      }

      // fzfがインストールされているか確認
      try {
        await execa('fzf', ['--version'])
      } catch {
        spinner.fail('fzfがインストールされていません')
        console.log(chalk.yellow('\nインストール方法:'))
        console.log('  brew install fzf')
        console.log('  または https://github.com/junegunn/fzf')
        process.exit(1)
      }

      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      spinner.stop()

      // worktree一覧を取得
      const worktrees = await gitManager.listWorktrees()
      
      if (worktrees.length === 0) {
        console.log(chalk.yellow('影分身が存在しません'))
        console.log(chalk.gray('\n作成方法:'))
        console.log('  scj create <branch-name>')
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

      fzfProcess.on('close', async (code) => {
        if (code !== 0 || !selected.trim()) {
          console.log(chalk.gray('キャンセルされました'))
          return
        }

        // パスを抽出
        const selectedPath = selected.split('|')[1]?.trim()
        if (!selectedPath) {
          console.error(chalk.red('エラー: パスを取得できませんでした'))
          process.exit(1)
        }

        const selectedBranch = selected.split('|')[0]?.trim().replace(/\[.*\]/, '').trim()

        // tmuxセッション内かチェック
        const inTmux = process.env.TMUX !== undefined

        if (!inTmux) {
          // tmux外から実行された場合は新しいセッションを作成
          console.log(chalk.cyan(`\n新しいtmuxセッション '${selectedBranch}' を作成します...`))
          
          try {
            await execa('tmux', ['new-session', '-s', selectedBranch || '', '-c', selectedPath])
          } catch (error) {
            // セッションが既に存在する場合はアタッチ
            try {
              await execa('tmux', ['attach-session', '-t', selectedBranch || ''])
            } catch {
              console.error(chalk.red('tmuxセッションの作成/アタッチに失敗しました'))
              process.exit(1)
            }
          }
        } else {
          // tmux内から実行された場合
          if (options?.newWindow) {
            // 新しいウィンドウで開く
            await execa('tmux', ['new-window', '-n', selectedBranch || '', '-c', selectedPath])
            console.log(chalk.green(`✨ 新しいウィンドウ '${selectedBranch}' を開きました`))
          } else if (options?.splitPane) {
            // ペインを分割して開く
            const splitOption = options?.vertical ? '-h' : '-v'
            await execa('tmux', ['split-window', splitOption, '-c', selectedPath])
            console.log(chalk.green(`✨ ペインを${options?.vertical ? '垂直' : '水平'}分割して '${selectedBranch}' を開きました`))
          } else {
            // デフォルト: 現在のペインでディレクトリを変更
            console.log(chalk.green(`\n✨ 影分身 '${selectedBranch}' を選択しました`))
            console.log(chalk.gray(`cd ${selectedPath} で移動してください`))
          }
        }
      })

    } catch (error) {
      spinner.fail('影分身を開けませんでした')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
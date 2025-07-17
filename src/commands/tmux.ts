import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'
import { spawn } from 'child_process'

// 型定義
interface TmuxOptions {
  newWindow?: boolean
  splitPane?: boolean
  vertical?: boolean
  editor?: string
  detach?: boolean
}

interface TmuxSession {
  name: string
  attached: boolean
  windows: number
  created: string
}

// エラークラス
class TmuxCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TmuxCommandError'
  }
}

// tmuxセッション一覧を取得
async function getTmuxSessions(): Promise<TmuxSession[]> {
  try {
    const { stdout } = await execa('tmux', [
      'list-sessions',
      '-F',
      '#{session_name}:#{session_attached}:#{session_windows}:#{session_created}',
    ])

    return stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [name, attached, windows, created] = line.split(':')
        return {
          name: name || 'unknown',
          attached: attached === '1',
          windows: parseInt(windows || '0', 10),
          created: new Date(parseInt(created || '0', 10) * 1000).toLocaleString(),
        }
      })
  } catch {
    return []
  }
}

// セッション一覧をテーブル表示
function displaySessionsTable(sessions: TmuxSession[]): void {
  if (sessions.length === 0) {
    console.log(chalk.gray('アクティブなセッションはありません'))
    return
  }

  console.log(chalk.bold('\n📋 Tmuxセッション一覧:\n'))

  // ヘッダー
  console.log(
    chalk.gray('Name'.padEnd(30)) +
      chalk.gray('Attached'.padEnd(12)) +
      chalk.gray('Windows'.padEnd(10)) +
      chalk.gray('Created')
  )
  console.log(chalk.gray('─'.repeat(80)))

  // セッション情報
  sessions.forEach(session => {
    const nameDisplay = session.attached
      ? chalk.green(session.name.padEnd(30))
      : chalk.cyan(session.name.padEnd(30))
    const attachedDisplay = session.attached
      ? chalk.green('Yes'.padEnd(12))
      : chalk.gray('No'.padEnd(12))
    const windowsDisplay = chalk.white(session.windows.toString().padEnd(10))
    const createdDisplay = chalk.gray(session.created)

    console.log(nameDisplay + attachedDisplay + windowsDisplay + createdDisplay)
  })

  console.log(
    chalk.gray('\n💡 ヒント: tmux attach -t <session-name> でセッションにアタッチできます')
  )
}

// エディタを起動するコマンドを生成
function getEditorCommand(editor: string): string {
  switch (editor) {
    case 'nvim':
    case 'vim':
      return `${editor} .`
    case 'code':
      return `code .`
    case 'emacs':
      return `emacs .`
    default:
      return ''
  }
}

export const tmuxCommand = new Command('tmux')
  .alias('t')
  .description('tmux/fzfで演奏者を選択して開く')
  .argument('[branch-name]', 'ブランチ名（省略時はfzfで選択）')
  .option('-n, --new-window', '新しいウィンドウで開く')
  .option('-p, --split-pane', '現在のペインを分割して開く')
  .option('-v, --vertical', '垂直分割（-pと併用）')
  .option('-e, --editor <editor>', 'エディタを自動起動 (nvim, vim, code, emacs)')
  .option('-d, --detach', '新セッション作成のみ (attachしない)')
  .action(async (branchName?: string, options: TmuxOptions = {}) => {
    const spinner = ora('オーケストレーション！').start()

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
        console.log(chalk.yellow('演奏者が存在しません'))
        console.log(chalk.gray('\n作成方法:'))
        console.log('  maestro create <branch-name>')
        process.exit(0)
      }

      // ブランチ名が指定されている場合
      if (branchName) {
        const worktree = worktrees.find(wt => {
          const branch = wt.branch?.replace('refs/heads/', '')
          return branch === branchName
        })

        if (!worktree) {
          console.error(chalk.red(`ワークツリー '${branchName}' が見つかりません`))
          process.exit(1)
        }

        // 直接tmuxセッションを作成
        const sessionName = branchName.replace(/[^a-zA-Z0-9_-]/g, '-')
        const editorCmd = options.editor ? getEditorCommand(options.editor) : ''
        const tmuxArgs = ['new-session', '-s', sessionName, '-c', worktree.path]

        if (options.detach) {
          tmuxArgs.push('-d')
          if (editorCmd) {
            tmuxArgs.push(editorCmd)
          }

          try {
            await execa('tmux', tmuxArgs)
            console.log(chalk.cyan(`\n新しいtmuxセッション '${sessionName}' を作成しました`))
            const sessions = await getTmuxSessions()
            displaySessionsTable(sessions)
          } catch (error) {
            if (error instanceof Error && error.message.includes('duplicate session')) {
              console.log(chalk.yellow(`\nセッション '${sessionName}' は既に存在します`))
              const sessions = await getTmuxSessions()
              displaySessionsTable(sessions)
            } else {
              throw error
            }
          }
        } else {
          console.log(chalk.cyan(`\n新しいtmuxセッション '${sessionName}' を作成します...`))

          if (editorCmd) {
            spawn('tmux', [...tmuxArgs, editorCmd], { stdio: 'inherit' })
          } else {
            spawn('tmux', tmuxArgs, { stdio: 'inherit' })
          }
        }
        return
      }

      // ブランチ名が指定されていない場合、fzfで選択
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

      const fzfProcess = spawn(
        'fzf',
        [
          '--ansi',
          '--header=演奏者を選択 (Ctrl-C でキャンセル)',
          '--preview',
          'echo {} | cut -d"|" -f2 | xargs ls -la',
          '--preview-window=right:50%:wrap',
        ],
        {
          stdio: ['pipe', 'pipe', 'inherit'],
        }
      )

      // fzfにデータを送る
      fzfProcess.stdin.write(fzfInput)
      fzfProcess.stdin.end()

      // 選択結果を取得
      let selected = ''
      fzfProcess.stdout.on('data', data => {
        selected += data.toString()
      })

      fzfProcess.on('close', async code => {
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

        const selectedBranch = selected
          .split('|')[0]
          ?.trim()
          .replace(/\[.*\]/, '')
          .trim()

        // tmuxセッション内かチェック
        const inTmux = process.env.TMUX !== undefined

        if (!inTmux) {
          // tmux外から実行された場合は新しいセッションを作成
          const sessionName = selectedBranch?.replace(/[^a-zA-Z0-9_-]/g, '-') || 'shadow'

          // エディタコマンドを構築
          const editorCmd = options.editor ? getEditorCommand(options.editor) : ''
          const tmuxArgs = ['new-session', '-s', sessionName, '-c', selectedPath]

          if (options.detach) {
            tmuxArgs.push('-d')
            if (editorCmd) {
              tmuxArgs.push(editorCmd)
            }

            console.log(chalk.cyan(`\n新しいtmuxセッション '${sessionName}' を作成しました`))

            try {
              await execa('tmux', tmuxArgs)

              // detachモードの場合はセッション一覧を表示
              const sessions = await getTmuxSessions()
              displaySessionsTable(sessions)
            } catch (error) {
              // セッションが既に存在する場合
              if (error instanceof Error && error.message.includes('duplicate session')) {
                console.log(chalk.yellow(`\nセッション '${sessionName}' は既に存在します`))
                const sessions = await getTmuxSessions()
                displaySessionsTable(sessions)
              } else {
                throw error
              }
            }
          } else {
            console.log(chalk.cyan(`\n新しいtmuxセッション '${sessionName}' を作成します...`))

            try {
              // インタラクティブモード
              if (editorCmd) {
                spawn('tmux', [...tmuxArgs, editorCmd], { stdio: 'inherit' })
              } else {
                spawn('tmux', tmuxArgs, { stdio: 'inherit' })
              }
            } catch {
              // セッションが既に存在する場合はアタッチ
              try {
                spawn('tmux', ['attach-session', '-t', sessionName], { stdio: 'inherit' })
              } catch {
                console.error(chalk.red('tmuxセッションの作成/アタッチに失敗しました'))
                process.exit(1)
              }
            }
          }
        } else if (options?.newWindow) {
          // tmux内から実行された場合
          // 新しいウィンドウで開く
          const windowArgs = ['new-window', '-n', selectedBranch || '', '-c', selectedPath]

          // エディタオプションが指定されている場合
          if (options.editor) {
            const editorCmd = getEditorCommand(options.editor)
            if (editorCmd) {
              windowArgs.push(editorCmd)
            }
          }

          await execa('tmux', windowArgs)
          console.log(chalk.green(`✨ 新しいウィンドウ '${selectedBranch}' を開きました`))
        } else if (options?.splitPane) {
          // ペインを分割して開く
          const splitOption = options?.vertical ? '-h' : '-v'
          const paneArgs = ['split-window', splitOption, '-c', selectedPath]

          // エディタオプションが指定されている場合
          if (options.editor) {
            const editorCmd = getEditorCommand(options.editor)
            if (editorCmd) {
              paneArgs.push(editorCmd)
            }
          }

          await execa('tmux', paneArgs)
          console.log(
            chalk.green(
              `✨ ペインを${options?.vertical ? '垂直' : '水平'}分割して '${selectedBranch}' を開きました`
            )
          )
        } else {
          // デフォルト: 現在のペインでディレクトリを変更
          console.log(chalk.green(`\n✨ 演奏者 '${selectedBranch}' を選択しました`))
          console.log(chalk.gray(`cd ${selectedPath} で移動してください`))

          // エディタ起動オプションが指定されている場合
          if (options.editor) {
            const editorCmd = getEditorCommand(options.editor)
            if (editorCmd) {
              console.log(chalk.gray(`エディタを起動: ${editorCmd}`))
              // 現在のディレクトリでエディタを起動
              await execa('tmux', ['send-keys', `cd ${selectedPath} && ${editorCmd}`, 'Enter'])
            }
          }
        }
      })
    } catch (error) {
      spinner.fail('エラーが発生しました')
      if (error instanceof TmuxCommandError) {
        console.error(chalk.red(error.message))
        process.exitCode = 1
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
        process.exitCode = 1
      }
    }
  })

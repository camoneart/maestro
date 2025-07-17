import { Command } from 'commander'
import chalk from 'chalk'
import { GitWorktreeManager } from '../core/git.js'
import { spawn } from 'child_process'
import inquirer from 'inquirer'
import { execa } from 'execa'
import { ErrorFactory, handleError } from '../utils/errors.js'

export const shellCommand = new Command('shell')
  .alias('sh')
  .description('演奏者のシェルに入る')
  .argument('[branch-name]', 'ブランチ名（省略時は選択）')
  .option('--fzf', 'fzfで選択')
  .option('--cmd <command>', '指定コマンド実行して終了')
  .option('--tmux', '既存tmuxセッションにアタッチ（存在しなければ作成）')
  .action(
    async (branchName?: string, options: { fzf?: boolean; cmd?: string; tmux?: boolean } = {}) => {
      try {
        const gitManager = new GitWorktreeManager()

        // Gitリポジトリかチェック
        const isGitRepo = await gitManager.isGitRepository()
        if (!isGitRepo) {
          throw ErrorFactory.notGitRepository()
        }

        const worktrees = await gitManager.listWorktrees()

        // メインブランチを除外
        const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

        if (orchestraMembers.length === 0) {
          console.log(chalk.yellow('演奏者が存在しません'))
          console.log(chalk.gray('scj create <branch-name> で演奏者を招集してください'))
          process.exit(0)
        }

        // ブランチ名が指定されていない場合は選択
        if (!branchName) {
          // fzfオプションが指定されている場合
          if (options?.fzf) {
            const fzfInput = orchestraMembers
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
                '--header=演奏者を選択してシェルに入る (Ctrl-C でキャンセル)',
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

            await new Promise<void>(resolve => {
              fzfProcess.on('close', code => {
                if (code !== 0 || !selected.trim()) {
                  console.log(chalk.gray('キャンセルされました'))
                  process.exit(0)
                }

                // ブランチ名を抽出
                branchName = selected
                  .split('|')[0]
                  ?.trim()
                  .replace(/\[.*\]/, '')
                  .trim()
                resolve()
              })
            })
          } else {
            // inquirerで選択
            const { selectedBranch } = await inquirer.prompt([
              {
                type: 'list',
                name: 'selectedBranch',
                message: 'どの演奏者に入りますか？',
                choices: orchestraMembers.map(wt => {
                  const branchName = wt.branch?.replace('refs/heads/', '') || wt.branch
                  return {
                    name: `${chalk.cyan(branchName)} ${chalk.gray(wt.path)}`,
                    value: branchName,
                  }
                }),
              },
            ])
            branchName = selectedBranch
          }
        }

        // 指定されたブランチのworktreeを探す
        const targetWorktree = orchestraMembers.find(wt => {
          const branch = wt.branch?.replace('refs/heads/', '')
          return branch === branchName || wt.branch === branchName
        })

        if (!targetWorktree) {
          // 類似した名前を検索
          const similarBranches = orchestraMembers
            .filter(
              wt => wt.branch && wt.branch.toLowerCase().includes((branchName || '').toLowerCase())
            )
            .map(wt => wt.branch?.replace('refs/heads/', '') || '')
            .filter(Boolean)

          throw ErrorFactory.worktreeNotFound(branchName || '', similarBranches)
        }

        console.log(chalk.green(`\n🎵 演奏者 '${chalk.cyan(branchName)}' に入ります...`))
        console.log(chalk.gray(`📁 ${targetWorktree.path}\n`))

        // --cmd オプションの処理
        if (options.cmd) {
          console.log(chalk.blue(`🔧 コマンド実行: ${options.cmd}`))
          try {
            const result = await execa(options.cmd, [], {
              cwd: targetWorktree.path,
              stdio: 'inherit',
              shell: true,
              env: {
                ...process.env,
                MAESTRO_BRANCH: branchName,
                MAESTRO_PATH: targetWorktree.path,
              },
            })
            console.log(chalk.green(`\n✅ コマンド実行完了 (exit code: ${result.exitCode})`))
          } catch (error) {
            console.error(
              chalk.red(
                `❌ コマンド実行失敗: ${error instanceof Error ? error.message : '不明なエラー'}`
              )
            )
            process.exit(1)
          }
          return
        }

        // --tmux オプションの処理
        if (options.tmux) {
          const sessionName = `maestro-${branchName}`

          try {
            // 既存のtmuxセッションがあるかチェック
            const existingSessions = await execa(
              'tmux',
              ['list-sessions', '-F', '#{session_name}'],
              {
                reject: false,
              }
            )

            const sessionExists = existingSessions.stdout
              .split('\n')
              .some(name => name.trim() === sessionName)

            if (sessionExists) {
              console.log(chalk.blue(`📺 既存のtmuxセッション '${sessionName}' にアタッチします`))
              const tmuxProcess = spawn('tmux', ['attach-session', '-t', sessionName], {
                stdio: 'inherit',
              })

              tmuxProcess.on('exit', code => {
                console.log(chalk.gray(`\ntmuxセッションから戻りました (exit code: ${code})`))
              })
            } else {
              console.log(chalk.blue(`📺 新しいtmuxセッション '${sessionName}' を作成します`))
              const tmuxProcess = spawn('tmux', ['new-session', '-s', sessionName], {
                cwd: targetWorktree.path,
                stdio: 'inherit',
                env: {
                  ...process.env,
                  MAESTRO_BRANCH: branchName,
                  MAESTRO_PATH: targetWorktree.path,
                },
              })

              tmuxProcess.on('exit', code => {
                console.log(chalk.gray(`\ntmuxセッションから戻りました (exit code: ${code})`))
              })
            }
          } catch (error) {
            console.error(
              chalk.red(
                `❌ tmuxセッション処理に失敗: ${error instanceof Error ? error.message : '不明なエラー'}`
              )
            )
            console.log(chalk.yellow('通常のシェルで起動します...'))
            // tmuxが失敗した場合は通常のシェルで起動
            startNormalShell()
          }
          return
        }

        // 通常のシェル起動
        startNormalShell()

        function startNormalShell() {
          if (!targetWorktree) {
            console.error(chalk.red('エラー: targetWorktreeが未定義です'))
            process.exit(1)
          }

          // シェルを自動判定
          const shell = getShell()
          const shellEnv = getShellEnv(shell, branchName!)

          console.log(chalk.blue(`🐚 シェル: ${shell}`))
          const shellProcess = spawn(shell, [], {
            cwd: targetWorktree.path,
            stdio: 'inherit',
            env: {
              ...process.env,
              ...shellEnv,
              MAESTRO_BRANCH: branchName,
              MAESTRO_PATH: targetWorktree.path,
            },
          })

          shellProcess.on('exit', code => {
            console.log(chalk.gray(`\n演奏者から戻りました (exit code: ${code})`))
          })
        }

        function getShell(): string {
          const shell = process.env.SHELL || '/bin/bash'
          return shell
        }

        function getShellEnv(shell: string, branchName: string): Record<string, string> {
          const shellName = shell.split('/').pop() || 'bash'

          switch (shellName) {
            case 'zsh':
              return {
                PS1: `${chalk.magenta('🎵')} [${chalk.cyan(branchName)}] ${chalk.yellow('%~')} $ `,
                PROMPT: `${chalk.magenta('🎵')} [${chalk.cyan(branchName)}] ${chalk.yellow('%~')} $ `,
              }
            case 'fish':
              return {
                fish_prompt: `echo "${chalk.magenta('🎵')} [${chalk.cyan(branchName)}] ${chalk.yellow('(prompt_pwd)')} $ "`,
              }
            case 'bash':
            default:
              return {
                PS1: `${chalk.magenta('🎵')} [${chalk.cyan(branchName)}] ${chalk.yellow('\\W')} $ `,
              }
          }
        }
      } catch (error) {
        handleError(error, 'shell')
      }
    }
  )

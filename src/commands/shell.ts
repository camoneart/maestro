import { Command } from 'commander'
import chalk from 'chalk'
import { GitWorktreeManager } from '../core/git.js'
import { spawn } from 'child_process'
import inquirer from 'inquirer'

export const shellCommand = new Command('shell')
  .alias('sh')
  .description('影分身のシェルに入る')
  .argument('[branch-name]', 'ブランチ名（省略時は選択）')
  .option('--fzf', 'fzfで選択')
  .action(async (branchName?: string, options: { fzf?: boolean } = {}) => {
    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
        process.exit(1)
      }

      const worktrees = await gitManager.listWorktrees()

      // メインブランチを除外
      const shadowClones = worktrees.filter(wt => !wt.path.endsWith('.'))

      if (shadowClones.length === 0) {
        console.log(chalk.yellow('影分身が存在しません'))
        console.log(chalk.gray('scj create <branch-name> で影分身を作り出してください'))
        process.exit(0)
      }

      let targetWorktree

      // ブランチ名が指定されていない場合は選択
      if (!branchName) {
        // fzfオプションが指定されている場合
        if (options?.fzf) {
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
              '--header=影分身を選択してシェルに入る (Ctrl-C でキャンセル)',
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
              message: 'どの影分身に入りますか？',
              choices: shadowClones.map(wt => {
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
      targetWorktree = shadowClones.find(wt => {
        const branch = wt.branch?.replace('refs/heads/', '')
        return branch === branchName || wt.branch === branchName
      })

      if (!targetWorktree) {
        console.error(chalk.red(`エラー: 影分身 '${branchName}' が見つかりません`))

        // 類似した名前を提案
        const similarBranches = shadowClones
          .filter(wt => wt.branch && wt.branch.includes(branchName || ''))
          .map(wt => wt.branch)

        if (similarBranches.length > 0) {
          console.log(chalk.yellow('\n類似した影分身:'))
          similarBranches.forEach(branch => {
            console.log(`  - ${chalk.cyan(branch)}`)
          })
        }

        process.exit(1)
      }

      console.log(chalk.green(`\n🥷 影分身 '${chalk.cyan(branchName)}' に入ります...`))
      console.log(chalk.gray(`📁 ${targetWorktree.path}\n`))

      // シェルを起動
      const shell = process.env.SHELL || '/bin/bash'
      const shellProcess = spawn(shell, [], {
        cwd: targetWorktree.path,
        stdio: 'inherit',
        env: {
          ...process.env,
          SHADOW_CLONE: branchName,
          SHADOW_CLONE_PATH: targetWorktree.path,
          PS1: `🥷 [${branchName}] \\W $ `, // プロンプトをカスタマイズ
        },
      })

      shellProcess.on('exit', code => {
        console.log(chalk.gray(`\n影分身から戻りました (exit code: ${code})`))
      })
    } catch (error) {
      console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
      process.exit(1)
    }
  })

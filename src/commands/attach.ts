import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { GitWorktreeManager } from '../core/git.js'
import { spawn } from 'child_process'
import { execa } from 'execa'

interface AttachOptions {
  shell?: boolean
  exec?: string
}

// シェルに入る処理
async function enterShell(worktreePath: string, branchName: string): Promise<void> {
  console.log(chalk.cyan(`\n🎼 演奏者 '${branchName}' のシェルに入ります...`))
  
  // 環境変数を設定
  const env = {
    ...process.env,
    MAESTRO: '1',
    MAESTRO_NAME: branchName,
    MAESTRO_PATH: worktreePath
  }

  // シェルを起動
  const shell = process.env.SHELL || '/bin/bash'
  const shellProcess = spawn(shell, [], {
    cwd: worktreePath,
    stdio: 'inherit',
    env
  })

  // プロセスの終了を待つ
  return new Promise((resolve) => {
    shellProcess.on('exit', () => {
      console.log(chalk.gray('\n🎼 シェルを終了しました'))
      resolve()
    })
  })
}

// コマンド実行処理
async function executeCommandInWorktree(worktreePath: string, command: string): Promise<void> {
  const spinner = ora(`コマンドを実行中: ${command}`).start()

  try {
    const result = await execa(command, [], {
      cwd: worktreePath,
      shell: true
    })

    spinner.succeed(chalk.green('✨ コマンドが正常に実行されました'))
    
    if (result.stdout) {
      console.log(chalk.gray('\n出力:'))
      console.log(result.stdout)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '不明なエラー'
    spinner.fail(chalk.red(`コマンドの実行に失敗しました: ${errorMessage}`))
    
    if (error && typeof error === 'object' && 'stderr' in error && error.stderr) {
      console.error(chalk.red('\nエラー出力:'))
      console.error(error.stderr)
    }
    
    process.exit(1)
  }
}

export const attachCommand = new Command('attach')
  .description('既存の演奏者（ブランチ）にworktreeを割り当てる')
  .argument('<branch-name>', 'アタッチするブランチ名')
  .option('--shell', 'アタッチ後にシェルに入る')
  .option('--exec <command>', 'アタッチ後にコマンドを実行')
  .action(async (branchName: string, options: AttachOptions) => {
    const spinner = ora('ブランチを確認中...').start()

    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        throw new Error('このディレクトリはGitリポジトリではありません')
      }

      // ブランチの存在確認
      const branches = await gitManager.listLocalBranches()
      const branchExists = branches.includes(branchName) || branches.includes(`refs/heads/${branchName}`)
      
      if (!branchExists) {
        spinner.fail(chalk.red(`ブランチ '${branchName}' が見つかりません`))
        
        // 類似のブランチを提案
        const similarBranches = branches.filter(b => b.includes(branchName))
        if (similarBranches.length > 0) {
          console.log(chalk.yellow('\n類似したブランチ:'))
          similarBranches.forEach(b => {
            console.log(`  - ${chalk.cyan(b.replace('refs/heads/', ''))}`)
          })
        }
        
        process.exit(1)
      }

      // 既存のworktreeがないか確認
      const worktrees = await gitManager.listWorktrees()
      const existingWorktree = worktrees.find(wt => 
        wt.branch === branchName || wt.branch === `refs/heads/${branchName}`
      )

      if (existingWorktree) {
        spinner.fail(chalk.yellow(`ブランチ '${branchName}' は既にworktreeが存在します`))
        console.log(chalk.gray(`場所: ${existingWorktree.path}`))
        process.exit(1)
      }

      spinner.text = 'worktreeを作成中...'

      // worktreeを作成（既存のブランチ用）
      const worktreePath = await gitManager.attachWorktree(branchName)
      
      spinner.succeed(chalk.green(`✨ 演奏者 '${branchName}' をアタッチしました`))
      console.log(chalk.gray(`場所: ${worktreePath}`))

      // シェルに入る処理
      if (options.shell) {
        await enterShell(worktreePath, branchName)
      }

      // コマンド実行処理
      if (options.exec) {
        await executeCommandInWorktree(worktreePath, options.exec)
      }

    } catch (error) {
      spinner.fail(chalk.red('エラーが発生しました'))
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
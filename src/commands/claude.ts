import { Command } from 'commander'
import chalk from 'chalk'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'
import ora from 'ora'
import { Worktree } from '../types/index.js'
import path from 'path'
import fs from 'fs/promises'

interface ClaudeInstance {
  worktree: string
  pid?: number
  status: 'running' | 'stopped'
  startedAt?: Date
}

// Claude Codeインスタンスの状態を管理
class ClaudeManager {
  private instances: Map<string, ClaudeInstance> = new Map()
  private stateFile: string

  constructor() {
    this.stateFile = path.join(process.cwd(), '.maestro', 'claude-instances.json')
  }

  async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8')
      const state = JSON.parse(data)
      this.instances = new Map(Object.entries(state))
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  async saveState(): Promise<void> {
    const dir = path.dirname(this.stateFile)
    await fs.mkdir(dir, { recursive: true })
    const state = Object.fromEntries(this.instances)
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2))
  }

  async isClaudeRunning(worktreePath: string): Promise<boolean> {
    try {
      // Claude Codeのプロセスを検索
      const result = await execa('pgrep', ['-f', `claude.*${worktreePath}`], {
        reject: false,
      })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async startClaude(worktree: Worktree): Promise<void> {
    const branchName = worktree.branch?.replace('refs/heads/', '') || worktree.branch || ''
    
    // すでに起動している場合はスキップ
    if (await this.isClaudeRunning(worktree.path)) {
      console.log(chalk.yellow(`Claude Code は既に ${branchName} で起動しています`))
      return
    }

    const spinner = ora(`${branchName} で Claude Code を起動中...`).start()

    try {
      // Claude Codeを起動
      const claudeProcess = execa('claude', [worktree.path], {
        detached: true,
        stdio: 'ignore',
      })

      // プロセスを親から切り離す
      claudeProcess.unref()

      this.instances.set(branchName, {
        worktree: branchName,
        pid: claudeProcess.pid,
        status: 'running',
        startedAt: new Date(),
      })

      await this.saveState()
      spinner.succeed(`${branchName} で Claude Code を起動しました`)
    } catch (error) {
      spinner.fail(`${branchName} で Claude Code の起動に失敗しました`)
      throw error
    }
  }

  async stopClaude(worktree: Worktree): Promise<void> {
    const branchName = worktree.branch?.replace('refs/heads/', '') || worktree.branch || ''
    const instance = this.instances.get(branchName)

    if (!instance || instance.status !== 'running') {
      console.log(chalk.yellow(`Claude Code は ${branchName} で起動していません`))
      return
    }

    const spinner = ora(`${branchName} の Claude Code を停止中...`).start()

    try {
      // プロセスを終了
      if (instance.pid) {
        await execa('kill', [instance.pid.toString()])
      }

      this.instances.set(branchName, {
        ...instance,
        status: 'stopped',
      })

      await this.saveState()
      spinner.succeed(`${branchName} の Claude Code を停止しました`)
    } catch (error) {
      spinner.fail(`${branchName} の Claude Code の停止に失敗しました`)
      throw error
    }
  }

  async listInstances(worktrees: Worktree[]): Promise<void> {
    console.log(chalk.bold('\n🤖 Claude Code インスタンス:'))
    console.log()

    let hasInstances = false

    for (const worktree of worktrees) {
      const branchName = worktree.branch?.replace('refs/heads/', '') || worktree.branch || ''
      const isRunning = await this.isClaudeRunning(worktree.path)
      
      if (isRunning) {
        hasInstances = true
        const instance = this.instances.get(branchName)
        const startTime = instance?.startedAt
          ? new Date(instance.startedAt).toLocaleString()
          : '不明'
        
        console.log(
          `${chalk.green('●')} ${chalk.cyan(branchName)} - ${chalk.green('実行中')} (開始: ${startTime})`
        )
      }
    }

    if (!hasInstances) {
      console.log(chalk.gray('実行中のインスタンスはありません'))
    }
    console.log()
  }
}

// listサブコマンド
const listCommand = new Command('list')
  .alias('ls')
  .description('実行中のClaude Codeインスタンスを一覧表示')
  .action(async () => {
    try {
      const gitManager = new GitWorktreeManager()
      const claudeManager = new ClaudeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
        process.exit(1)
      }

      await claudeManager.loadState()
      const worktrees = await gitManager.listWorktrees()
      const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

      await claudeManager.listInstances(orchestraMembers)
    } catch (error) {
      console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
      process.exit(1)
    }
  })

// startサブコマンド
const startCommand = new Command('start')
  .description('Claude Codeインスタンスを起動')
  .argument('[branch-name]', 'ブランチ名')
  .option('--all', 'すべての演奏者でClaude Codeを起動')
  .action(async (branchName?: string, options: { all?: boolean } = {}) => {
    try {
      const gitManager = new GitWorktreeManager()
      const claudeManager = new ClaudeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
        process.exit(1)
      }

      await claudeManager.loadState()
      const worktrees = await gitManager.listWorktrees()
      const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

      if (options.all) {
        // すべての演奏者で起動
        console.log(chalk.bold('\n🎼 すべての演奏者でClaude Codeを起動します\n'))
        
        for (const worktree of orchestraMembers) {
          await claudeManager.startClaude(worktree)
        }
      } else {
        // 特定の演奏者で起動
        if (!branchName) {
          console.error(chalk.red('エラー: ブランチ名を指定するか --all オプションを使用してください'))
          process.exit(1)
        }

        const targetWorktree = orchestraMembers.find(wt => {
          const branch = wt.branch?.replace('refs/heads/', '')
          return branch === branchName || wt.branch === branchName
        })

        if (!targetWorktree) {
          console.error(chalk.red(`エラー: 演奏者 '${branchName}' が見つかりません`))
          process.exit(1)
        }

        await claudeManager.startClaude(targetWorktree)
      }
    } catch (error) {
      console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
      process.exit(1)
    }
  })

// stopサブコマンド
const stopCommand = new Command('stop')
  .description('Claude Codeインスタンスを停止')
  .argument('[branch-name]', 'ブランチ名')
  .option('--all', 'すべての演奏者のClaude Codeを停止')
  .action(async (branchName?: string, options: { all?: boolean } = {}) => {
    try {
      const gitManager = new GitWorktreeManager()
      const claudeManager = new ClaudeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
        process.exit(1)
      }

      await claudeManager.loadState()
      const worktrees = await gitManager.listWorktrees()
      const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

      if (options.all) {
        // すべての演奏者で停止
        console.log(chalk.bold('\n🎼 すべての演奏者のClaude Codeを停止します\n'))
        
        for (const worktree of orchestraMembers) {
          await claudeManager.stopClaude(worktree)
        }
      } else {
        // 特定の演奏者で停止
        if (!branchName) {
          console.error(chalk.red('エラー: ブランチ名を指定するか --all オプションを使用してください'))
          process.exit(1)
        }

        const targetWorktree = orchestraMembers.find(wt => {
          const branch = wt.branch?.replace('refs/heads/', '')
          return branch === branchName || wt.branch === branchName
        })

        if (!targetWorktree) {
          console.error(chalk.red(`エラー: 演奏者 '${branchName}' が見つかりません`))
          process.exit(1)
        }

        await claudeManager.stopClaude(targetWorktree)
      }
    } catch (error) {
      console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
      process.exit(1)
    }
  })

// メインコマンド
export const claudeCommand = new Command('claude')
  .description('Claude Codeインスタンスを管理')
  .addCommand(listCommand)
  .addCommand(startCommand)
  .addCommand(stopCommand)
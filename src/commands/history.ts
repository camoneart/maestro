import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { ConfigManager } from '../core/config.js'
import path from 'path'
import fs from 'fs/promises'
import { homedir } from 'os'

interface HistoryOptions {
  list?: boolean
  show?: string
  export?: string
  merge?: boolean
  cleanup?: boolean
  sync?: boolean
}

interface ClaudeHistory {
  branch: string
  worktreePath: string
  historyPath: string
  lastModified?: Date
  size?: number
}

// Claude履歴ディレクトリのパスを取得
function getClaudeHistoryDir(): string {
  return path.join(homedir(), '.claude', 'history')
}

// ブランチ名から履歴ファイルパスを生成
function getHistoryPathForBranch(branchName: string, config: any): string {
  const template = config.claude?.costOptimization?.historyPath || '~/.claude/history/{branch}.md'
  const expandedPath = template
    .replace('~', homedir())
    .replace('{branch}', branchName.replace(/\//g, '-'))
  return expandedPath
}

// 全ての履歴を検索
async function findAllHistories(gitManager: GitWorktreeManager, config: any): Promise<ClaudeHistory[]> {
  const histories: ClaudeHistory[] = []
  const worktrees = await gitManager.listWorktrees()
  
  for (const worktree of worktrees) {
    if (!worktree.branch) continue
    
    const historyPath = getHistoryPathForBranch(worktree.branch, config)
    
    try {
      const stats = await fs.stat(historyPath)
      histories.push({
        branch: worktree.branch,
        worktreePath: worktree.path,
        historyPath,
        lastModified: stats.mtime,
        size: stats.size
      })
    } catch {
      // 履歴ファイルが存在しない場合はスキップ
    }
  }
  
  // グローバル履歴ディレクトリも検索
  const historyDir = getClaudeHistoryDir()
  try {
    const files = await fs.readdir(historyDir)
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      
      const filePath = path.join(historyDir, file)
      const branchName = file.replace('.md', '').replace(/-/g, '/')
      
      // 既に見つかっているものはスキップ
      if (histories.some(h => h.historyPath === filePath)) continue
      
      try {
        const stats = await fs.stat(filePath)
        histories.push({
          branch: branchName,
          worktreePath: '', // worktreeが削除されている可能性
          historyPath: filePath,
          lastModified: stats.mtime,
          size: stats.size
        })
      } catch {
        // ファイルが読めない場合はスキップ
      }
    }
  } catch {
    // 履歴ディレクトリが存在しない場合
  }
  
  return histories
}

// 履歴を表示
async function listHistories(histories: ClaudeHistory[]): Promise<void> {
  if (histories.length === 0) {
    console.log(chalk.yellow('Claude Code履歴が見つかりません'))
    return
  }
  
  console.log(chalk.bold('\n📚 Claude Code履歴一覧:\n'))
  
  // 最終更新日でソート
  histories.sort((a, b) => {
    if (!a.lastModified || !b.lastModified) return 0
    return b.lastModified.getTime() - a.lastModified.getTime()
  })
  
  histories.forEach((history, index) => {
    const sizeKB = history.size ? (history.size / 1024).toFixed(1) : '0'
    const modifiedStr = history.lastModified ? history.lastModified.toLocaleString() : 'Unknown'
    const worktreeInfo = history.worktreePath ? chalk.green(' ✓') : chalk.gray(' (削除済み)')
    
    console.log(`${index + 1}. ${chalk.cyan(history.branch)}${worktreeInfo}`)
    console.log(chalk.gray(`   最終更新: ${modifiedStr} | サイズ: ${sizeKB} KB`))
    console.log(chalk.gray(`   パス: ${history.historyPath}`))
    console.log()
  })
}

// 履歴を表示
async function showHistory(historyPath: string): Promise<void> {
  try {
    const content = await fs.readFile(historyPath, 'utf-8')
    console.log(content)
  } catch (error) {
    throw new Error(`履歴の読み込みに失敗しました: ${error}`)
  }
}

// 履歴をエクスポート
async function exportHistories(histories: ClaudeHistory[], outputPath: string): Promise<void> {
  const spinner = ora('履歴をエクスポート中...').start()
  
  try {
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalHistories: histories.length,
      histories: [] as any[]
    }
    
    for (const history of histories) {
      try {
        const content = await fs.readFile(history.historyPath, 'utf-8')
        exportData.histories.push({
          branch: history.branch,
          worktreePath: history.worktreePath,
          lastModified: history.lastModified,
          content
        })
      } catch {
        // 読めない履歴はスキップ
      }
    }
    
    // 出力形式を判定
    if (outputPath.endsWith('.json')) {
      await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2))
    } else {
      // Markdown形式でエクスポート
      let markdown = `# Claude Code履歴エクスポート\n\n`
      markdown += `エクスポート日時: ${exportData.exportedAt}\n\n`
      
      for (const history of exportData.histories) {
        markdown += `## ${history.branch}\n\n`
        markdown += `最終更新: ${history.lastModified}\n\n`
        markdown += `### 内容:\n\n`
        markdown += history.content
        markdown += `\n\n---\n\n`
      }
      
      await fs.writeFile(outputPath, markdown)
    }
    
    spinner.succeed(`履歴を ${outputPath} にエクスポートしました`)
  } catch (error) {
    spinner.fail('エクスポートに失敗しました')
    throw error
  }
}

// 履歴をマージ
async function mergeHistories(histories: ClaudeHistory[], outputPath: string): Promise<void> {
  const spinner = ora('履歴をマージ中...').start()
  
  try {
    let mergedContent = `# Claude Code統合履歴\n\n`
    mergedContent += `マージ日時: ${new Date().toLocaleString()}\n\n`
    
    // 時系列でソート
    histories.sort((a, b) => {
      if (!a.lastModified || !b.lastModified) return 0
      return a.lastModified.getTime() - b.lastModified.getTime()
    })
    
    for (const history of histories) {
      try {
        const content = await fs.readFile(history.historyPath, 'utf-8')
        mergedContent += `## ${history.branch} (${history.lastModified?.toLocaleString()})\n\n`
        mergedContent += content
        mergedContent += `\n\n---\n\n`
      } catch {
        // 読めない履歴はスキップ
      }
    }
    
    await fs.writeFile(outputPath, mergedContent)
    spinner.succeed(`履歴を ${outputPath} にマージしました`)
  } catch (error) {
    spinner.fail('マージに失敗しました')
    throw error
  }
}

// 古い履歴をクリーンアップ
async function cleanupHistories(histories: ClaudeHistory[]): Promise<void> {
  // worktreeが削除されている履歴を検出
  const orphanedHistories = histories.filter(h => !h.worktreePath)
  
  if (orphanedHistories.length === 0) {
    console.log(chalk.green('✨ クリーンアップする履歴はありません'))
    return
  }
  
  console.log(chalk.bold('\n🗑️  以下の履歴は対応するworktreeが削除されています:\n'))
  orphanedHistories.forEach(h => {
    console.log(chalk.gray(`- ${h.branch} (${h.historyPath})`))
  })
  
  const { confirmDelete } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmDelete',
      message: `${orphanedHistories.length}個の履歴を削除しますか？`,
      default: false
    }
  ])
  
  if (confirmDelete) {
    const spinner = ora('履歴を削除中...').start()
    let deletedCount = 0
    
    for (const history of orphanedHistories) {
      try {
        await fs.unlink(history.historyPath)
        deletedCount++
      } catch {
        // 削除に失敗してもスキップ
      }
    }
    
    spinner.succeed(`${deletedCount}個の履歴を削除しました`)
  }
}

// 履歴を同期（worktreeパスに移動）
async function syncHistories(histories: ClaudeHistory[], config: any): Promise<void> {
  const spinner = ora('履歴を同期中...').start()
  let syncedCount = 0
  
  for (const history of histories) {
    if (!history.worktreePath) continue
    
    // 理想的なパスを計算
    const idealPath = getHistoryPathForBranch(history.branch, config)
    
    if (history.historyPath !== idealPath) {
      try {
        // ディレクトリを作成
        await fs.mkdir(path.dirname(idealPath), { recursive: true })
        // ファイルを移動
        await fs.rename(history.historyPath, idealPath)
        syncedCount++
      } catch {
        // 同期に失敗してもスキップ
      }
    }
  }
  
  spinner.succeed(`${syncedCount}個の履歴を同期しました`)
}

export const historyCommand = new Command('history')
  .alias('h')
  .description('Claude Code会話履歴を管理')
  .option('-l, --list', '全ての履歴を一覧表示')
  .option('-s, --show <branch>', '特定のブランチの履歴を表示')
  .option('-e, --export <path>', '履歴をエクスポート（.json/.md）')
  .option('-m, --merge <path>', '全履歴を1ファイルにマージ')
  .option('-c, --cleanup', '不要な履歴をクリーンアップ')
  .option('--sync', '履歴を正しいパスに同期')
  .action(async (options: HistoryOptions) => {
    try {
      const gitManager = new GitWorktreeManager()
      const configManager = new ConfigManager()
      await configManager.loadProjectConfig()
      const config = configManager.getAll()
      
      // 全履歴を検索
      const histories = await findAllHistories(gitManager, config)
      
      if (options.list || (!options.show && !options.export && !options.merge && !options.cleanup && !options.sync)) {
        // デフォルトは一覧表示
        await listHistories(histories)
      }
      
      if (options.show) {
        // ブランチ名で履歴を検索
        const history = histories.find(h => h.branch === options.show)
        if (history) {
          await showHistory(history.historyPath)
        } else {
          console.error(chalk.red(`ブランチ '${options.show}' の履歴が見つかりません`))
          process.exit(1)
        }
      }
      
      if (options.export) {
        await exportHistories(histories, options.export)
      }
      
      if (options.merge) {
        await mergeHistories(histories, 'merged-history.md')
      }
      
      if (options.cleanup) {
        await cleanupHistories(histories)
      }
      
      if (options.sync) {
        await syncHistories(histories, config)
      }
      
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
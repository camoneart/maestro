import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'
import fs from 'fs/promises'

interface HealthOptions {
  fix?: boolean
  prune?: boolean
  days?: number
  verbose?: boolean
}

interface HealthIssue {
  worktree: any
  type: 'stale' | 'orphaned' | 'diverged' | 'uncommitted' | 'conflict' | 'missing'
  severity: 'critical' | 'warning' | 'info'
  message: string
  fixable: boolean
}

// worktreeの健全性をチェック
async function checkWorktreeHealth(worktree: any, mainBranch: string, daysThreshold: number): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = []
  const branch = worktree.branch?.replace('refs/heads/', '') || worktree.branch
  
  try {
    // 1. ディレクトリが存在するか
    try {
      await fs.access(worktree.path)
    } catch {
      issues.push({
        worktree,
        type: 'missing',
        severity: 'critical',
        message: 'Worktreeディレクトリが存在しません',
        fixable: true
      })
      return issues // これ以上のチェックは不可能
    }
    
    // 2. 未コミットの変更をチェック
    const { stdout: status } = await execa('git', ['status', '--porcelain'], {
      cwd: worktree.path
    })
    
    if (status.trim()) {
      const lines = status.trim().split('\n').length
      issues.push({
        worktree,
        type: 'uncommitted',
        severity: 'warning',
        message: `${lines}個の未コミット変更があります`,
        fixable: false
      })
    }
    
    // 3. mainブランチとの乖離をチェック
    try {
      const { stdout: behind } = await execa('git', [
        'rev-list',
        '--count',
        `${branch}..${mainBranch}`
      ], { cwd: worktree.path })
      
      const behindCount = parseInt(behind.trim())
      
      if (behindCount > 20) {
        issues.push({
          worktree,
          type: 'diverged',
          severity: 'warning',
          message: `${mainBranch}から${behindCount}コミット遅れています`,
          fixable: true
        })
      }
    } catch {
      // ブランチ比較エラーは無視
    }
    
    // 4. 最終更新日をチェック
    try {
      const { stdout: lastCommitDate } = await execa('git', [
        'log',
        '-1',
        '--format=%ci',
        branch
      ], { cwd: worktree.path })
      
      const lastDate = new Date(lastCommitDate.trim())
      const daysSinceLastCommit = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysSinceLastCommit > daysThreshold) {
        issues.push({
          worktree,
          type: 'stale',
          severity: 'info',
          message: `${daysSinceLastCommit}日間更新されていません`,
          fixable: true
        })
      }
    } catch {
      // ログ取得エラーは無視
    }
    
    // 5. マージ競合の検出
    try {
      const { stdout: mergeStatus } = await execa('git', [
        'ls-files',
        '--unmerged'
      ], { cwd: worktree.path })
      
      if (mergeStatus.trim()) {
        issues.push({
          worktree,
          type: 'conflict',
          severity: 'critical',
          message: 'マージ競合が解決されていません',
          fixable: false
        })
      }
    } catch {
      // エラーは無視
    }
    
    // 6. リモートブランチの存在確認
    try {
      await execa('git', ['rev-parse', `origin/${branch}`], { cwd: worktree.path })
    } catch {
      issues.push({
        worktree,
        type: 'orphaned',
        severity: 'info',
        message: 'リモートブランチが存在しません',
        fixable: false
      })
    }
    
  } catch (error) {
    // 一般的なエラー
    issues.push({
      worktree,
      type: 'orphaned',
      severity: 'warning',
      message: `チェック中にエラーが発生: ${error}`,
      fixable: false
    })
  }
  
  return issues
}

// 問題を修正
async function fixIssue(issue: HealthIssue, mainBranch: string): Promise<boolean> {
  
  try {
    switch (issue.type) {
      case 'missing':
        // worktreeを削除
        await execa('git', ['worktree', 'remove', issue.worktree.path, '--force'])
        return true
        
      case 'diverged':
        // mainブランチをマージ
        await execa('git', ['merge', mainBranch, '--no-edit'], {
          cwd: issue.worktree.path
        })
        return true
        
      case 'stale':
        // 古いworktreeについては削除を提案するのみ
        return false
        
      default:
        return false
    }
  } catch {
    return false
  }
}

// 健全性レポートを表示
function displayHealthReport(allIssues: HealthIssue[], verbose: boolean): void {
  const criticalCount = allIssues.filter(i => i.severity === 'critical').length
  const warningCount = allIssues.filter(i => i.severity === 'warning').length
  const infoCount = allIssues.filter(i => i.severity === 'info').length
  
  console.log(chalk.bold('\n🏥 Worktree健全性チェック結果\n'))
  
  if (allIssues.length === 0) {
    console.log(chalk.green('✨ すべてのworktreeは健全です！'))
    return
  }
  
  // サマリー
  console.log(chalk.bold('📊 サマリー:'))
  if (criticalCount > 0) console.log(chalk.red(`  🚨 重大: ${criticalCount}個`))
  if (warningCount > 0) console.log(chalk.yellow(`  ⚠️  警告: ${warningCount}個`))
  if (infoCount > 0) console.log(chalk.blue(`  ℹ️  情報: ${infoCount}個`))
  console.log()
  
  // 詳細表示
  const groupedIssues = new Map<string, HealthIssue[]>()
  
  allIssues.forEach(issue => {
    const branch = issue.worktree.branch?.replace('refs/heads/', '') || issue.worktree.branch || 'unknown'
    if (!groupedIssues.has(branch)) {
      groupedIssues.set(branch, [])
    }
    groupedIssues.get(branch)?.push(issue)
  })
  
  groupedIssues.forEach((issues, branch) => {
    console.log(chalk.cyan(`📁 ${branch}`))
    console.log(chalk.gray(`   ${issues[0]?.worktree.path || 'unknown'}`)) 
    
    issues.forEach(issue => {
      const icon = issue.severity === 'critical' ? '🚨' : 
                   issue.severity === 'warning' ? '⚠️ ' : 'ℹ️ '
      const color = issue.severity === 'critical' ? chalk.red :
                    issue.severity === 'warning' ? chalk.yellow : chalk.blue
      
      console.log(`   ${icon} ${color(issue.message)}`)
      if (issue.fixable && verbose) {
        console.log(chalk.gray(`      💊 修正可能`))
      }
    })
    console.log()
  })
}

export const healthCommand = new Command('health')
  .alias('check')
  .description('worktreeの健全性をチェック')
  .option('-f, --fix', '修正可能な問題を自動修正')
  .option('-p, --prune', '古いworktreeを削除')
  .option('-d, --days <number>', '古いと判定する日数', '30')
  .option('-v, --verbose', '詳細情報を表示')
  .action(async (options: HealthOptions) => {
    const spinner = ora('worktreeの健全性をチェック中...').start()
    
    try {
      const gitManager = new GitWorktreeManager()
      
      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }
      
      // メインブランチを特定
      let mainBranch = 'main'
      try {
        const { stdout } = await execa('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'])
        mainBranch = stdout.replace('refs/remotes/origin/', '')
      } catch {
        // フォールバック
        try {
          await execa('git', ['rev-parse', 'origin/master'])
          mainBranch = 'master'
        } catch {
          // デフォルトのmainを使用
        }
      }
      
      // worktreeを取得
      const worktrees = await gitManager.listWorktrees()
      const shadowClones = worktrees.filter(wt => !wt.path.endsWith('.'))
      
      if (shadowClones.length === 0) {
        spinner.succeed('影分身が存在しません')
        process.exit(0)
      }
      
      spinner.text = '各worktreeの状態を分析中...'
      
      // 各worktreeの健全性をチェック
      const allIssues: HealthIssue[] = []
      const daysThreshold = parseInt(options.days?.toString() || '30')
      
      for (const worktree of shadowClones) {
        const issues = await checkWorktreeHealth(worktree, mainBranch, daysThreshold)
        allIssues.push(...issues)
      }
      
      spinner.stop()
      
      // レポートを表示
      displayHealthReport(allIssues, options.verbose || false)
      
      // 修正オプション
      if (options.fix && allIssues.some(i => i.fixable)) {
        const fixableIssues = allIssues.filter(i => i.fixable)
        
        console.log(chalk.bold(`\n🔧 ${fixableIssues.length}個の修正可能な問題があります\n`))
        
        const { confirmFix } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmFix',
            message: '自動修正を実行しますか？',
            default: false
          }
        ])
        
        if (confirmFix) {
          const fixSpinner = ora('問題を修正中...').start()
          let fixedCount = 0
          
          for (const issue of fixableIssues) {
            if (await fixIssue(issue, mainBranch)) {
              fixedCount++
            }
          }
          
          fixSpinner.succeed(`${fixedCount}個の問題を修正しました`)
        }
      }
      
      // 古いworktreeの削除
      if (options.prune) {
        const staleWorktrees = allIssues
          .filter(i => i.type === 'stale')
          .map(i => i.worktree)
          .filter((wt, index, self) => 
            self.findIndex(w => w.path === wt.path) === index
          )
        
        if (staleWorktrees.length > 0) {
          console.log(chalk.bold(`\n🗑️  ${staleWorktrees.length}個の古いworktreeがあります\n`))
          
          staleWorktrees.forEach(wt => {
            const branch = wt.branch?.replace('refs/heads/', '') || wt.branch
            console.log(chalk.gray(`  - ${branch} (${wt.path})`))
          })
          
          const { confirmPrune } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmPrune',
              message: 'これらを削除しますか？',
              default: false
            }
          ])
          
          if (confirmPrune) {
            const pruneSpinner = ora('古いworktreeを削除中...').start()
            let prunedCount = 0
            
            for (const worktree of staleWorktrees) {
              try {
                await gitManager.deleteWorktree(worktree.branch, true)
                prunedCount++
              } catch {
                // エラーは無視
              }
            }
            
            pruneSpinner.succeed(`${prunedCount}個のworktreeを削除しました`)
          }
        }
      }
      
      // 推奨事項
      if (allIssues.length > 0 && !options.fix && !options.prune) {
        console.log(chalk.bold('\n💡 推奨事項:\n'))
        
        if (allIssues.some(i => i.fixable)) {
          console.log(chalk.gray('  • --fix オプションで修正可能な問題を自動修正できます'))
        }
        
        if (allIssues.some(i => i.type === 'stale')) {
          console.log(chalk.gray('  • --prune オプションで古いworktreeを削除できます'))
        }
        
        if (allIssues.some(i => i.type === 'uncommitted')) {
          console.log(chalk.gray('  • 未コミットの変更がある場合は手動でコミットまたは破棄してください'))
        }
      }
      
    } catch (error) {
      spinner.fail('健全性チェックに失敗しました')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
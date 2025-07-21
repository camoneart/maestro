import { Command } from 'commander'
import chalk from 'chalk'
import { GitWorktreeManager } from '../core/git.js'
import { Worktree } from '../types/index.js'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

// 拡張Worktree型定義
interface EnhancedWorktree extends Worktree {
  lastCommit?: { date: string; message: string; hash: string } | null
  metadata?: WorktreeMetadata | null
  size?: number
}

// worktreeメタデータ型定義
interface WorktreeMetadata {
  createdAt: string
  branch: string
  worktreePath: string
  github?: {
    type: 'issue' | 'pr'
    title: string
    body: string
    author: string
    labels: string[]
    assignees: string[]
    milestone?: string
    url: string
    issueNumber?: string
  }
  template?: string
}

// パスを短縮表示する関数（リポジトリルートからの相対パス）
async function formatPath(fullPath: string, gitManager: GitWorktreeManager): Promise<string> {
  try {
    // Gitリポジトリのルートディレクトリを取得
    const repoRoot = await gitManager.getRepositoryRoot()

    // リポジトリルートからの相対パスを計算
    const relativePath = path.relative(repoRoot, fullPath)

    // 現在のディレクトリと同じ場合
    if (relativePath === '' || relativePath === '.') {
      return '.'
    }

    return relativePath
  } catch {
    // リポジトリルート取得に失敗した場合はディレクトリ名のみ
    return path.basename(fullPath)
  }
}

export const listCommand = new Command('list')
  .alias('ls')
  .description('オーケストラ編成（worktree）の一覧を表示')
  .option('-j, --json', 'JSON形式で出力')
  .option('--fzf', 'fzfで選択し、選択したブランチ名を出力')
  .option('--names', 'ブランチ名のみを出力（スクリプト用）')
  .option('--filter <keyword>', 'ブランチ名またはパスでフィルタ')
  .option('--sort <field>', 'ソート順 (branch|age|size)', 'branch')
  .option('--last-commit', '最終コミット情報を表示')
  .option('--metadata', 'メタデータ情報を表示')
  .option('--full-path', '完全パスを表示')
  .action(
    async (
      options: {
        json?: boolean
        fzf?: boolean
        names?: boolean
        filter?: string
        sort?: string
        lastCommit?: boolean
        metadata?: boolean
        fullPath?: boolean
      } = {}
    ) => {
      try {
        const gitManager = new GitWorktreeManager()

        // Gitリポジトリかチェック
        const isGitRepo = await gitManager.isGitRepository()
        if (!isGitRepo) {
          console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
          process.exit(1)
        }

        let worktrees = await gitManager.listWorktrees()

        // フィルタ処理
        if (options.filter) {
          const keyword = options.filter.toLowerCase()
          worktrees = worktrees.filter(
            wt =>
              wt.branch?.toLowerCase().includes(keyword) || wt.path.toLowerCase().includes(keyword)
          )
        }

        // 最終コミット情報を取得
        if (options.lastCommit || options.json || options.sort === 'age') {
          for (const worktree of worktrees) {
            try {
              const lastCommit = await gitManager.getLastCommit(worktree.path)
              ;(worktree as EnhancedWorktree).lastCommit = lastCommit
            } catch {
              ;(worktree as EnhancedWorktree).lastCommit = null
            }
          }
        }

        // メタデータ情報を取得
        if (options.metadata || options.json) {
          for (const worktree of worktrees) {
            try {
              const metadataPath = path.join(worktree.path, '.maestro-metadata.json')
              const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8')
              ;(worktree as EnhancedWorktree).metadata = JSON.parse(metadataContent)
            } catch {
              ;(worktree as EnhancedWorktree).metadata = null
            }
          }
        }

        // ソート処理
        if (options.sort) {
          await sortWorktrees(worktrees, options.sort)
        }

        if (options?.json) {
          // JSON出力時に追加フィールドを含める
          const jsonWorktrees = worktrees.map(wt => ({
            ...wt,
            isCurrent: wt.isCurrentDirectory || wt.path === process.cwd(),
            locked: wt.locked || false,
            lastCommit: (wt as EnhancedWorktree).lastCommit || null,
            metadata: (wt as EnhancedWorktree).metadata || null,
          }))
          console.log(JSON.stringify(jsonWorktrees, null, 2))
          return
        }

        if (worktrees.length === 0) {
          console.log(chalk.yellow('演奏者が存在しません'))
          return
        }

        // --namesオプションが指定された場合（スクリプト用）
        if (options?.names) {
          // メインブランチを除外した演奏者のブランチ名のみを出力
          const orchestraMembers = worktrees.filter((wt: Worktree) => !wt.path.endsWith('.'))

          for (const wt of orchestraMembers) {
            const branchName = wt.branch?.replace('refs/heads/', '') || wt.branch || ''
            if (branchName) {
              console.log(branchName)
            }
          }
          return
        }

        // fzfで選択
        if (options?.fzf) {
          const fzfEntries = await Promise.all(
            worktrees.map(async w => {
              const status = []
              if (w.isCurrentDirectory) status.push(chalk.green('現在'))
              if (w.locked) status.push(chalk.red('ロック'))
              if (w.prunable) status.push(chalk.yellow('削除可能'))

              const statusStr = status.length > 0 ? ` [${status.join(', ')}]` : ''
              const displayPath = options.fullPath ? w.path : await formatPath(w.path, gitManager)
              return `${w.branch}${statusStr} | ${displayPath}`
            })
          )
          const fzfInput = fzfEntries.join('\n')

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

          fzfProcess.on('close', code => {
            if (code !== 0 || !selected.trim()) {
              // キャンセルされた場合は何も出力しない
              return
            }

            // ブランチ名を抽出して出力
            const selectedBranch = selected
              .split('|')[0]
              ?.trim()
              .replace(/\[.*\]/, '')
              .trim()
            if (selectedBranch) {
              console.log(selectedBranch.replace('refs/heads/', ''))
            }
          })
          return
        }

        console.log(chalk.bold('\n🎼 オーケストラ編成:\n'))

        // メインワークツリーを先頭に表示
        const mainWorktree = worktrees.find(
          wt => wt.branch === 'refs/heads/main' || wt.isCurrentDirectory
        )
        const memberWorktrees = worktrees.filter(wt => wt !== mainWorktree)

        if (mainWorktree) {
          await displayWorktree(
            mainWorktree,
            true,
            gitManager,
            options.lastCommit,
            options.metadata,
            options.fullPath
          )
        }

        for (const wt of memberWorktrees) {
          await displayWorktree(
            wt,
            false,
            gitManager,
            options.lastCommit,
            options.metadata,
            options.fullPath
          )
        }

        console.log(chalk.gray(`\n合計: ${worktrees.length} 名の演奏者`))
      } catch (error) {
        console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
        process.exit(1)
      }
    }
  )

async function sortWorktrees(worktrees: Worktree[], sortBy: string): Promise<void> {
  switch (sortBy) {
    case 'branch':
      worktrees.sort((a, b) => (a.branch || '').localeCompare(b.branch || ''))
      break
    case 'age':
      // lastCommit が設定されている場合は日付でソート
      worktrees.sort((a, b) => {
        const aCommit = (a as EnhancedWorktree).lastCommit
        const bCommit = (b as EnhancedWorktree).lastCommit
        if (!aCommit && !bCommit) return 0
        if (!aCommit) return 1
        if (!bCommit) return -1
        return new Date(bCommit.date).getTime() - new Date(aCommit.date).getTime()
      })
      break
    case 'size':
      // ディレクトリサイズでソート
      for (const worktree of worktrees) {
        try {
          const stats = fs.statSync(worktree.path)
          ;(worktree as EnhancedWorktree).size = stats.size
        } catch {
          ;(worktree as EnhancedWorktree).size = 0
        }
      }
      worktrees.sort(
        (a, b) => ((b as EnhancedWorktree).size || 0) - ((a as EnhancedWorktree).size || 0)
      )
      break
  }
}

async function displayWorktree(
  worktree: Worktree,
  isMain: boolean,
  gitManager: GitWorktreeManager,
  showLastCommit?: boolean,
  showMetadata?: boolean,
  showFullPath?: boolean
) {
  const prefix = isMain ? '📍' : '🎼'
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

  // メタデータからGitHubバッジを追加
  const metadata = (worktree as EnhancedWorktree).metadata
  if (metadata?.github) {
    if (metadata.github.type === 'pr') {
      status.push(chalk.blue(`PR #${metadata.github.issueNumber}`))
    } else {
      status.push(chalk.green(`Issue #${metadata.github.issueNumber}`))
    }
  }
  if (metadata?.template) {
    status.push(chalk.magenta(`[${metadata.template}]`))
  }

  // パス表示の決定
  const displayPath = showFullPath ? worktree.path : await formatPath(worktree.path, gitManager)

  let output =
    `${prefix} ${chalk.cyan(branchName.padEnd(30))} ` +
    `${chalk.gray(displayPath)} ` +
    `${status.join(' ')}`

  if (showLastCommit && (worktree as EnhancedWorktree).lastCommit) {
    const lastCommit = (worktree as EnhancedWorktree).lastCommit!
    output += `\n    ${chalk.gray('最終コミット:')} ${chalk.yellow(lastCommit.date)} ${chalk.gray(lastCommit.message)}`
  }

  if (showMetadata && metadata) {
    if (metadata.github) {
      output += `\n    ${chalk.gray('GitHub:')} ${metadata.github.title}`
      if (metadata.github.labels.length > 0) {
        output += `\n    ${chalk.gray('ラベル:')} ${metadata.github.labels.join(', ')}`
      }
      if (metadata.github.assignees.length > 0) {
        output += `\n    ${chalk.gray('担当者:')} ${metadata.github.assignees.join(', ')}`
      }
    }
    if (metadata.createdAt) {
      output += `\n    ${chalk.gray('作成日時:')} ${new Date(metadata.createdAt).toLocaleString()}`
    }
  }

  console.log(output)
}

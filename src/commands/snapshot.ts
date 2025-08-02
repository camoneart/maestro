import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'

interface SnapshotOptions {
  message?: string
  stash?: boolean
  all?: boolean
  json?: boolean
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

interface WorktreeSnapshot {
  id: string
  branch: string
  worktreePath: string
  createdAt: string
  message: string
  gitStatus: {
    branch: string
    tracking: string
    ahead: number
    behind: number
    staged: string[]
    modified: string[]
    untracked: string[]
  }
  stash?: {
    hash: string
    message: string
  }
  lastCommit: {
    hash: string
    message: string
    author: string
    date: string
  }
  metadata?: WorktreeMetadata
}

// スナップショットIDを生成
function generateSnapshotId(): string {
  const timestamp = Date.now().toString()
  const random = Math.random().toString(36).substring(2, 8)
  return `snapshot-${timestamp}-${random}`
}

// Git状態を取得
async function getGitStatus(worktreePath: string): Promise<WorktreeSnapshot['gitStatus']> {
  const status: WorktreeSnapshot['gitStatus'] = {
    branch: '',
    tracking: '',
    ahead: 0,
    behind: 0,
    staged: [],
    modified: [],
    untracked: [],
  }

  try {
    // ブランチ情報を取得
    const { stdout: branchInfo } = await execa('git', ['branch', '-vv', '--no-color'], {
      cwd: worktreePath,
    })
    const currentBranch = branchInfo.split('\n').find(line => line.startsWith('*'))
    if (currentBranch) {
      const match = currentBranch.match(/\* (\S+)\s+\S+\s+(?:\[([^\]]+)\])?\s+(.+)/)
      if (match) {
        status.branch = match[1] || 'unknown'
        if (match[2]) {
          const trackingMatch = match[2].match(
            /([^:]+)(?::\s*ahead\s+(\d+))?(?:,?\s*behind\s+(\d+))?/
          )
          if (trackingMatch) {
            status.tracking = trackingMatch[1] || ''
            status.ahead = parseInt(trackingMatch[2] || '0')
            status.behind = parseInt(trackingMatch[3] || '0')
          }
        }
      }
    }

    // ステージング済みファイル
    const { stdout: staged } = await execa('git', ['diff', '--cached', '--name-only'], {
      cwd: worktreePath,
    })
    if (staged) status.staged = staged.split('\n').filter(Boolean)

    // 変更されたファイル
    const { stdout: modified } = await execa('git', ['diff', '--name-only'], { cwd: worktreePath })
    if (modified) status.modified = modified.split('\n').filter(Boolean)

    // 未追跡ファイル
    const { stdout: untracked } = await execa(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: worktreePath }
    )
    if (untracked) status.untracked = untracked.split('\n').filter(Boolean)
  } catch {
    console.error(chalk.yellow('Git状態の取得に失敗しました'))
  }

  return status
}

// 最終コミット情報を取得
async function getLastCommitInfo(worktreePath: string): Promise<WorktreeSnapshot['lastCommit']> {
  try {
    const { stdout } = await execa('git', ['log', '-1', '--pretty=format:%H|%s|%an|%ai'], {
      cwd: worktreePath,
    })

    const [hash, message, author, date] = stdout.split('|')
    return { hash: hash || '', message: message || '', author: author || '', date: date || '' }
  } catch {
    return {
      hash: '',
      message: 'コミットなし',
      author: '',
      date: '',
    }
  }
}

// スナップショットを作成
import { Worktree } from '../types/index.js'

async function createSnapshot(
  worktree: Worktree,
  message: string,
  includeStash: boolean
): Promise<WorktreeSnapshot> {
  const snapshotId = generateSnapshotId()
  const gitStatus = await getGitStatus(worktree.path)
  const lastCommit = await getLastCommitInfo(worktree.path)

  const snapshot: WorktreeSnapshot = {
    id: snapshotId,
    branch: worktree.branch?.replace('refs/heads/', '') || worktree.branch,
    worktreePath: worktree.path,
    createdAt: new Date().toISOString(),
    message,
    gitStatus,
    lastCommit,
  }

  // スタッシュを作成
  if (includeStash && (gitStatus.staged.length > 0 || gitStatus.modified.length > 0)) {
    try {
      const stashMessage = `Orchestra Snapshot: ${snapshotId}`
      await execa('git', ['stash', 'push', '-m', stashMessage, '--include-untracked'], {
        cwd: worktree.path,
      })

      // スタッシュのハッシュを取得
      const { stdout: stashList } = await execa('git', ['stash', 'list', '-1', '--format=%H %s'], {
        cwd: worktree.path,
      })
      if (stashList) {
        const [hash, ...messageParts] = stashList.split(' ')
        snapshot.stash = {
          hash: hash || '',
          message: messageParts.join(' '),
        }
      }
    } catch {
      console.warn(chalk.yellow('スタッシュの作成に失敗しました'))
    }
  }

  // メタデータを読み込み
  try {
    const metadataPath = path.join(worktree.path, '.maestro-metadata.json')
    const metadataContent = await fs.readFile(metadataPath, 'utf-8')
    snapshot.metadata = JSON.parse(metadataContent)
  } catch {
    // メタデータがない場合は無視
  }

  return snapshot
}

// スナップショットを保存
async function saveSnapshot(snapshot: WorktreeSnapshot): Promise<void> {
  const snapshotDir = path.join(process.cwd(), '.maestro', 'snapshots')
  await fs.mkdir(snapshotDir, { recursive: true })

  const snapshotPath = path.join(snapshotDir, `${snapshot.id}.json`)
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2))
}

// スナップショット一覧を取得
async function listSnapshots(): Promise<WorktreeSnapshot[]> {
  const snapshotDir = path.join(process.cwd(), '.maestro', 'snapshots')

  try {
    const files = await fs.readdir(snapshotDir)
    const snapshots: WorktreeSnapshot[] = []

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(snapshotDir, file), 'utf-8')
        snapshots.push(JSON.parse(content))
      }
    }

    // 作成日時で降順ソート
    return snapshots.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  } catch {
    return []
  }
}

// スナップショットを復元
async function restoreSnapshot(snapshot: WorktreeSnapshot): Promise<void> {
  const spinner = ora('スナップショットを復元中...').start()

  try {
    // worktreeが存在するか確認
    try {
      await fs.access(snapshot.worktreePath)
    } catch {
      spinner.fail(`worktree '${snapshot.worktreePath}' が存在しません`)
      return
    }

    // 現在の状態を確認
    const currentStatus = await getGitStatus(snapshot.worktreePath)
    if (
      currentStatus.staged.length > 0 ||
      currentStatus.modified.length > 0 ||
      currentStatus.untracked.length > 0
    ) {
      spinner.stop()

      const { confirmRestore } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmRestore',
          message: '現在の変更が失われる可能性があります。続行しますか？',
          default: false,
        },
      ])

      if (!confirmRestore) {
        console.log(chalk.gray('復元をキャンセルしました'))
        return
      }

      spinner.start('スナップショットを復元中...')
    }

    // ブランチを切り替え
    if (currentStatus.branch !== snapshot.gitStatus.branch) {
      await execa('git', ['checkout', snapshot.gitStatus.branch], { cwd: snapshot.worktreePath })
    }

    // スタッシュを適用
    if (snapshot.stash) {
      try {
        // スタッシュリストから該当のスタッシュを探す
        const { stdout: stashList } = await execa('git', ['stash', 'list'], {
          cwd: snapshot.worktreePath,
        })
        const stashLines = stashList.split('\n')
        const stashIndex = stashLines.findIndex(line => line.includes(snapshot.id))

        if (stashIndex >= 0) {
          await execa('git', ['stash', 'apply', `stash@{${stashIndex}}`], {
            cwd: snapshot.worktreePath,
          })
          spinner.succeed('スタッシュを適用しました')
        } else {
          spinner.warn('保存されたスタッシュが見つかりませんでした')
        }
      } catch {
        spinner.warn('スタッシュの適用に失敗しました')
      }
    }

    spinner.succeed(`スナップショット '${snapshot.id}' を復元しました`)

    // 復元後の状態を表示
    console.log(chalk.bold('\n📸 復元されたスナップショット:\n'))
    console.log(chalk.gray(`ID: ${snapshot.id}`))
    console.log(chalk.gray(`ブランチ: ${snapshot.branch}`))
    console.log(chalk.gray(`作成日時: ${new Date(snapshot.createdAt).toLocaleString()}`))
    console.log(chalk.gray(`メッセージ: ${snapshot.message}`))

    if (snapshot.gitStatus.staged.length > 0) {
      console.log(chalk.green(`\nステージング済み: ${snapshot.gitStatus.staged.length}ファイル`))
    }
    if (snapshot.gitStatus.modified.length > 0) {
      console.log(chalk.yellow(`変更あり: ${snapshot.gitStatus.modified.length}ファイル`))
    }
    if (snapshot.gitStatus.untracked.length > 0) {
      console.log(chalk.blue(`未追跡: ${snapshot.gitStatus.untracked.length}ファイル`))
    }
  } catch (error) {
    spinner.fail('スナップショットの復元に失敗しました')
    console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
  }
}

export const snapshotCommand = new Command('snapshot')
  .alias('snap')
  .description('worktreeの作業状態を保存・復元')
  .option('-m, --message <message>', 'スナップショットのメッセージ')
  .option('-s, --stash', '変更をスタッシュに保存')
  .option('-a, --all', '全てのworktreeのスナップショットを作成')
  .option('-l, --list', 'スナップショット一覧を表示')
  .option('-r, --restore <id>', 'スナップショットを復元')
  .option('-d, --delete <id>', 'スナップショットを削除')
  .option('-j, --json', 'JSON形式で出力')
  .exitOverride()
  .action(
    async (options: SnapshotOptions & { list?: boolean; restore?: string; delete?: string }) => {
      try {
        const gitManager = new GitWorktreeManager()

        // Gitリポジトリかチェック
        const isGitRepo = await gitManager.isGitRepository()
        if (!isGitRepo) {
          console.error(chalk.red('このディレクトリはGitリポジトリではありません'))
          process.exit(1)
        }

        // スナップショット一覧を表示
        if (options.list) {
          const snapshots = await listSnapshots()

          if (options.json) {
            // JSON形式で出力
            const jsonOutput = snapshots.map(snapshot => ({
              id: snapshot.id,
              branch: snapshot.branch,
              worktreePath: snapshot.worktreePath,
              createdAt: snapshot.createdAt,
              message: snapshot.message,
              gitStatus: {
                branch: snapshot.gitStatus.branch,
                tracking: snapshot.gitStatus.tracking,
                ahead: snapshot.gitStatus.ahead,
                behind: snapshot.gitStatus.behind,
                staged: snapshot.gitStatus.staged.length,
                modified: snapshot.gitStatus.modified.length,
                untracked: snapshot.gitStatus.untracked.length,
              },
              hasStash: !!snapshot.stash,
              lastCommit: snapshot.lastCommit,
              metadata: snapshot.metadata || null,
            }))
            console.log(JSON.stringify(jsonOutput, null, 2))
            return
          }

          if (snapshots.length === 0) {
            console.log(chalk.yellow('スナップショットが存在しません'))
            return
          }

          console.log(chalk.bold('\n📸 スナップショット一覧:\n'))

          snapshots.forEach(snapshot => {
            console.log(chalk.cyan(`${snapshot.id}`))
            console.log(chalk.gray(`  ブランチ: ${snapshot.branch}`))
            console.log(chalk.gray(`  作成日時: ${new Date(snapshot.createdAt).toLocaleString()}`))
            console.log(chalk.gray(`  メッセージ: ${snapshot.message}`))
            console.log(chalk.gray(`  パス: ${snapshot.worktreePath}`))

            const changes = []
            if (snapshot.gitStatus.staged.length > 0)
              changes.push(`${snapshot.gitStatus.staged.length} staged`)
            if (snapshot.gitStatus.modified.length > 0)
              changes.push(`${snapshot.gitStatus.modified.length} modified`)
            if (snapshot.gitStatus.untracked.length > 0)
              changes.push(`${snapshot.gitStatus.untracked.length} untracked`)

            if (changes.length > 0) {
              console.log(chalk.gray(`  変更: ${changes.join(', ')}`))
            }

            if (snapshot.stash) {
              console.log(chalk.gray(`  スタッシュ: あり`))
            }

            console.log()
          })

          return
        }

        // スナップショットを復元
        if (options.restore) {
          const snapshots = await listSnapshots()
          const snapshot = snapshots.find(
            s => s.id === options.restore || s.id.startsWith(options.restore!)
          )

          if (!snapshot) {
            console.error(chalk.red(`スナップショット '${options.restore}' が見つかりません`))
            process.exit(1)
          }

          await restoreSnapshot(snapshot)
          return
        }

        // スナップショットを削除
        if (options.delete) {
          const snapshotPath = path.join(
            process.cwd(),
            '.maestro',
            'snapshots',
            `${options.delete}.json`
          )

          try {
            await fs.unlink(snapshotPath)
            console.log(chalk.green(`✨ スナップショット '${options.delete}' を削除しました`))
          } catch {
            // 短縮IDでの削除を試みる
            const snapshots = await listSnapshots()
            const snapshot = snapshots.find(s => s.id.startsWith(options.delete!))

            if (snapshot) {
              const fullPath = path.join(
                process.cwd(),
                '.maestro',
                'snapshots',
                `${snapshot.id}.json`
              )
              await fs.unlink(fullPath)
              console.log(chalk.green(`✨ スナップショット '${snapshot.id}' を削除しました`))
            } else {
              console.error(chalk.red(`スナップショット '${options.delete}' が見つかりません`))
              process.exit(1)
            }
          }

          return
        }

        // スナップショットを作成
        const message = options.message || `Snapshot at ${new Date().toLocaleString()}`

        if (options.all) {
          // 全worktreeのスナップショットを作成
          const spinner = ora('全worktreeのスナップショットを作成中...').start()

          const worktrees = await gitManager.listWorktrees()
          const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

          if (orchestraMembers.length === 0) {
            spinner.fail('演奏者が存在しません')
            return
          }

          const snapshots: WorktreeSnapshot[] = []

          for (const worktree of orchestraMembers) {
            try {
              const snapshot = await createSnapshot(worktree, message, options.stash || false)
              await saveSnapshot(snapshot)
              snapshots.push(snapshot)
            } catch {
              console.warn(chalk.yellow(`${worktree.branch} のスナップショット作成に失敗しました`))
            }
          }

          spinner.succeed(`${snapshots.length}件のスナップショットを作成しました`)

          snapshots.forEach(snapshot => {
            console.log(chalk.gray(`  - ${snapshot.branch}: ${snapshot.id}`))
          })
        } else {
          // 現在のworktreeのスナップショットを作成
          const currentPath = process.cwd()
          const worktrees = await gitManager.listWorktrees()
          const currentWorktree = worktrees.find(wt => wt.path === currentPath)

          if (!currentWorktree) {
            console.error(chalk.red('現在のディレクトリはworktreeではありません'))
            process.exit(1)
          }

          const spinner = ora('スナップショットを作成中...').start()

          const snapshot = await createSnapshot(currentWorktree, message, options.stash || false)
          await saveSnapshot(snapshot)

          spinner.succeed('スナップショットを作成しました')

          console.log(chalk.bold('\n📸 作成されたスナップショット:\n'))
          console.log(chalk.gray(`ID: ${snapshot.id}`))
          console.log(chalk.gray(`ブランチ: ${snapshot.branch}`))
          console.log(chalk.gray(`メッセージ: ${snapshot.message}`))

          if (snapshot.stash) {
            console.log(chalk.green('\n✅ 変更をスタッシュに保存しました'))
          }
        }
      } catch (error) {
        console.error(chalk.red('エラー:'), error instanceof Error ? error.message : '不明なエラー')
        process.exit(1)
      }
    }
  )

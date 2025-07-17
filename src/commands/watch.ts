import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { ConfigManager } from '../core/config.js'
import chokidar from 'chokidar'
import path from 'path'
import fs from 'fs/promises'
import { createHash } from 'crypto'
import { processManager } from '../utils/process.js'

interface WatchOptions {
  patterns?: string[]
  exclude?: string[]
  all?: boolean
  dry?: boolean
  auto?: boolean
}

interface FileChange {
  path: string
  type: 'add' | 'change' | 'unlink'
  hash?: string
  content?: string
}

// ファイルのハッシュを計算
async function getFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath)
    return createHash('md5').update(content).digest('hex')
  } catch {
    return ''
  }
}

// 除外パターンに一致するかチェック
function isExcluded(filePath: string, excludePatterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')

  return excludePatterns.some(pattern => {
    // グロブパターンの簡易マッチング
    const regex = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.')

    return new RegExp(regex).test(normalizedPath)
  })
}

// ファイル変更を他のworktreeに同期
import { Worktree } from '../types/index.js'

async function syncFileChange(
  change: FileChange,
  sourceWorktree: string,
  targetWorktrees: Worktree[],
  dryRun: boolean
): Promise<void> {
  const relativePath = path.relative(sourceWorktree, change.path)

  for (const worktree of targetWorktrees) {
    if (worktree.path === sourceWorktree) continue

    const targetPath = path.join(worktree.path, relativePath)

    try {
      switch (change.type) {
        case 'add':
        case 'change':
          if (dryRun) {
            console.log(chalk.gray(`  [DRY] ${worktree.branch}: ${relativePath} を同期`))
          } else {
            // ディレクトリを作成
            await fs.mkdir(path.dirname(targetPath), { recursive: true })

            // ファイルをコピー
            if (
              change.path &&
              (await fs
                .access(change.path)
                .then(() => true)
                .catch(() => false))
            ) {
              await fs.copyFile(change.path, targetPath)
              console.log(chalk.green(`  ✓ ${worktree.branch}: ${relativePath}`))
            }
          }
          break

        case 'unlink':
          if (dryRun) {
            console.log(chalk.gray(`  [DRY] ${worktree.branch}: ${relativePath} を削除`))
          } else {
            try {
              await fs.unlink(targetPath)
              console.log(chalk.red(`  ✗ ${worktree.branch}: ${relativePath}`))
            } catch {
              // ファイルが存在しない場合は無視
            }
          }
          break
      }
    } catch (error) {
      console.error(chalk.red(`  ✗ ${worktree.branch}: エラー - ${error}`))
    }
  }
}

export const watchCommand = new Command('watch')
  .description('ファイル変更を監視して他のworktreeに自動同期')
  .option('-p, --patterns <patterns...>', '監視するファイルパターン')
  .option('-e, --exclude <patterns...>', '除外するパターン')
  .option('-a, --all', '全てのworktreeに同期')
  .option('-d, --dry', 'ドライラン（実際の同期は行わない）')
  .option('--auto', '確認なしで自動同期')
  .action(async (options: WatchOptions) => {
    const spinner = ora('worktreeを確認中...').start()

    try {
      const gitManager = new GitWorktreeManager()
      const configManager = new ConfigManager()
      await configManager.loadProjectConfig()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      // worktreeを取得
      const worktrees = await gitManager.listWorktrees()
      const currentPath = process.cwd()
      const currentWorktree = worktrees.find(wt => wt.path === currentPath)

      if (!currentWorktree) {
        spinner.fail('現在のディレクトリはworktreeではありません')
        process.exit(1)
      }

      spinner.stop()

      // 同期先を選択
      let targetWorktrees: Worktree[] = []

      if (options.all) {
        targetWorktrees = worktrees.filter(wt => wt.path !== currentPath)
      } else {
        const otherWorktrees = worktrees.filter(wt => wt.path !== currentPath)

        if (otherWorktrees.length === 0) {
          console.log(chalk.yellow('他のworktreeが存在しません'))
          process.exit(0)
        }

        const { selected } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selected',
            message: '同期先のworktreeを選択:',
            choices: otherWorktrees.map(wt => ({
              name: `${chalk.cyan(wt.branch)} ${chalk.gray(wt.path)}`,
              value: wt,
              checked: true,
            })),
          },
        ])

        targetWorktrees = selected
      }

      if (targetWorktrees.length === 0) {
        console.log(chalk.yellow('同期先が選択されていません'))
        process.exit(0)
      }

      // 監視設定
      const patterns = options.patterns || ['**/*.ts', '**/*.js', '**/*.json', '**/*.md']
      const excludePatterns = options.exclude || [
        'node_modules/**',
        '.git/**',
        '.maestro-metadata.json', // メタデータファイルは同期対象外
        'dist/**',
        'build/**',
        '.next/**',
        'coverage/**',
      ]

      console.log(chalk.bold('\n🔍 ファイル監視設定:\n'))
      console.log(chalk.gray(`監視パターン: ${patterns.join(', ')}`))
      console.log(chalk.gray(`除外パターン: ${excludePatterns.join(', ')}`))
      console.log(chalk.gray(`同期先: ${targetWorktrees.map(wt => wt.branch).join(', ')}`))
      console.log(
        chalk.gray(
          `モード: ${options.dry ? 'ドライラン' : options.auto ? '自動同期' : '確認付き同期'}`
        )
      )

      console.log(chalk.cyan('\n👀 ファイル変更を監視中... (Ctrl+C で終了)\n'))

      // ファイル監視を開始
      const watcher = chokidar.watch(patterns, {
        cwd: currentPath,
        ignored: excludePatterns,
        persistent: true,
        ignoreInitial: true,
      })

      // 変更バッファ（バッチ処理用）
      const changeBuffer: Map<string, FileChange> = new Map()
      let syncTimeout: ReturnType<typeof setTimeout> | null = null

      // バッチ同期処理
      const processBatchSync = async () => {
        if (changeBuffer.size === 0) return

        const changes = Array.from(changeBuffer.values())
        changeBuffer.clear()

        console.log(chalk.bold(`\n🔄 ${changes.length}個の変更を検出:\n`))

        changes.forEach(change => {
          const type = change.type === 'add' ? '追加' : change.type === 'change' ? '変更' : '削除'
          const icon = change.type === 'unlink' ? '🗑️ ' : '📝'
          console.log(`${icon} ${chalk.yellow(type)}: ${path.relative(currentPath, change.path)}`)
        })

        if (!options.auto && !options.dry) {
          const { proceed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: 'これらの変更を同期しますか？',
              default: true,
            },
          ])

          if (!proceed) {
            console.log(chalk.gray('同期をスキップしました'))
            return
          }
        }

        console.log(chalk.cyan('\n同期中...\n'))

        for (const change of changes) {
          await syncFileChange(change, currentPath, targetWorktrees, options.dry || false)
        }

        console.log(chalk.green('\n✨ 同期完了\n'))
      }

      // ファイル変更イベント
      watcher
        .on('add', async filePath => {
          const fullPath = path.join(currentPath, filePath)
          if (!isExcluded(filePath, excludePatterns)) {
            changeBuffer.set(fullPath, {
              path: fullPath,
              type: 'add',
              hash: await getFileHash(fullPath),
            })

            // バッチ処理のタイマーをリセット
            if (syncTimeout) clearTimeout(syncTimeout)
            syncTimeout = setTimeout(processBatchSync, 1000)
          }
        })
        .on('change', async filePath => {
          const fullPath = path.join(currentPath, filePath)
          if (!isExcluded(filePath, excludePatterns)) {
            changeBuffer.set(fullPath, {
              path: fullPath,
              type: 'change',
              hash: await getFileHash(fullPath),
            })

            if (syncTimeout) clearTimeout(syncTimeout)
            syncTimeout = setTimeout(processBatchSync, 1000)
          }
        })
        .on('unlink', filePath => {
          const fullPath = path.join(currentPath, filePath)
          if (!isExcluded(filePath, excludePatterns)) {
            changeBuffer.set(fullPath, {
              path: fullPath,
              type: 'unlink',
            })

            if (syncTimeout) clearTimeout(syncTimeout)
            syncTimeout = setTimeout(processBatchSync, 1000)
          }
        })
        .on('error', error => {
          console.error(chalk.red(`監視エラー: ${error}`))
        })

      // watcherのクリーンアップを登録
      processManager.addCleanupHandler(async () => {
        console.log(chalk.yellow('\n監視を終了しています...'))
        await watcher.close()
        if (syncTimeout) {
          clearTimeout(syncTimeout)
        }
      })
    } catch (error) {
      spinner.fail('エラーが発生しました')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })

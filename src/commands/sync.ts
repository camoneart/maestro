import { Command } from 'commander'
import chalk from 'chalk'
import ora, { type Ora } from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { ConfigManager } from '../core/config.js'
import { execa } from 'execa'
import { spawn } from 'child_process'
import cliProgress from 'cli-progress'
import fs from 'fs/promises'
import path from 'path'
import pLimit from 'p-limit'
import { Worktree } from '../types/index.js'

interface SyncOptions {
  all?: boolean
  main?: string
  fzf?: boolean
  rebase?: boolean
  dryRun?: boolean
  push?: boolean
  files?: boolean
  interactive?: boolean
  preset?: string
  concurrency?: number
  filter?: string
  pattern?: string
}

interface SyncResult {
  branch: string
  status: 'success' | 'failed' | 'skipped' | 'up-to-date'
  method?: 'merge' | 'rebase'
  reason?: string
  error?: string
  pushed?: boolean
}

// メインブランチを特定
async function detectMainBranch(
  _gitManager: GitWorktreeManager,
  specified?: string
): Promise<string> {
  if (specified) return specified

  try {
    // デフォルトブランチを取得
    const { stdout } = await execa('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'])
    return stdout.replace('refs/remotes/origin/', '')
  } catch {
    // フォールバック
    try {
      const { stdout } = await execa('git', ['branch', '--list', '--format=%(refname:short)'])
      const branchList = stdout.split('\n').filter(Boolean)
      if (!branchList.includes('main') && branchList.includes('master')) {
        return 'master'
      }
    } catch {
      // エラーが発生した場合はデフォルトのmainを使用
    }
    return 'main'
  }
}

// fzfで演奏者を選択
async function selectWithFzf(orchestraMembers: Worktree[]): Promise<Worktree[]> {
  const fzfInput = orchestraMembers
    .map(w => {
      const branch = w.branch?.replace('refs/heads/', '') || w.branch
      return `${branch} | ${w.path}`
    })
    .join('\n')

  const fzfProcess = spawn(
    'fzf',
    [
      '--ansi',
      '--multi',
      '--header=同期する演奏者を選択 (Tab で複数選択, Ctrl-C でキャンセル)',
      '--preview',
      'echo {} | cut -d"|" -f2 | xargs ls -la',
      '--preview-window=right:50%:wrap',
    ],
    {
      stdio: ['pipe', 'pipe', 'inherit'],
    }
  )

  fzfProcess.stdin.write(fzfInput)
  fzfProcess.stdin.end()

  let selected = ''
  fzfProcess.stdout.on('data', data => {
    selected += data.toString()
  })

  return new Promise<Worktree[]>(resolve => {
    fzfProcess.on('close', code => {
      if (code !== 0 || !selected.trim()) {
        console.log(chalk.gray('キャンセルされました'))
        process.exit(0)
      }

      const selectedBranches = selected
        .trim()
        .split('\n')
        .map(line => line.split('|')[0]?.trim())
        .filter(Boolean)

      const targetWorktrees = orchestraMembers.filter(wt => {
        const branch = wt.branch?.replace('refs/heads/', '')
        return selectedBranches.includes(branch)
      })

      resolve(targetWorktrees)
    })
  })
}

// worktreeをフィルタリング
function filterWorktrees(orchestraMembers: Worktree[], options: SyncOptions): Worktree[] {
  let filteredWorktrees = orchestraMembers

  // --filter オプション（キーワードフィルタ）
  if (options.filter) {
    const keyword = options.filter.toLowerCase()
    filteredWorktrees = filteredWorktrees.filter(wt => {
      const branch =
        wt.branch?.replace('refs/heads/', '')?.toLowerCase() || wt.branch?.toLowerCase()
      const path = wt.path.toLowerCase()
      return branch?.includes(keyword) || path.includes(keyword)
    })
  }

  // --pattern オプション（ワイルドカードパターン）
  if (options.pattern) {
    const pattern = options.pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 特殊文字をエスケープ
      .replace(/\*/g, '.*') // * を .* に置換
    const regex = new RegExp(`^(refs/heads/)?${pattern}$`)

    filteredWorktrees = filteredWorktrees.filter(wt => {
      const branch = wt.branch || ''
      return regex.test(branch) || regex.test(branch.replace('refs/heads/', ''))
    })
  }

  return filteredWorktrees
}

// 同期対象を選択
async function selectTargetWorktrees(
  orchestraMembers: Worktree[],
  branchName?: string,
  options: SyncOptions = {}
): Promise<Worktree[]> {
  // まずフィルタリングを適用
  const filteredWorktrees = filterWorktrees(orchestraMembers, options)

  if (filteredWorktrees.length === 0) {
    throw new Error('フィルター条件に一致する演奏者が見つかりません')
  }

  if (options.all) {
    return filteredWorktrees
  }

  if (options.fzf && !branchName) {
    return selectWithFzf(filteredWorktrees)
  }

  if (branchName) {
    const target = filteredWorktrees.find(wt => {
      const branch = wt.branch?.replace('refs/heads/', '')
      return branch === branchName || wt.branch === branchName
    })

    if (!target) {
      throw new Error(`演奏者 '${branchName}' が見つかりません`)
    }

    return [target]
  }

  // インタラクティブ選択
  const { selectedBranches } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedBranches',
      message: '同期する演奏者を選択してください:',
      choices: filteredWorktrees.map(wt => {
        const branchName = wt.branch?.replace('refs/heads/', '') || wt.branch
        return {
          name: `${chalk.cyan(branchName)} ${chalk.gray(wt.path)}`,
          value: wt,
        }
      }),
    },
  ])

  if (selectedBranches.length === 0) {
    console.log(chalk.gray('キャンセルされました'))
    process.exit(0)
  }

  return selectedBranches
}

// Dry-run処理
async function performDryRun(
  targetWorktrees: Worktree[],
  mainBranch: string,
  options: SyncOptions
): Promise<void> {
  console.log('\n' + chalk.bold('🔍 実行内容プレビュー:'))
  console.log(chalk.gray(`メインブランチ: ${mainBranch}`))
  console.log(chalk.gray(`同期方法: ${options.rebase ? 'rebase' : 'merge'}`))
  console.log(chalk.gray(`同期後のpush: ${options.push ? 'あり' : 'なし'}`))
  console.log('\n' + chalk.bold('同期予定の演奏者:'))

  for (const worktree of targetWorktrees) {
    const branchName = worktree.branch?.replace('refs/heads/', '') || worktree.branch

    try {
      const { stdout: status } = await execa('git', ['status', '--porcelain'], {
        cwd: worktree.path,
      })

      const { stdout: behind } = await execa(
        'git',
        ['rev-list', '--count', `${branchName}..${mainBranch}`],
        {
          cwd: worktree.path,
        }
      )

      const behindCount = parseInt(behind.trim())

      if (status.trim()) {
        console.log(
          `⏭️  ${chalk.cyan(branchName)} - ${chalk.yellow('スキップ')} (未コミットの変更)`
        )
      } else if (behindCount === 0) {
        console.log(`✅ ${chalk.cyan(branchName)} - ${chalk.green('up-to-date')} (スキップ)`)
      } else {
        console.log(
          `🔄 ${chalk.cyan(branchName)} - ${chalk.blue(`${behindCount}コミット遅れ`)} (${options.rebase ? 'rebase' : 'merge'})`
        )
      }
    } catch (error) {
      console.log(
        `❌ ${chalk.cyan(branchName)} - ${chalk.red('エラー')} (${error instanceof Error ? error.message : '不明なエラー'})`
      )
    }
  }

  console.log('\n' + chalk.gray('実際に同期を実行するには --dry-run を外して再実行してください'))
}

// 単一のWorktreeを同期
async function syncSingleWorktree(
  worktree: Worktree,
  mainBranch: string,
  options: SyncOptions
): Promise<SyncResult> {
  const branchName = worktree.branch?.replace('refs/heads/', '') || worktree.branch || ''

  try {
    // 現在のブランチの状態を保存
    const { stdout: status } = await execa('git', ['status', '--porcelain'], {
      cwd: worktree.path,
    })

    if (status.trim()) {
      return { branch: branchName, status: 'skipped', reason: '未コミットの変更' }
    }

    // up-to-dateチェック
    const { stdout: behind } = await execa(
      'git',
      ['rev-list', '--count', `${branchName}..${mainBranch}`],
      {
        cwd: worktree.path,
      }
    )

    const behindCount = parseInt(behind.trim())

    if (behindCount === 0) {
      return { branch: branchName, status: 'up-to-date', reason: '既に最新' }
    }

    // 同期実行
    if (options.rebase) {
      await execa('git', ['rebase', mainBranch], { cwd: worktree.path })

      // pushオプション
      if (options.push) {
        await execa('git', ['push', '--force-with-lease'], { cwd: worktree.path })
      }

      return {
        branch: branchName,
        status: 'success',
        method: 'rebase',
        pushed: options.push,
      }
    } else {
      await execa('git', ['merge', mainBranch, '--no-edit'], { cwd: worktree.path })

      // pushオプション
      if (options.push) {
        await execa('git', ['push'], { cwd: worktree.path })
      }

      return {
        branch: branchName,
        status: 'success',
        method: 'merge',
        pushed: options.push,
      }
    }
  } catch (error) {
    return {
      branch: branchName,
      status: 'failed',
      error: error instanceof Error ? error.message : '不明なエラー',
    }
  }
}

// 結果サマリーを表示
function displaySyncResults(results: SyncResult[]): void {
  console.log('\n' + chalk.bold('🎼 同期結果:\n'))

  const successCount = results.filter(r => r.status === 'success').length
  const failedCount = results.filter(r => r.status === 'failed').length
  const skippedCount = results.filter(r => r.status === 'skipped').length
  const upToDateCount = results.filter(r => r.status === 'up-to-date').length

  results.forEach(result => {
    const icon =
      result.status === 'success'
        ? '✅'
        : result.status === 'failed'
          ? '❌'
          : result.status === 'up-to-date'
            ? '🔄'
            : '⏭️'
    const statusText =
      result.status === 'success'
        ? chalk.green(`成功 (${result.method}${result.pushed ? ' + push' : ''})`)
        : result.status === 'failed'
          ? chalk.red('失敗')
          : result.status === 'up-to-date'
            ? chalk.blue('up-to-date')
            : chalk.yellow('スキップ')

    console.log(`${icon} ${chalk.cyan(result.branch)} - ${statusText}`)
    if (result.reason) {
      console.log(`   ${chalk.gray(result.reason)}`)
    }
    if (result.error) {
      console.log(`   ${chalk.red(result.error)}`)
    }
  })

  console.log(
    chalk.gray(
      `\n合計: ${successCount} 成功, ${failedCount} 失敗, ${skippedCount} スキップ, ${upToDateCount} up-to-date`
    )
  )

  if (failedCount > 0) {
    console.log(chalk.yellow('\n💡 ヒント: 競合が発生した場合は、各演奏者で手動で解決してください'))
  }
}

export const syncCommand = new Command('sync')
  .alias('s')
  .description('メインブランチの変更を演奏者に同期')
  .argument('[branch-name]', '同期する演奏者のブランチ名')
  .option('-a, --all', '全ての演奏者に同期')
  .option('-m, --main <branch>', 'メインブランチを指定 (デフォルト: main または master)')
  .option('--fzf', 'fzfで同期する演奏者を選択')
  .option('--rebase', 'マージの代わりにrebaseを使用')
  .option('--dry-run', '実行内容のみ表示（実際の同期は行わない）')
  .option('--push', 'merge/rebase後にgit pushを実施')
  .option('--filter <keyword>', 'ブランチ名またはパスでworktreeをフィルタ')
  .option(
    '--pattern <pattern>',
    'ワイルドカードパターンでworktreeをフィルタ (例: feature/*, bug-fix-*)'
  )
  .option('-f, --files', '環境変数・設定ファイルを同期')
  .option('-i, --interactive', 'インタラクティブモードで同期するファイルを選択')
  .option('-p, --preset <name>', '同期プリセットを使用（env, config, all）')
  .option('-c, --concurrency <number>', '並列実行数 (デフォルト: 5)', parseInt)
  .action(async (branchName?: string, options: SyncOptions = {}) => {
    await executeSyncCommand(branchName, options)
  })

// 同期コマンドのメイン処理
async function executeSyncCommand(branchName?: string, options: SyncOptions = {}): Promise<void> {
  const spinner = ora('演奏者を確認中...').start()

  try {
    // 初期化
    const { worktrees, orchestraMembers, mainBranch } = await initializeSync(spinner, options)

    // 同期対象を選択
    spinner.stop()
    const targetWorktrees = await selectTargetWorktrees(orchestraMembers, branchName, options)
    spinner.start()

    // メインブランチを更新
    await updateMainBranch(spinner, worktrees, mainBranch)

    // Dry-run処理
    if (options.dryRun) {
      await performDryRun(targetWorktrees, mainBranch, options)
      return
    }

    // 同期実行
    const results = await performSync(targetWorktrees, mainBranch, options)

    // 結果表示
    displaySyncResults(results)

    if (options.push && results.some(r => r.status === 'success')) {
      console.log(chalk.cyan('\n🚀 リモートリポジトリにプッシュしました'))
    }

    // 環境変数・設定ファイルの同期
    if (options.files || options.interactive || options.preset) {
      await syncEnvironmentFiles(worktrees, targetWorktrees, options)
    }
  } catch (error) {
    spinner.fail('同期に失敗しました')
    console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
    process.exit(1)
  }
}

// 初期化処理
async function initializeSync(
  spinner: Ora,
  options: SyncOptions
): Promise<{
  worktrees: Worktree[]
  orchestraMembers: Worktree[]
  mainBranch: string
}> {
  const gitManager = new GitWorktreeManager()

  // Gitリポジトリかチェック
  const isGitRepo = await gitManager.isGitRepository()
  if (!isGitRepo) {
    spinner.fail('このディレクトリはGitリポジトリではありません')
    process.exit(1)
  }

  // メインブランチを特定
  const mainBranch = await detectMainBranch(gitManager, options.main)

  spinner.text = 'ワークツリーを取得中...'
  const worktrees = await gitManager.listWorktrees()
  const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

  if (orchestraMembers.length === 0) {
    spinner.fail('演奏者が存在しません')
    process.exit(0)
  }

  return { worktrees, orchestraMembers, mainBranch }
}

// メインブランチの更新
async function updateMainBranch(
  spinner: Ora,
  worktrees: Worktree[],
  mainBranch: string
): Promise<void> {
  spinner.text = `${mainBranch} ブランチを最新に更新中...`

  const mainWorktree = worktrees.find(wt => wt.path.endsWith('.'))
  if (mainWorktree) {
    await execa('git', ['fetch', 'origin', mainBranch], { cwd: mainWorktree.path })
    await execa('git', ['checkout', mainBranch], { cwd: mainWorktree.path })
    await execa('git', ['pull', 'origin', mainBranch], { cwd: mainWorktree.path })
  }

  spinner.succeed(`${mainBranch} ブランチを最新に更新しました`)
}

// 同期の実行
async function performSync(
  targetWorktrees: Worktree[],
  mainBranch: string,
  options: SyncOptions
): Promise<SyncResult[]> {
  const progressBar = new cliProgress.SingleBar({
    format: '同期進捗 |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} | {branch}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  })

  const results: SyncResult[] = []
  progressBar.start(targetWorktrees.length, 0)

  // 並列実行制限を設定
  const concurrency = options.concurrency || 5
  const limit = pLimit(concurrency)

  const syncPromises = targetWorktrees.map((worktree, index) =>
    limit(async () => {
      const result = await syncSingleWorktree(worktree, mainBranch, options)
      progressBar.update(index + 1, { branch: result.branch })
      return result
    })
  )

  const syncResults = await Promise.allSettled(syncPromises)

  syncResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push(result.value)
    } else {
      const branchName =
        targetWorktrees[index]?.branch?.replace('refs/heads/', '') ||
        targetWorktrees[index]?.branch ||
        'unknown'
      results.push({
        branch: branchName,
        status: 'failed',
        error: result.reason instanceof Error ? result.reason.message : '不明なエラー',
      })
    }
  })

  progressBar.stop()
  return results
}

// プリセット定義
const FILE_SYNC_PRESETS = {
  env: ['.env', '.env.local', '.env.development', '.env.production'],
  config: ['config.json', 'settings.json', '.vscode/settings.json', 'tsconfig.json'],
  all: [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    'config.json',
    'settings.json',
    '.vscode/settings.json',
    'tsconfig.json',
    'package.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'package-lock.json',
  ],
}

// 同期するファイルを決定
async function determineFilesToSync(
  options: SyncOptions,
  config: { development?: { syncFiles?: string[] } },
  allWorktrees: Worktree[]
): Promise<string[]> {
  let filesToSync: string[] = config.development?.syncFiles || ['.env', '.env.local']

  if (options.preset && FILE_SYNC_PRESETS[options.preset as keyof typeof FILE_SYNC_PRESETS]) {
    filesToSync = FILE_SYNC_PRESETS[options.preset as keyof typeof FILE_SYNC_PRESETS]
  }

  // メインワークツリーのパス
  const mainWorktree = allWorktrees.find(wt => wt.path.endsWith('.'))
  if (!mainWorktree) {
    console.error(chalk.red('メインワークツリーが見つかりません'))
    return []
  }

  // インタラクティブモード
  if (options.interactive) {
    const availableFiles = await findAvailableFiles(mainWorktree.path, filesToSync)

    if (availableFiles.length === 0) {
      console.log(chalk.yellow('同期可能なファイルが見つかりません'))
      return []
    }

    const { selectedFiles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedFiles',
        message: '同期するファイルを選択:',
        choices: availableFiles.map(file => ({
          name: file,
          value: file,
          checked: filesToSync.includes(file),
        })),
      },
    ])

    filesToSync = selectedFiles
  }

  return filesToSync
}

// 利用可能なファイルを検索
async function findAvailableFiles(
  mainWorktreePath: string,
  defaultFiles: string[]
): Promise<string[]> {
  const availableFiles: string[] = []
  const potentialFiles = [
    ...new Set([
      ...defaultFiles,
      ...FILE_SYNC_PRESETS.all,
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
      '.env.test',
      'config.json',
      'settings.json',
      '.vscode/settings.json',
      'tsconfig.json',
      'jsconfig.json',
      '.prettierrc',
      '.eslintrc.json',
      'CLAUDE.md',
    ]),
  ]

  for (const file of potentialFiles) {
    try {
      await fs.access(path.join(mainWorktreePath, file))
      availableFiles.push(file)
    } catch {
      // ファイルが存在しない
    }
  }

  return availableFiles
}

// ファイル同期の実行
async function performFileSync(
  targetWorktrees: Worktree[],
  filesToSync: string[],
  mainWorktreePath: string
): Promise<{ syncedCount: number; failedCount: number }> {
  const syncSpinner = ora('ファイルを同期中...').start()
  let syncedCount = 0
  let failedCount = 0

  for (const worktree of targetWorktrees) {
    for (const file of filesToSync) {
      try {
        const sourcePath = path.join(mainWorktreePath, file)
        const destPath = path.join(worktree.path, file)

        // ソースファイルが存在するか確認
        await fs.access(sourcePath)

        // ディレクトリを作成
        await fs.mkdir(path.dirname(destPath), { recursive: true })

        // ファイルをコピー
        await fs.copyFile(sourcePath, destPath)
        syncedCount++
      } catch {
        failedCount++
        // エラーは無視して続行
      }
    }
  }

  syncSpinner.stop()
  return { syncedCount, failedCount }
}

// ファイル同期結果の表示
function displayFileSyncResults(
  filesToSync: string[],
  syncedCount: number,
  failedCount: number
): void {
  console.log(chalk.green(`\n✨ ファイル同期完了: ${syncedCount}件成功, ${failedCount}件失敗`))

  if (filesToSync.length > 0) {
    console.log(chalk.gray('\n同期したファイル:'))
    filesToSync.forEach(file => {
      console.log(chalk.gray(`  - ${file}`))
    })
  }
}

// 環境変数・設定ファイルの同期

async function syncEnvironmentFiles(
  allWorktrees: Worktree[],
  targetWorktrees: Worktree[],
  options: SyncOptions
): Promise<void> {
  console.log(chalk.bold('\n🔧 環境変数・設定ファイルの同期\n'))

  const configManager = new ConfigManager()
  await configManager.loadProjectConfig()
  const config = configManager.getAll()

  const filesToSync = await determineFilesToSync(options, config, allWorktrees)

  // メインワークツリーのパス
  const mainWorktree = allWorktrees.find(wt => wt.path.endsWith('.'))
  if (!mainWorktree) {
    console.error(chalk.red('メインワークツリーが見つかりません'))
    return
  }

  if (!filesToSync || filesToSync.length === 0) {
    return
  }

  // 同期実行
  const { syncedCount, failedCount } = await performFileSync(
    targetWorktrees,
    filesToSync,
    mainWorktree.path
  )

  // 結果表示
  displayFileSyncResults(filesToSync, syncedCount, failedCount)
}

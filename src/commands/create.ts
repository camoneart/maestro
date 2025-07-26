import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { CreateOptions } from '../types/index.js'
import { ConfigManager, Config } from '../core/config.js'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'
import { spawn } from 'child_process'
import { setupTmuxStatusLine } from '../utils/tmux.js'
import { detectPackageManager } from '../utils/packageManager.js'
import { addToGitignore } from '../utils/gitignore.js'

// GitHubラベル型定義
interface GithubLabel {
  name: string
}

// GitHubユーザー型定義
interface GithubUser {
  login: string
}

// GitHub PR/Issue型定義
interface GithubMetadata {
  type: 'issue' | 'pr'
  title: string
  body: string
  author: string
  labels: string[]
  assignees: string[]
  milestone?: string
  url: string
}

// worktreeメタデータ型定義
interface WorktreeMetadata {
  createdAt: string
  branch: string
  worktreePath: string
  github?: GithubMetadata & { issueNumber?: string }
}

// Issue番号からブランチ名を生成する関数
export function parseIssueNumber(input: string): {
  isIssue: boolean
  issueNumber?: string
  branchName: string
} {
  // #123, 123, issue-123などの形式をサポート
  const issueMatch = input.match(/^#?(\d+)$/) || input.match(/^issue-(\d+)$/i)

  if (issueMatch) {
    const issueNumber = issueMatch[1]
    return {
      isIssue: true,
      issueNumber,
      branchName: `issue-${issueNumber}`,
    }
  }

  return {
    isIssue: false,
    branchName: input,
  }
}

interface GitHubApiResponse {
  number: number
  title: string
  body?: string
  author?: GithubUser
  labels?: GithubLabel[]
  assignees?: GithubUser[]
  milestone?: { title: string }
  url: string
}

// GitHub Issue/PRの情報を取得
// GitHubアイテム（PR/Issue）の情報を取得
async function fetchGitHubItem(
  issueNumber: string,
  type: 'pr' | 'issue'
): Promise<GitHubApiResponse> {
  const { stdout } = await execa('gh', [
    type,
    'view',
    issueNumber,
    '--json',
    'number,title,body,author,labels,assignees,milestone,url',
  ])
  return JSON.parse(stdout)
}

// GitHubアイテムをメタデータに変換
function convertToMetadata(item: GitHubApiResponse, type: 'pr' | 'issue'): GithubMetadata {
  return {
    type,
    title: item.title,
    body: item.body || '',
    author: item.author?.login || '',
    labels: item.labels?.map((l: GithubLabel) => l.name) || [],
    assignees: item.assignees?.map((a: GithubUser) => a.login) || [],
    milestone: item.milestone?.title,
    url: item.url,
  }
}

export async function fetchGitHubMetadata(issueNumber: string): Promise<GithubMetadata | null> {
  try {
    // まずPRとして試す
    try {
      const pr = await fetchGitHubItem(issueNumber, 'pr')
      return convertToMetadata(pr, 'pr')
    } catch {
      // PRでなければIssueとして試す
      const issue = await fetchGitHubItem(issueNumber, 'issue')
      return convertToMetadata(issue, 'issue')
    }
  } catch {
    // GitHub CLIが使えない、または認証されていない場合
    return null
  }
}

// worktreeメタデータをファイルに保存
export async function saveWorktreeMetadata(
  worktreePath: string,
  branchName: string,
  metadata: Partial<WorktreeMetadata>
): Promise<void> {
  const metadataPath = path.join(worktreePath, '.maestro-metadata.json')
  const metadataContent = {
    createdAt: new Date().toISOString(),
    branch: branchName,
    worktreePath,
    ...metadata,
  }

  try {
    await fs.writeFile(metadataPath, JSON.stringify(metadataContent, null, 2))

    // worktreeの.gitignoreに.maestro-metadata.jsonを追加
    await addToGitignore(worktreePath, '.maestro-metadata.json', 'maestro metadata')
  } catch {
    // メタデータの保存に失敗しても処理は続行
  }
}

// tmuxセッションを作成してClaude Codeを起動する関数
export async function createTmuxSession(
  branchName: string,
  worktreePath: string,
  options?: CreateOptions
): Promise<void> {
  const sessionName = branchName.replace(/[^a-zA-Z0-9_-]/g, '-')

  try {
    // ペイン分割オプションの場合
    if (options?.tmuxH || options?.tmuxV) {
      // 現在のtmuxセッション内でペインを分割
      const splitArgs = ['split-window']

      if (options.tmuxH) {
        splitArgs.push('-h') // 水平分割（左右）
      } else if (options.tmuxV) {
        splitArgs.push('-v') // 垂直分割（上下）
      }

      splitArgs.push('-c', worktreePath)
      await execa('tmux', splitArgs)

      // 新しいペインにタイトルを設定
      await execa('tmux', ['select-pane', '-T', branchName])

      // tmuxステータスラインを設定
      await setupTmuxStatusLine()


      // 新しいペインでシェルのプロンプトを表示
      console.log(
        chalk.green(`✅ tmuxペインを${options.tmuxH ? '水平' : '垂直'}分割しました: ${branchName}`)
      )
      return
    }

    // 既存のセッションをチェック（通常のtmuxオプションの場合）
    try {
      await execa('tmux', ['has-session', '-t', sessionName])
      console.log(chalk.yellow(`tmuxセッション '${sessionName}' は既に存在します`))
      return
    } catch {
      // セッションが存在しない場合は作成
    }

    // tmuxセッションを作成
    await execa('tmux', ['new-session', '-d', '-s', sessionName, '-c', worktreePath])

    // ウィンドウ名を設定
    await execa('tmux', ['rename-window', '-t', sessionName, branchName])

    console.log(chalk.green(`✨ tmuxセッション '${sessionName}' を作成しました`))


    // 自動でセッションにアタッチ
    console.log(chalk.cyan(`🎵 tmuxセッション '${sessionName}' にアタッチしています...`))

    // tmux内からはattach-sessionを使用、外からはattachを使用
    const isInsideTmux = process.env.TMUX !== undefined
    if (isInsideTmux) {
      await execa('tmux', ['switch-client', '-t', sessionName], { stdio: 'inherit' })
    } else {
      await execa('tmux', ['attach', '-t', sessionName], { stdio: 'inherit' })
    }
  } catch (error) {
    console.error(chalk.red(`tmuxセッションの作成に失敗しました: ${error}`))
  }
}

// Claude.mdの処理
export async function handleClaudeMarkdown(worktreePath: string, config: Config): Promise<void> {
  const claudeMode = config.claude?.markdownMode || 'shared'
  const rootClaudePath = path.join(process.cwd(), 'CLAUDE.md')
  const worktreeClaudePath = path.join(worktreePath, 'CLAUDE.md')

  try {
    if (claudeMode === 'shared') {
      // 共有モード: シンボリックリンクを作成
      if (
        await fs
          .access(rootClaudePath)
          .then(() => true)
          .catch(() => false)
      ) {
        // worktreeにコピーされたCLAUDE.mdを削除
        try {
          await fs.unlink(worktreeClaudePath)
        } catch {
          // ファイルが存在しない場合は無視
        }

        // シンボリックリンクを作成
        await fs.symlink(path.relative(worktreePath, rootClaudePath), worktreeClaudePath)
        console.log(chalk.green(`✨ CLAUDE.md を共有モードで設定しました`))
      }
    } else if (claudeMode === 'split') {
      // 分割モード: 専用のCLAUDE.mdを作成
      const splitContent = `# ${path.basename(worktreePath)} - Claude Code Instructions

This is a dedicated CLAUDE.md for this worktree.

## Project Context
- Branch: ${path.basename(worktreePath)}
- Worktree Path: ${worktreePath}

## Instructions
Add specific instructions for this worktree here.
`
      await fs.writeFile(worktreeClaudePath, splitContent)
      console.log(chalk.green(`✨ CLAUDE.md を分割モードで作成しました`))
    }
  } catch (error) {
    console.warn(chalk.yellow(`CLAUDE.mdの処理に失敗しました: ${error}`))
  }
}

// ブランチ名の解析と処理を行う純粋関数
export function processBranchName(
  branchName: string,
  config: Config
): {
  isIssue: boolean
  issueNumber: string | null
  finalBranchName: string
} {
  const { isIssue, issueNumber, branchName: parsedBranchName } = parseIssueNumber(branchName)

  let finalBranchName = parsedBranchName

  // ブランチ名にプレフィックスを追加
  if (
    config.worktrees?.branchPrefix &&
    !finalBranchName.startsWith(config.worktrees.branchPrefix)
  ) {
    finalBranchName = config.worktrees.branchPrefix + finalBranchName
  }

  return { isIssue, issueNumber: issueNumber || null, finalBranchName }
}

// GitHub情報を取得して表示する純粋関数
export async function fetchAndDisplayGithubMetadata(
  issueNumber: string,
  initialBranchName: string
): Promise<{ githubMetadata: GithubMetadata | null; enhancedBranchName: string }> {
  const githubMetadata = await fetchGitHubMetadata(issueNumber)

  if (!githubMetadata) {
    return { githubMetadata: null, enhancedBranchName: initialBranchName }
  }

  // タイトルからより適切なブランチ名を生成
  const sanitizedTitle = githubMetadata.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30)
  const enhancedBranchName = `${githubMetadata.type}-${issueNumber}-${sanitizedTitle}`

  return { githubMetadata, enhancedBranchName }
}

// メイン実行関数
export async function executeCreateCommand(
  branchName: string,
  options: CreateOptions & { template?: string }
): Promise<void> {
  const manager = new GitWorktreeManager()
  const configManager = new ConfigManager()

  // Git リポジトリの確認
  if (!(await manager.isGitRepository())) {
    console.error(chalk.red('エラー: このディレクトリはGitリポジトリではありません'))
    process.exit(1)
  }

  // 設定の読み込み
  await configManager.loadProjectConfig()
  const config = configManager.getAll()

  // ブランチ名の処理
  const { isIssue, issueNumber, finalBranchName } = processBranchName(branchName, config)

  // GitHub情報の取得
  let githubMetadata: GithubMetadata | null = null
  let enhancedBranchName = finalBranchName

  if (isIssue && issueNumber) {
    const result = await fetchAndDisplayGithubMetadata(issueNumber, finalBranchName)
    githubMetadata = result.githubMetadata
    enhancedBranchName = result.enhancedBranchName

    if (githubMetadata) {
      console.log(
        chalk.cyan(
          `\n📋 ${githubMetadata.type === 'pr' ? 'PR' : 'Issue'} #${issueNumber}: ${githubMetadata.title}`
        )
      )
      console.log(chalk.gray(`👤 ${githubMetadata.author}`))

      if (githubMetadata.labels.length > 0) {
        console.log(chalk.gray(`🏷️  ${githubMetadata.labels.join(', ')}`))
      }

      if (githubMetadata.assignees.length > 0) {
        console.log(chalk.gray(`👥 ${githubMetadata.assignees.join(', ')}`))
      }

      console.log(chalk.gray(`🔗 ${githubMetadata.url}`))
      console.log()
    }
  }

  // 確認プロンプト
  const shouldConfirm = await shouldPromptForConfirmation(
    options,
    enhancedBranchName,
    githubMetadata
  )

  if (shouldConfirm) {
    const confirmed = await confirmWorktreeCreation(enhancedBranchName, githubMetadata)
    if (!confirmed) {
      console.log(chalk.yellow('キャンセルされました'))
      return
    }
  }

  // Worktreeの作成
  try {
    await createWorktreeWithProgress(
      manager,
      enhancedBranchName,
      options,
      config,
      githubMetadata,
      issueNumber
    )
  } catch (error) {
    // ブランチ名衝突のエラーハンドリング
    if (error instanceof Error && error.message.includes('競合します')) {
      console.error(chalk.red(`✖ 演奏者の招集に失敗しました: ${error.message}`))

      // 代替案を提案
      const branches = await manager.getAllBranches()
      const allBranches = [
        ...branches.local,
        ...branches.remote.map(r => r.replace(/^[^/]+\//, '')),
      ]
      const alternativeName = manager.generateAlternativeBranchName(enhancedBranchName, allBranches)

      console.log(chalk.yellow(`\n💡 代替案: '${alternativeName}' はいかがでしょうか？`))
      console.log(chalk.gray(`   実行コマンド: mst create ${alternativeName}`))
      process.exit(1)
    }

    // その他のエラー
    console.error(
      chalk.red(
        `✖ 演奏者の招集に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      )
    )
    process.exit(1)
  }
}

// 確認プロンプトが必要かどうかを判定
export async function shouldPromptForConfirmation(
  options: CreateOptions & { template?: string },
  branchName: string,
  githubMetadata: GithubMetadata | null
): Promise<boolean> {
  return !options.yes && (githubMetadata !== null || branchName.includes('issue-'))
}

// 作成確認プロンプト
export async function confirmWorktreeCreation(
  branchName: string,
  githubMetadata: GithubMetadata | null
): Promise<boolean> {
  const message = githubMetadata
    ? `${githubMetadata.type === 'pr' ? 'PR' : 'Issue'} "${githubMetadata.title}" 用のworktreeを作成しますか？`
    : `ブランチ "${branchName}" 用のworktreeを作成しますか？`

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: true,
    },
  ])

  return confirmed
}

// Worktree作成のメイン処理
export async function createWorktreeWithProgress(
  manager: GitWorktreeManager,
  branchName: string,
  options: CreateOptions & { template?: string },
  config: Config,
  githubMetadata: GithubMetadata | null,
  issueNumber: string | null
): Promise<void> {
  const spinner = ora('新しい演奏者を招集中...').start()

  try {
    // Worktreeの作成
    const worktreePath = await manager.createWorktree(branchName, options.base)

    // メタデータの保存
    await saveWorktreeMetadata(worktreePath, branchName, {
      github: githubMetadata
        ? { ...githubMetadata, issueNumber: issueNumber || undefined }
        : undefined,
    })

    spinner.succeed(chalk.green(`✨ 新しい演奏者を招集しました: ${worktreePath}`))

    // 後処理の実行
    await executePostCreationTasks(worktreePath, branchName, options, config)
  } catch (error) {
    spinner.fail(chalk.red(`演奏者の招集に失敗しました: ${error}`))
    throw error
  }
}

// 作成後のタスクを実行
export async function executePostCreationTasks(
  worktreePath: string,
  branchName: string,
  options: CreateOptions & { template?: string },
  config: Config
): Promise<void> {
  const tasks = []

  // 環境セットアップ
  if (options.setup || config.development?.autoSetup) {
    tasks.push(setupEnvironment(worktreePath, config))
  }

  // エディタで開く
  if (options.open) {
    tasks.push(openInEditor(worktreePath, config))
  }

  // tmuxセッション作成
  if (options.tmux || options.tmuxH || options.tmuxV || config.tmux?.enabled) {
    tasks.push(createTmuxSession(branchName, worktreePath, options))
  }

  // Claude.md処理
  if (options.claudeMd) {
    tasks.push(handleClaudeMarkdown(worktreePath, config))
  }

  // 並行実行
  await Promise.allSettled(tasks)

  // postCreate設定の処理
  if (config.postCreate) {
    // copyFilesの処理
    if (config.postCreate.copyFiles && config.postCreate.copyFiles.length > 0) {
      await copyFilesFromCurrentWorktree(worktreePath, config.postCreate.copyFiles)
    }

    // commandsの処理
    if (config.postCreate.commands && config.postCreate.commands.length > 0) {
      for (const command of config.postCreate.commands) {
        await executeCommandInWorktree(worktreePath, command)
      }
    }
  }

  // ファイルコピー処理（CLIオプション）
  if (options.copyFile && options.copyFile.length > 0) {
    await copyFilesFromCurrentWorktree(worktreePath, options.copyFile)
  }

  // afterCreateフックの実行（文字列または配列をサポート）
  if (config.hooks?.afterCreate) {
    const commands = Array.isArray(config.hooks.afterCreate)
      ? config.hooks.afterCreate
      : [config.hooks.afterCreate]

    for (const command of commands) {
      await executeCommandInWorktree(worktreePath, command)
    }
  }

  // シェルに入る処理
  if (options.shell) {
    await enterShell(worktreePath, branchName)
  }

  // コマンド実行処理
  if (options.exec) {
    await executeCommandInWorktree(worktreePath, options.exec)
  }
}

// 環境セットアップ
export async function setupEnvironment(worktreePath: string, config: Config): Promise<void> {
  const spinner = ora('環境をセットアップ中...').start()

  try {
    // 依存関係のインストール
    const packageManager = detectPackageManager(worktreePath)
    await execa(packageManager, ['install'], { cwd: worktreePath })

    // 設定ファイルの同期
    if (config.development?.syncFiles) {
      await syncConfigFiles(worktreePath, config.development.syncFiles)
    }

    spinner.succeed(chalk.green('✨ 環境セットアップが完了しました'))
  } catch (error) {
    spinner.fail(chalk.red(`環境セットアップに失敗しました: ${error}`))
  }
}

// 設定ファイルの同期
export async function syncConfigFiles(worktreePath: string, syncFiles: string[]): Promise<void> {
  const rootPath = process.cwd()

  for (const file of syncFiles) {
    const sourcePath = path.join(rootPath, file)
    const destPath = path.join(worktreePath, file)

    try {
      await fs.copyFile(sourcePath, destPath)
    } catch {
      // ファイルが存在しない場合は無視
    }
  }
}

// エディタで開く
export async function openInEditor(worktreePath: string, config: Config): Promise<void> {
  const editor = config.development?.defaultEditor || 'cursor'

  try {
    await execa(editor, [worktreePath], { detached: true })
    console.log(chalk.green(`✨ ${editor}で開きました`))
  } catch (error) {
    console.error(chalk.red(`エディタの起動に失敗しました: ${error}`))
  }
}

// Draft PR作成
export async function createDraftPR(branchName: string, worktreePath: string): Promise<void> {
  const spinner = ora('Draft PRを作成中...').start()

  try {
    await execa(
      'gh',
      ['pr', 'create', '--draft', '--title', `WIP: ${branchName}`, '--body', 'Work in progress'],
      {
        cwd: worktreePath,
      }
    )

    spinner.succeed(chalk.green('✨ Draft PRを作成しました'))
  } catch (error) {
    spinner.fail(chalk.red(`Draft PRの作成に失敗しました: ${error}`))
  }
}

// ファイルコピー処理（gitignoreファイルも含む）
export async function copyFilesFromCurrentWorktree(
  worktreePath: string,
  files: string[]
): Promise<void> {
  const spinner = ora('ファイルをコピー中...').start()
  const currentPath = process.cwd()
  let copiedCount = 0
  const gitignoreFiles: string[] = []

  try {
    const gitManager = new GitWorktreeManager()

    for (const file of files) {
      const sourcePath = path.join(currentPath, file)
      const destPath = path.join(worktreePath, file)

      try {
        // ファイルの存在確認
        const stats = await fs.stat(sourcePath)

        if (!stats.isFile()) {
          console.warn(chalk.yellow(`\n⚠️  ${file} はファイルではありません`))
          continue
        }

        // gitignoreされているかチェック
        const isGitignored = await gitManager.isGitignored(file)

        if (isGitignored) {
          gitignoreFiles.push(file)
        }

        // ディレクトリが存在しない場合は作成
        const destDir = path.dirname(destPath)
        await fs.mkdir(destDir, { recursive: true })

        // ファイルをコピー
        await fs.copyFile(sourcePath, destPath)
        copiedCount++
      } catch (error) {
        // ファイルが存在しない場合は警告レベルを下げる
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          // .envなど任意のファイルの場合はスキップを通知
          console.log(chalk.gray(`   ${file} は見つからないためコピーをスキップしました`))
        } else {
          // それ以外のエラーは警告として表示
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.warn(
            chalk.yellow(`\n⚠️  ファイル ${file} のコピーに失敗しました: ${errorMessage}`)
          )
        }
      }
    }

    if (copiedCount > 0) {
      spinner.succeed(chalk.green(`✨ ${copiedCount}個のファイルをコピーしました`))

      if (gitignoreFiles.length > 0) {
        console.log(chalk.blue(`   gitignoreファイル: ${gitignoreFiles.join(', ')}`))
      }
    } else {
      // ファイルが見つからなかった場合は情報として表示
      spinner.info(chalk.gray('同期対象のファイルが見つかりませんでした'))
    }
  } catch (error) {
    spinner.fail(chalk.red(`ファイルコピーに失敗しました: ${error}`))
  }
}

// シェルに入る処理
export async function enterShell(worktreePath: string, branchName: string): Promise<void> {
  console.log(chalk.cyan(`\n🎼 演奏者 '${branchName}' のシェルに入ります...`))

  // 環境変数を設定
  const env = {
    ...process.env,
    MAESTRO: '1',
    MAESTRO_NAME: branchName,
    MAESTRO_PATH: worktreePath,
  }

  // シェルを起動
  const shell = process.env.SHELL || '/bin/bash'
  const shellProcess = spawn(shell, [], {
    cwd: worktreePath,
    stdio: 'inherit',
    env,
  })

  // プロセスの終了を待つ
  return new Promise(resolve => {
    shellProcess.on('exit', () => {
      console.log(chalk.gray('\n🎼 シェルを終了しました'))
      resolve()
    })
  })
}

export const createCommand = new Command('create')
  .description('新しい演奏者（worktree）を招集する')
  .argument('<branch-name>', 'ブランチ名または Issue# (例: 123, #123, issue-123)')
  .option('-b, --base <branch>', 'ベースブランチ (デフォルト: 現在のブランチ)')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .option('-t, --tmux', 'tmuxセッションを作成してClaude Codeを起動')
  .option('--tmux-h', 'tmuxペインを水平分割して作成')
  .option('--tmux-v', 'tmuxペインを垂直分割して作成')
  .option('-c, --claude-md', 'CLAUDE.mdファイルを管理')
  .option('-y, --yes', '確認をスキップ')
  .option('--shell', '作成後にシェルに入る')
  .option('--exec <command>', '作成後にコマンドを実行')
  .option(
    '--copy-file <file>',
    '現在のworktreeからファイルをコピー（複数回使用可）',
    (value, previous: string[] = []) => [...previous, value]
  )
  .action(async (branchName: string, options: CreateOptions & { template?: string }) => {
    await executeCreateCommand(branchName, options)
  })

// worktree内でコマンドを実行
export async function executeCommandInWorktree(
  worktreePath: string,
  command: string
): Promise<void> {
  console.log(chalk.cyan(`\n🎵 コマンドを実行中: ${command}`))

  try {
    await execa(command, [], {
      cwd: worktreePath,
      shell: true,
      stdio: 'inherit',
    })
    console.log(chalk.green('✨ コマンドが正常に実行されました'))
  } catch (error) {
    console.error(
      chalk.red(
        `コマンドの実行に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      )
    )
    throw error
  }
}

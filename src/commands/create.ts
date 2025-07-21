import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { CreateOptions } from '../types/index.js'
import { ConfigManager, Config } from '../core/config.js'
import { getTemplateConfig } from './template.js'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'
import { spawn } from 'child_process'
import { setupTmuxStatusLine } from '../utils/tmux.js'

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
  template?: string
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
  } catch {
    // メタデータの保存に失敗しても処理は続行
  }
}

// tmuxセッションを作成してClaude Codeを起動する関数
export async function createTmuxSession(
  branchName: string,
  worktreePath: string,
  config: Config,
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

      // 新しいペインでClaudeコマンドを実行（オプションが有効な場合）
      if (options.claude || config.claude?.autoStart) {
        // Issue番号からの作成の場合、説明を含める
        let claudeCommand = 'claude'

        if (branchName.includes('issue-')) {
          const issueNumber = branchName.match(/issue-(\d+)/)?.[1]
          if (issueNumber) {
            claudeCommand = `claude "fix issue ${issueNumber}"`
          }
        }

        // 新しいペインにコマンドを送信
        await execa('tmux', ['send-keys', '-t', ':.', claudeCommand, 'Enter'])
      }

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

    // Claude Codeを起動する場合
    if (config.claude?.autoStart) {
      await execa('tmux', ['send-keys', '-t', sessionName, 'claude', 'Enter'])

      // 初期コマンドを送信
      if (config.claude?.initialCommands) {
        for (const cmd of config.claude.initialCommands) {
          await execa('tmux', ['send-keys', '-t', sessionName, cmd, 'Enter'])
        }
      }

      console.log(chalk.green(`✨ Claude Codeを起動しました`))
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

interface TemplateConfig {
  autoSetup?: boolean
  editor?: 'vscode' | 'cursor' | 'none'
  tmux?: boolean
  claude?: boolean
  branchPrefix?: string
  syncFiles?: string[]
  hooks?: Config['hooks']
}

// テンプレート設定を適用する純粋関数
// テンプレート設定からオプションを更新
function updateOptionsFromTemplate(
  options: CreateOptions & { template?: string },
  templateConfig: TemplateConfig
): CreateOptions & { template?: string } {
  const updatedOptions = { ...options }
  if (templateConfig.autoSetup !== undefined) updatedOptions.setup = templateConfig.autoSetup
  if (templateConfig.editor !== 'none') updatedOptions.open = true
  if (templateConfig.tmux) updatedOptions.tmux = true
  if (templateConfig.claude) updatedOptions.claude = true
  return updatedOptions
}

// テンプレート設定から設定オブジェクトを更新
function updateConfigFromTemplate(baseConfig: Config, templateConfig: TemplateConfig): Config {
  return {
    ...baseConfig,
    worktrees: {
      ...baseConfig.worktrees,
      branchPrefix: templateConfig.branchPrefix || baseConfig.worktrees?.branchPrefix,
    },
    development: {
      ...baseConfig.development,
      autoSetup: templateConfig.autoSetup ?? baseConfig.development?.autoSetup ?? true,
      syncFiles: templateConfig.syncFiles ||
        baseConfig.development?.syncFiles || ['.env', '.env.local'],
      defaultEditor: templateConfig.editor || baseConfig.development?.defaultEditor || 'cursor',
    },
    hooks: templateConfig.hooks || baseConfig.hooks,
  }
}

export async function applyTemplateConfig(
  templateName: string,
  options: CreateOptions & { template?: string },
  baseConfig: Config
): Promise<{ config: Config; updatedOptions: CreateOptions & { template?: string } }> {
  const templateConfig = await getTemplateConfig(templateName)

  if (!templateConfig) {
    return { config: baseConfig, updatedOptions: options }
  }

  const updatedOptions = updateOptionsFromTemplate(options, templateConfig)
  const config = updateConfigFromTemplate(baseConfig, templateConfig)

  return { config, updatedOptions }
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
  let config = configManager.getAll()

  // テンプレート設定の適用
  if (options.template) {
    const { config: updatedConfig, updatedOptions } = await applyTemplateConfig(
      options.template,
      options,
      config
    )
    config = updatedConfig
    Object.assign(options, updatedOptions)
  }

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
  await createWorktreeWithProgress(
    manager,
    enhancedBranchName,
    options,
    config,
    githubMetadata,
    issueNumber
  )
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
      template: options.template,
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
    tasks.push(createTmuxSession(branchName, worktreePath, config, options))
  }

  // Claude.md処理
  if (options.claude || config.claude?.autoStart) {
    tasks.push(handleClaudeMarkdown(worktreePath, config))
  }

  // Draft PR作成
  if (options.draftPr) {
    tasks.push(createDraftPR(branchName, worktreePath))
  }

  // 並行実行
  await Promise.allSettled(tasks)

  // ファイルコピー処理
  if (options.copyFile && options.copyFile.length > 0) {
    await copyFilesFromCurrentWorktree(worktreePath, options.copyFile)
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
    const packageManager = 'npm' // Default to npm for now
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

// ファイルコピー処理
export async function copyFilesFromCurrentWorktree(worktreePath: string, files: string[]): Promise<void> {
  const spinner = ora('ファイルをコピー中...').start()
  const currentPath = process.cwd()
  let copiedCount = 0

  try {
    for (const file of files) {
      const sourcePath = path.join(currentPath, file)
      const destPath = path.join(worktreePath, file)
      
      try {
        // ディレクトリが存在しない場合は作成
        const destDir = path.dirname(destPath)
        await fs.mkdir(destDir, { recursive: true })
        
        // ファイルをコピー
        await fs.copyFile(sourcePath, destPath)
        copiedCount++
      } catch (error) {
        console.warn(chalk.yellow(`\n⚠️  ファイル ${file} のコピーに失敗しました: ${error}`))
      }
    }

    if (copiedCount > 0) {
      spinner.succeed(chalk.green(`✨ ${copiedCount}個のファイルをコピーしました`))
    } else {
      spinner.warn(chalk.yellow('コピーできたファイルがありませんでした'))
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

export const createCommand = new Command('create')
  .description('新しい演奏者（worktree）を招集する')
  .argument('<branch-name>', 'ブランチ名または Issue# (例: 123, #123, issue-123)')
  .option('-b, --base <branch>', 'ベースブランチ (デフォルト: 現在のブランチ)')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .option('-t, --tmux', 'tmuxセッションを作成してClaude Codeを起動')
  .option('--tmux-h', 'tmuxペインを水平分割して作成')
  .option('--tmux-v', 'tmuxペインを垂直分割して作成')
  .option('-c, --claude', 'Claude Codeを自動起動')
  .option('--template <name>', 'テンプレートを使用')
  .option('-y, --yes', '確認をスキップ')
  .option('--draft-pr', 'Draft PRを自動作成')
  .option('--shell', '作成後にシェルに入る')
  .option('--exec <command>', '作成後にコマンドを実行')
  .option('--copy-file <file>', '現在のworktreeからファイルをコピー（複数回使用可）', (value, previous: string[] = []) => [...previous, value])
  .action(async (branchName: string, options: CreateOptions & { template?: string }) => {
    await executeCreateCommand(branchName, options)
  })

// worktree内でコマンドを実行
export async function executeCommandInWorktree(worktreePath: string, command: string): Promise<void> {
  console.log(chalk.cyan(`\n🎵 コマンドを実行中: ${command}`))
  
  try {
    await execa(command, [], {
      cwd: worktreePath,
      shell: true,
      stdio: 'inherit'
    })
    console.log(chalk.green('✨ コマンドが正常に実行されました'))
  } catch (error) {
    console.error(chalk.red(`コマンドの実行に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`))
    throw error
  }
}

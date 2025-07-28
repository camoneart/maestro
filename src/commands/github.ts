import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { ConfigManager } from '../core/config.js'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'
import { startTmuxShell, isInTmuxSession, TmuxPaneType } from '../utils/tmux.js'
import { detectPackageManager } from '../utils/packageManager.js'

// 型定義
interface GithubOptions {
  open?: boolean
  setup?: boolean
  message?: string
  reopen?: boolean
  close?: boolean
  tmux?: boolean
  tmuxVertical?: boolean
  tmuxHorizontal?: boolean
}

interface ItemInfo {
  number: number
  title: string
  author: { login: string }
  isDraft?: boolean
  headRefName?: string
}

interface ProjectConfig {
  github?: {
    branchNaming?: {
      prTemplate?: string
      issueTemplate?: string
    }
  }
  worktrees?: {
    branchPrefix?: string
  }
  development?: {
    autoSetup?: boolean
    syncFiles?: string[]
    defaultEditor?: string
  }
}

// エラークラス
class GithubCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GithubCommandError'
  }
}

// ====== ヘルパー関数 ======

// gh CLIの検証
async function validateGhCli(): Promise<void> {
  // gh CLIがインストールされているか確認
  try {
    await execa('gh', ['--version'])
  } catch {
    console.error(chalk.red('GitHub CLI (gh) がインストールされていません'))
    console.log(chalk.yellow('\nインストール方法:'))
    console.log('  brew install gh')
    console.log('  または https://cli.github.com/')
    process.exit(1)
  }

  // 認証状態を確認
  try {
    await execa('gh', ['auth', 'status'])
  } catch {
    console.error(chalk.red('GitHub CLIが認証されていません'))
    console.log(chalk.yellow('\n認証方法:'))
    console.log('  gh auth login')
    process.exit(1)
  }
}

// ブランチ名を生成
function generateBranchName(
  template: string,
  number: string,
  title: string,
  type: 'pr' | 'issue'
): string {
  // タイトルをブランチ名に適した形式に変換
  const sanitizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) // 長すぎるタイトルは切り詰める

  return template
    .replace('{number}', number)
    .replace('{title}', sanitizedTitle)
    .replace('{type}', type)
}

// PR/Issueの自動判定
async function detectType(number: string): Promise<'pr' | 'issue'> {
  try {
    await execa('gh', ['pr', 'view', number])
    return 'pr'
  } catch {
    try {
      await execa('gh', ['issue', 'view', number])
      return 'issue'
    } catch {
      throw new GithubCommandError(`PR/Issue #${number} が見つかりません`)
    }
  }
}

// PR/Issue情報を取得
async function fetchItemInfo(number: string, type: 'pr' | 'issue'): Promise<ItemInfo> {
  const fields = type === 'pr' ? 'number,title,headRefName,author' : 'number,title,author'
  const result = await execa('gh', [type, 'view', number, '--json', fields])
  return JSON.parse(result.stdout)
}

// コメント追加処理
async function addComment(number: string, message: string, type: 'pr' | 'issue'): Promise<void> {
  const commentSpinner = ora('コメントを投稿中...').start()
  try {
    await execa('gh', [type, 'comment', number, '--body', message])
    commentSpinner.succeed(`${type === 'pr' ? 'PR' : 'Issue'} #${number} にコメントを投稿しました`)
  } catch (error) {
    commentSpinner.fail('コメントの投稿に失敗しました')
    throw new GithubCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

// Issue/PRの状態変更
async function changeState(
  number: string,
  action: 'close' | 'reopen',
  type: 'pr' | 'issue'
): Promise<void> {
  const stateSpinner = ora(`${action === 'close' ? 'クローズ' : '再開'}中...`).start()
  try {
    await execa('gh', [type, action, number])
    stateSpinner.succeed(
      `${type === 'pr' ? 'PR' : 'Issue'} #${number} を${action === 'close' ? 'クローズ' : '再開'}しました`
    )
  } catch (error) {
    stateSpinner.fail(`${action === 'close' ? 'クローズ' : '再開'}に失敗しました`)
    throw new GithubCommandError(error instanceof Error ? error.message : '不明なエラー')
  }
}

// 環境セットアップ
async function setupEnvironment(
  worktreePath: string,
  config: ProjectConfig,
  shouldSetup: boolean
): Promise<void> {
  if (!shouldSetup) return

  const packageManager = detectPackageManager(worktreePath)
  const setupSpinner = ora('環境をセットアップ中...').start()

  try {
    await execa(packageManager, ['install'], { cwd: worktreePath })
    setupSpinner.succeed(`${packageManager} install 完了`)
  } catch {
    setupSpinner.warn(`${packageManager} install をスキップ`)
  }

  // 同期ファイルのコピー
  if (config.development?.syncFiles) {
    for (const file of config.development.syncFiles) {
      try {
        const sourcePath = path.join(process.cwd(), file)
        const destPath = path.join(worktreePath, file)
        await fs.copyFile(sourcePath, destPath)
        setupSpinner.succeed(`${file} をコピーしました`)
      } catch {
        // ファイルが存在しない場合はスキップ
      }
    }
  }
}

// エディタで開く
async function openInEditor(
  worktreePath: string,
  config: ProjectConfig,
  shouldOpen: boolean
): Promise<void> {
  if (!shouldOpen) return

  const openSpinner = ora('エディタで開いています...').start()
  const editor = config.development?.defaultEditor || 'cursor'

  try {
    if (editor === 'cursor') {
      await execa('cursor', [worktreePath])
      openSpinner.succeed('Cursorで開きました')
    } else if (editor === 'vscode') {
      await execa('code', [worktreePath])
      openSpinner.succeed('VSCodeで開きました')
    } else if (editor && editor !== 'none') {
      // カスタムエディタコマンドのサポート
      await execa(editor, [worktreePath])
      openSpinner.succeed(`${editor}で開きました`)
    }
  } catch {
    openSpinner.warn(`${editor}が見つかりません`)
  }
}

// ====== コマンドハンドラー ======

// コメントコマンドの処理
async function handleCommentCommand(number: string, options: GithubOptions): Promise<void> {
  const spinner = ora('PR/Issueを確認中...').start()

  let targetType: 'pr' | 'issue'
  try {
    targetType = await detectType(number)
    spinner.stop()
  } catch (error) {
    spinner.fail('PR/Issueの確認に失敗しました')
    throw error
  }

  // コメント処理
  if (options.message) {
    await addComment(number, options.message, targetType)
  } else {
    // インタラクティブにコメントを入力
    const { comment } = await inquirer.prompt([
      {
        type: 'input',
        name: 'comment',
        message: 'コメント内容:',
        validate: input => input.trim().length > 0 || 'コメントを入力してください',
      },
    ])
    await addComment(number, comment, targetType)
  }

  // 状態変更オプション
  if (options.reopen) {
    await changeState(number, 'reopen', targetType)
  } else if (options.close) {
    await changeState(number, 'close', targetType)
  }
}

// GitHub list表示処理
async function handleListCommand(): Promise<void> {
  console.log(chalk.blue('\n🔍 GitHub Pull Requests & Issues\n'))

  try {
    // PRリストを取得して表示
    console.log(chalk.cyan('📋 Pull Requests:'))
    const prs = await fetchItems('pr')

    if (prs.length === 0) {
      console.log(chalk.gray('  開いているPull Requestがありません'))
    } else {
      prs.forEach(pr => {
        const draftLabel = pr.isDraft ? chalk.yellow(' [draft]') : ''
        console.log(`  ${chalk.green(`#${pr.number}`)} ${pr.title}${draftLabel}`)
        console.log(`    ${chalk.gray(`by ${pr.author.login}`)}`)
      })
    }

    console.log() // 空行

    // Issueリストを取得して表示
    console.log(chalk.cyan('🎯 Issues:'))
    const issues = await fetchItems('issue')

    if (issues.length === 0) {
      console.log(chalk.gray('  開いているIssueがありません'))
    } else {
      issues.forEach(issue => {
        console.log(`  ${chalk.green(`#${issue.number}`)} ${issue.title}`)
        console.log(`    ${chalk.gray(`by ${issue.author.login}`)}`)
      })
    }

    console.log(chalk.gray('\n使用例:'))
    console.log(chalk.gray('  mst github pr 123   # PRから演奏者を招集'))
    console.log(chalk.gray('  mst github issue 456 # Issueから演奏者を招集'))
  } catch (error) {
    console.error(
      chalk.red('リスト取得中にエラーが発生しました:'),
      error instanceof Error ? error.message : '不明なエラー'
    )
    process.exit(1)
  }
}

// インタラクティブコメント処理
async function handleInteractiveComment(): Promise<void> {
  const { inputNumber } = await inquirer.prompt([
    {
      type: 'input',
      name: 'inputNumber',
      message: 'PR/Issue番号:',
      validate: input => {
        const num = parseInt(input)
        return (!isNaN(num) && num > 0) || '有効な番号を入力してください'
      },
    },
  ])

  const { comment } = await inquirer.prompt([
    {
      type: 'input',
      name: 'comment',
      message: 'コメント内容:',
      validate: input => input.trim().length > 0 || 'コメントを入力してください',
    },
  ])

  const spinner = ora('PR/Issueを確認中...').start()

  let targetType: 'pr' | 'issue'
  try {
    targetType = await detectType(inputNumber)
    spinner.stop()
  } catch (error) {
    spinner.fail('PR/Issueの確認に失敗しました')
    throw error
  }

  await addComment(inputNumber, comment, targetType)
}

// PR/Issue一覧を取得
async function fetchItems(type: 'pr' | 'issue'): Promise<ItemInfo[]> {
  const spinner = ora(`${type === 'pr' ? 'Pull Request' : 'Issue'}一覧を取得中...`).start()

  try {
    const fields = type === 'pr' ? 'number,title,author,isDraft' : 'number,title,author'
    const result = await execa('gh', [type, 'list', '--json', fields, '--limit', '20'])
    spinner.stop()
    return JSON.parse(result.stdout)
  } catch (error) {
    spinner.fail('一覧の取得に失敗しました')
    console.error(error)
    process.exit(1)
  }
}

// アイテム選択プロンプト
async function selectItem(items: ItemInfo[], type: 'pr' | 'issue'): Promise<string> {
  if (items.length === 0) {
    console.log(chalk.yellow(`開いている${type === 'pr' ? 'Pull Request' : 'Issue'}がありません`))
    process.exit(0)
  }

  const { selectedNumber } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedNumber',
      message: `${type === 'pr' ? 'Pull Request' : 'Issue'}を選択:`,
      choices: items.map(item => ({
        name: `#${item.number} ${item.title} ${chalk.gray(`by ${item.author.login}`)}${item.isDraft ? chalk.yellow(' [draft]') : ''}`,
        value: item.number.toString(),
      })),
      pageSize: 15,
    },
  ])

  return selectedNumber
}

// インタラクティブモードの処理
async function handleInteractiveMode(): Promise<{ type: string; number: string }> {
  const { selectType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectType',
      message: '何から演奏者を招集しますか？',
      choices: [
        { name: 'Pull Request', value: 'pr' },
        { name: 'Issue', value: 'issue' },
        { name: 'コメントを追加', value: 'comment' },
      ],
    },
  ])

  if (selectType === 'comment') {
    await handleInteractiveComment()
    throw new Error('INTERACTIVE_COMMENT_COMPLETE') // 特別な終了フラグ
  }

  const items = await fetchItems(selectType as 'pr' | 'issue')
  const selectedNumber = await selectItem(items, selectType as 'pr' | 'issue')

  return { type: selectType, number: selectedNumber }
}

// ブランチ名の生成
async function generateBranchForItem(
  type: 'pr' | 'issue',
  number: string,
  info: ItemInfo,
  config: ProjectConfig
): Promise<string> {
  const template =
    type === 'pr'
      ? config.github?.branchNaming?.prTemplate || 'pr-{number}'
      : config.github?.branchNaming?.issueTemplate || 'issue-{number}'
  let branchName = generateBranchName(template, number, info.title, type)

  // ブランチ名にプレフィックスを追加
  if (config.worktrees?.branchPrefix && !branchName.startsWith(config.worktrees.branchPrefix)) {
    branchName = config.worktrees.branchPrefix + branchName
  }

  return branchName
}

// PR用のworktree作成
async function createWorktreeForPR(
  number: string,
  branchName: string,
  gitManager: GitWorktreeManager
): Promise<string> {
  const tempBranch = `pr-${number}-checkout`

  // 一時的にcheckout
  await execa('gh', ['pr', 'checkout', number, '-b', tempBranch])

  // worktreeを作成
  const worktreePath = await gitManager.attachWorktree(branchName)

  // 元のブランチに戻る
  await execa('git', ['checkout', '-'])

  // 一時ブランチを削除
  await execa('git', ['branch', '-D', tempBranch])

  return worktreePath
}

// Worktree作成処理
async function createWorktreeFromGithub(
  type: 'pr' | 'issue',
  number: string,
  config: ProjectConfig,
  gitManager: GitWorktreeManager
): Promise<string> {
  const spinner = ora('情報を取得中...').start()

  let info: ItemInfo
  try {
    // PR/Issueの情報を取得
    info = await fetchItemInfo(number, type)
    spinner.succeed(`${type === 'pr' ? 'PR' : 'Issue'} #${number}: ${info.title}`)
  } catch (error) {
    spinner.fail('情報の取得に失敗しました')
    throw error
  }

  // ブランチ名を生成
  const branchName = await generateBranchForItem(type, number, info, config)

  // 確認
  const { confirmCreate } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmCreate',
      message: `ブランチ '${chalk.cyan(branchName)}' で演奏者を招集しますか？`,
      default: true,
    },
  ])

  if (!confirmCreate) {
    console.log(chalk.gray('キャンセルされました'))
    process.exit(0)
  }

  spinner.start('演奏者を招集中...')

  let worktreePath: string
  try {
    worktreePath =
      type === 'pr'
        ? await createWorktreeForPR(number, branchName, gitManager)
        : await gitManager.createWorktree(branchName)
  } catch (error) {
    spinner.fail('演奏者の招集に失敗しました')
    throw error
  }

  spinner.succeed(
    `演奏者 '${chalk.cyan(branchName)}' を招集しました！\n` +
      `  📁 ${chalk.gray(worktreePath)}\n` +
      `  🔗 ${chalk.blue(`${type === 'pr' ? 'PR' : 'Issue'} #${number}`)}`
  )

  return worktreePath
}

// ====== 引数解析 ======

function parseArguments(type?: string, number?: string): { type?: string; number?: string } {
  // typeとnumberの正規化
  if (!type || type === 'checkout') {
    // checkout または引数なしの場合
    if (!number && type === 'checkout') {
      console.error(chalk.red('PR/Issue番号を指定してください'))
      console.log(chalk.gray('使い方: maestro github checkout <number>'))
      process.exit(1)
    }

    // typeが番号の場合（maestro github 123）
    if (type && !isNaN(parseInt(type))) {
      return { type: 'checkout', number: type }
    }
  }

  return { type, number }
}

// 初期化処理
async function initialize(): Promise<{ gitManager: GitWorktreeManager; config: ProjectConfig }> {
  // 初期検証
  await validateGhCli()

  const gitManager = new GitWorktreeManager()
  const configManager = new ConfigManager()
  await configManager.loadProjectConfig()
  const config = configManager.getAll()

  // Gitリポジトリかチェック
  const isGitRepo = await gitManager.isGitRepository()
  if (!isGitRepo) {
    console.error(chalk.red('このディレクトリはGitリポジトリではありません'))
    process.exit(1)
  }

  return { gitManager, config }
}

// worktreeの作成と環境セットアップ
async function processWorktreeCreation(
  type: 'pr' | 'issue',
  number: string,
  options: GithubOptions,
  config: ProjectConfig,
  gitManager: GitWorktreeManager
): Promise<void> {
  // tmuxオプションの検証
  const tmuxOptionsCount = [options.tmux, options.tmuxVertical, options.tmuxHorizontal].filter(
    Boolean
  ).length
  if (tmuxOptionsCount > 1) {
    console.error(chalk.red('エラー: tmuxオプションは一つだけ指定してください'))
    process.exit(1)
  }

  const isUsingTmux = options.tmux || options.tmuxVertical || options.tmuxHorizontal
  if (isUsingTmux && !(await isInTmuxSession())) {
    console.error(
      chalk.red('エラー: tmuxオプションを使用するにはtmuxセッション内にいる必要があります')
    )
    process.exit(1)
  }

  // Worktree作成
  const worktreePath = await createWorktreeFromGithub(type, number, config, gitManager)

  // 環境セットアップ
  const shouldSetup =
    options?.setup || (options?.setup === undefined && config.development?.autoSetup)
  await setupEnvironment(worktreePath, config, !!shouldSetup)

  // tmuxでシェルを開く処理
  if (isUsingTmux) {
    let paneType: TmuxPaneType = 'new-window'
    if (options.tmuxVertical) paneType = 'vertical-split'
    if (options.tmuxHorizontal) paneType = 'horizontal-split'

    const branchName = path.basename(worktreePath)

    console.log(chalk.green(`\n🎼 GitHub統合による演奏者招集完了！tmux ${paneType}シェルで開始`))
    console.log(chalk.gray(`📁 ${worktreePath}\n`))

    try {
      await startTmuxShell({
        cwd: worktreePath,
        branchName,
        paneType,
        sessionName: branchName,
      })
    } catch (error) {
      console.error(
        chalk.red(
          `❌ tmux ${paneType}の起動に失敗: ${error instanceof Error ? error.message : '不明なエラー'}`
        )
      )
      console.log(chalk.yellow('エディタでのオープンに進みます...'))
      // tmuxが失敗した場合はエディタオープンにフォールバック
      const shouldOpen =
        options?.open ||
        (options?.open === undefined && config.development?.defaultEditor !== 'none')
      await openInEditor(worktreePath, config, !!shouldOpen)
    }
  } else {
    // エディタで開く
    const shouldOpen =
      options?.open || (options?.open === undefined && config.development?.defaultEditor !== 'none')
    await openInEditor(worktreePath, config, !!shouldOpen)
  }

  console.log(chalk.green('\n✨ GitHub統合による演奏者の招集が完了しました！'))
  console.log(chalk.gray(`\ncd ${worktreePath} で移動できます`))
}

// メイン処理
async function executeGithubCommand(
  type: string | undefined,
  number: string | undefined,
  options: GithubOptions,
  gitManager: GitWorktreeManager,
  config: ProjectConfig
): Promise<void> {
  // commentサブコマンドの処理
  if (type === 'comment') {
    if (!number) {
      throw new GithubCommandError('PR/Issue番号を指定してください')
    }
    await handleCommentCommand(number, options)
    return
  }

  // listサブコマンドの処理
  if (type === 'list') {
    await handleListCommand()
    return
  }

  // インタラクティブモードの処理
  let finalType = type
  let finalNumber = number

  if (!finalNumber) {
    try {
      const result = await handleInteractiveMode()
      finalType = result.type
      finalNumber = result.number
    } catch (error) {
      if (error instanceof Error && error.message === 'INTERACTIVE_COMMENT_COMPLETE') {
        return // コメント処理完了
      }
      throw error
    }
  }

  // typeの自動判定
  if (finalType === 'checkout' || !finalType) {
    finalType = await detectType(finalNumber!)
  }

  await processWorktreeCreation(
    finalType as 'pr' | 'issue',
    finalNumber!,
    options,
    config,
    gitManager
  )
}

// ====== メインコマンド ======

export const githubCommand = new Command('github')
  .alias('gh')
  .description('GitHub PR/Issueから演奏者を招集する')
  .argument('[type]', 'タイプ (checkout, pr, issue, comment, list)')
  .argument('[number]', 'PR/Issue番号')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .option('-m, --message <message>', 'コメントメッセージ')
  .option('--reopen', 'PR/Issueを再開')
  .option('--close', 'PR/Issueをクローズ')
  .option('-t, --tmux', 'tmuxの新しいウィンドウで開く')
  .option('--tmux-vertical, --tmux-v', 'tmuxの縦分割ペインで開く')
  .option('--tmux-horizontal, --tmux-h', 'tmuxの横分割ペインで開く')
  .action(async (type?: string, number?: string, options: GithubOptions = {}) => {
    const spinner = ora('オーケストレーション！').start()

    try {
      // 引数を解析
      const args = parseArguments(type, number)

      // 初期化
      spinner.text = '準備中...'
      const { gitManager, config } = await initialize()
      spinner.stop()

      // メイン処理を実行
      await executeGithubCommand(args.type, args.number, options, gitManager, config)
    } catch (error) {
      spinner.fail('エラーが発生しました')
      if (error instanceof GithubCommandError) {
        console.error(chalk.red(error.message))
        process.exitCode = 1
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
        process.exitCode = 1
      }
    }
  })

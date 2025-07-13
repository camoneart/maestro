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
function parseIssueNumber(input: string): {
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

// GitHub Issue/PRの情報を取得
async function fetchGitHubMetadata(issueNumber: string): Promise<GithubMetadata | null> {
  try {
    // まずPRとして試す
    try {
      const { stdout } = await execa('gh', [
        'pr',
        'view',
        issueNumber,
        '--json',
        'number,title,body,author,labels,assignees,milestone,url',
      ])
      const pr = JSON.parse(stdout)
      return {
        type: 'pr',
        title: pr.title,
        body: pr.body || '',
        author: pr.author?.login || '',
        labels: pr.labels?.map((l: GithubLabel) => l.name) || [],
        assignees: pr.assignees?.map((a: GithubUser) => a.login) || [],
        milestone: pr.milestone?.title,
        url: pr.url,
      }
    } catch {
      // PRでなければIssueとして試す
      const { stdout } = await execa('gh', [
        'issue',
        'view',
        issueNumber,
        '--json',
        'number,title,body,author,labels,assignees,milestone,url',
      ])
      const issue = JSON.parse(stdout)
      return {
        type: 'issue',
        title: issue.title,
        body: issue.body || '',
        author: issue.author?.login || '',
        labels: issue.labels?.map((l: GithubLabel) => l.name) || [],
        assignees: issue.assignees?.map((a: GithubUser) => a.login) || [],
        milestone: issue.milestone?.title,
        url: issue.url,
      }
    }
  } catch {
    // GitHub CLIが使えない、または認証されていない場合
    return null
  }
}

// worktreeメタデータをファイルに保存
async function saveWorktreeMetadata(
  worktreePath: string,
  branchName: string,
  metadata: Partial<WorktreeMetadata>
): Promise<void> {
  const metadataPath = path.join(worktreePath, '.scj-metadata.json')
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
async function createTmuxSession(
  branchName: string,
  worktreePath: string,
  config: Config
): Promise<void> {
  const sessionName = branchName.replace(/[^a-zA-Z0-9_-]/g, '-')

  try {
    // 既存のセッションをチェック
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
async function handleClaudeMarkdown(worktreePath: string, config: Config): Promise<void> {
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

export const createCommand = new Command('create')
  .description('新しい影分身（worktree）を作り出す')
  .argument('<branch-name>', 'ブランチ名または Issue# (例: 123, #123, issue-123)')
  .option('-b, --base <branch>', 'ベースブランチ (デフォルト: 現在のブランチ)')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .option('-t, --tmux', 'tmuxセッションを作成してClaude Codeを起動')
  .option('-c, --claude', 'Claude Codeを自動起動')
  .option('--template <name>', 'テンプレートを使用')
  .option('-y, --yes', '確認をスキップ')
  .option('--draft-pr', 'Draft PRを自動作成')
  .action(async (branchName: string, options: CreateOptions & { template?: string }) => {
    const spinner = ora('影分身の術！').start()

    try {
      const gitManager = new GitWorktreeManager()
      const configManager = new ConfigManager()
      await configManager.loadProjectConfig()

      let config = configManager.getAll()

      // テンプレートが指定されている場合は適用
      if (options.template) {
        spinner.text = 'テンプレートを適用中...'
        const templateConfig = await getTemplateConfig(options.template)

        if (templateConfig) {
          // テンプレート設定でオプションを上書き
          if (templateConfig.autoSetup !== undefined) options.setup = templateConfig.autoSetup
          if (templateConfig.editor !== 'none') options.open = true
          if (templateConfig.tmux) options.tmux = true
          if (templateConfig.claude) options.claude = true

          // 設定を一時的に上書き
          config = {
            ...config,
            worktrees: {
              ...config.worktrees,
              branchPrefix: templateConfig.branchPrefix || config.worktrees?.branchPrefix,
            },
            development: {
              ...config.development,
              autoSetup: templateConfig.autoSetup ?? config.development?.autoSetup ?? true,
              syncFiles: templateConfig.syncFiles ||
                config.development?.syncFiles || ['.env', '.env.local'],
              defaultEditor: templateConfig.editor || config.development?.defaultEditor || 'cursor',
            },
            hooks: templateConfig.hooks || config.hooks,
          }

          console.log(chalk.green(`\n✨ テンプレート '${options.template}' を適用しました\n`))
        } else {
          spinner.warn(`テンプレート '${options.template}' が見つかりません`)
        }
      }

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      // Issue番号またはブランチ名を解析
      const { isIssue, issueNumber, branchName: parsedBranchName } = parseIssueNumber(branchName)
      branchName = parsedBranchName

      // ブランチ名にプレフィックスを追加
      if (config.worktrees?.branchPrefix && !branchName.startsWith(config.worktrees.branchPrefix)) {
        branchName = config.worktrees.branchPrefix + branchName
      }

      // Issue番号が指定された場合の追加情報を表示とメタデータ取得
      let githubMetadata: GithubMetadata | null = null
      if (isIssue && issueNumber) {
        console.log(chalk.blue(`📝 Issue #${issueNumber} に基づいてブランチを作成します`))

        spinner.text = `GitHub Issue/PR #${issueNumber} の情報を取得中...`
        githubMetadata = await fetchGitHubMetadata(issueNumber)

        if (githubMetadata) {
          spinner.stop()
          console.log(
            chalk.green(`✨ ${githubMetadata.type === 'pr' ? 'PR' : 'Issue'} の情報を取得しました`)
          )
          console.log(chalk.gray(`  タイトル: ${githubMetadata.title}`))
          console.log(chalk.gray(`  作成者: ${githubMetadata.author}`))
          if (githubMetadata.labels.length > 0) {
            console.log(chalk.gray(`  ラベル: ${githubMetadata.labels.join(', ')}`))
          }
          if (githubMetadata.assignees.length > 0) {
            console.log(chalk.gray(`  担当者: ${githubMetadata.assignees.join(', ')}`))
          }
          if (githubMetadata.milestone) {
            console.log(chalk.gray(`  マイルストーン: ${githubMetadata.milestone}`))
          }
          console.log()

          // タイトルからより適切なブランチ名を生成
          const sanitizedTitle = githubMetadata.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 30)
          branchName = `${githubMetadata.type}-${issueNumber}-${sanitizedTitle}`
        } else {
          spinner.stop()
        }
      }

      // ブランチ名の確認
      interface CreateOptionsWithYes extends CreateOptions {
        yes?: boolean
      }
      if (!(options as CreateOptionsWithYes).yes) {
        const { confirmCreate } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmCreate',
            message: `ブランチ '${chalk.cyan(branchName)}' で影分身を作り出しますか？`,
            default: true,
          },
        ])

        if (!confirmCreate) {
          spinner.info('キャンセルされました')
          return
        }
      }

      spinner.text = '影分身を作り出し中...'

      // ワークツリーを作成
      const worktreePath = await gitManager.createWorktree(branchName, options.base)

      spinner.succeed(
        `影分身 '${chalk.cyan(branchName)}' を作り出しました！\n` +
          `  📁 ${chalk.gray(worktreePath)}`
      )

      // メタデータを保存
      if (githubMetadata || options.template) {
        const metadata: Partial<WorktreeMetadata> = {}

        if (githubMetadata) {
          metadata.github = {
            ...githubMetadata,
            issueNumber: issueNumber,
          }
        }

        if (options.template) {
          metadata.template = options.template
        }

        await saveWorktreeMetadata(worktreePath, branchName, metadata)
      }

      // 環境セットアップ（設定またはオプションで有効な場合）
      if (options.setup || (options.setup === undefined && config.development?.autoSetup)) {
        const setupSpinner = ora('環境をセットアップ中...').start()

        // package.jsonが存在する場合はnpm install
        try {
          await execa('npm', ['install'], { cwd: worktreePath })
          setupSpinner.succeed('npm install 完了')
        } catch {
          setupSpinner.warn('npm install をスキップ')
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

      // エディタで開く（設定またはオプションで有効な場合）
      if (
        options.open ||
        (options.open === undefined && config.development?.defaultEditor !== 'none')
      ) {
        const openSpinner = ora('エディタで開いています...').start()
        const editor = config.development?.defaultEditor || 'cursor'

        try {
          if (editor === 'cursor') {
            await execa('cursor', [worktreePath])
            openSpinner.succeed('Cursorで開きました')
          } else if (editor === 'vscode') {
            await execa('code', [worktreePath])
            openSpinner.succeed('VSCodeで開きました')
          }
        } catch {
          openSpinner.warn(`${editor}が見つかりません`)
        }
      }

      // CLAUDE.mdの処理
      await handleClaudeMarkdown(worktreePath, config)

      // テンプレートのカスタムファイルを作成
      if (options.template) {
        const templateConfig = await getTemplateConfig(options.template)
        if (templateConfig?.customFiles) {
          for (const file of templateConfig.customFiles) {
            try {
              const filePath = path.join(worktreePath, file.path)
              await fs.mkdir(path.dirname(filePath), { recursive: true })
              await fs.writeFile(filePath, file.content)
              console.log(chalk.green(`✨ ${file.path} を作成しました`))
            } catch {
              console.warn(chalk.yellow(`${file.path} の作成に失敗しました`))
            }
          }
        }
      }

      // tmuxセッションの作成（オプションまたは設定で有効な場合）
      if (options.tmux || (options.tmux === undefined && config.tmux?.enabled)) {
        await createTmuxSession(branchName, worktreePath, {
          ...config,
          claude: {
            autoStart: options.claude || config.claude?.autoStart || false,
            markdownMode: config.claude?.markdownMode || 'shared',
            initialCommands: config.claude?.initialCommands || [],
            costOptimization: config.claude?.costOptimization,
          },
        })
      }

      // Claude Codeの起動（tmuxセッションを使わない場合）
      if ((options.claude || config.claude?.autoStart) && !options.tmux && !config.tmux?.enabled) {
        const claudeSpinner = ora('Claude Codeを起動中...').start()
        try {
          // Claude Codeを起動（バックグラウンドで）
          execa('claude', [], { cwd: worktreePath, detached: true })
          claudeSpinner.succeed('Claude Codeを起動しました')
        } catch {
          claudeSpinner.warn('Claude Codeの起動に失敗しました')
        }
      }

      // フック実行（afterCreate）
      if (config.hooks?.afterCreate) {
        const hookSpinner = ora('フックを実行中...').start()
        try {
          await execa('sh', ['-c', config.hooks.afterCreate], {
            cwd: worktreePath,
            env: {
              ...process.env,
              SHADOW_CLONE: branchName,
              SHADOW_CLONE_PATH: worktreePath,
            },
          })
          hookSpinner.succeed('フックを実行しました')
        } catch {
          hookSpinner.warn('フックの実行に失敗しました')
        }
      }

      // Draft PR作成（オプションが有効な場合）
      if (options.draftPr) {
        const prSpinner = ora('Draft PRを作成中...').start()
        try {
          // まずブランチをpush
          await execa('git', ['push', '-u', 'origin', branchName], { cwd: worktreePath })

          // Draft PRを作成
          let prTitle = branchName
          let prBody = '## 概要\n\n'

          // GitHub Issue/PRメタデータがある場合は利用
          if (githubMetadata) {
            prTitle = githubMetadata.title
            prBody += `${githubMetadata.type === 'pr' ? 'PR' : 'Issue'} #${issueNumber} に関連する作業\n\n`
            prBody += `### 元の${githubMetadata.type === 'pr' ? 'PR' : 'Issue'}の内容\n${githubMetadata.body}\n\n`
            prBody += `### ラベル\n${githubMetadata.labels.join(', ')}\n\n`
            prBody += `### リンク\n${githubMetadata.url}\n\n`
          }

          prBody += '## 作業内容\n\n- [ ] TODO: 実装内容を記載\n\n'
          prBody += '## テスト\n\n- [ ] ユニットテスト追加\n- [ ] 動作確認完了\n\n'
          prBody += '---\n🥷 Created by shadow-clone-jutsu'

          const { stdout } = await execa(
            'gh',
            [
              'pr',
              'create',
              '--draft',
              '--title',
              prTitle,
              '--body',
              prBody,
              '--base',
              options.base || 'main',
            ],
            { cwd: worktreePath }
          )

          prSpinner.succeed('Draft PRを作成しました')
          console.log(chalk.cyan(`\nPR URL: ${stdout.trim()}`))
        } catch {
          prSpinner.fail('Draft PRの作成に失敗しました')
          console.error(
            chalk.yellow('GitHub CLIがインストールされているか、認証されているか確認してください')
          )
        }
      }

      console.log(chalk.green('\n✨ 影分身を作り出しました！'))
      console.log(chalk.gray(`\ncd ${worktreePath} で移動できます`))
    } catch (error) {
      spinner.fail('影分身を作り出せませんでした')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })

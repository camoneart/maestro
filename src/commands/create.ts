import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { CreateOptions } from '../types/index.js'
import { ConfigManager } from '../core/config.js'
import { getTemplateConfig } from './template.js'
import { execa } from 'execa'
import path from 'path'
import fs from 'fs/promises'

// Issue番号からブランチ名を生成する関数
function parseIssueNumber(input: string): { isIssue: boolean; issueNumber?: string; branchName: string } {
  // #123, 123, issue-123などの形式をサポート
  const issueMatch = input.match(/^#?(\d+)$/) || input.match(/^issue-(\d+)$/i)
  
  if (issueMatch) {
    const issueNumber = issueMatch[1]
    return {
      isIssue: true,
      issueNumber,
      branchName: `issue-${issueNumber}`
    }
  }
  
  return {
    isIssue: false,
    branchName: input
  }
}

// tmuxセッションを作成してClaude Codeを起動する関数
async function createTmuxSession(branchName: string, worktreePath: string, config: any): Promise<void> {
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
async function handleClaudeMarkdown(worktreePath: string, config: any): Promise<void> {
  const claudeMode = config.claude?.markdownMode || 'shared'
  const rootClaudePath = path.join(process.cwd(), 'CLAUDE.md')
  const worktreeClaudePath = path.join(worktreePath, 'CLAUDE.md')
  
  try {
    if (claudeMode === 'shared') {
      // 共有モード: シンボリックリンクを作成
      if (await fs.access(rootClaudePath).then(() => true).catch(() => false)) {
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
              branchPrefix: templateConfig.branchPrefix || config.worktrees?.branchPrefix
            },
            development: {
              ...config.development,
              autoSetup: templateConfig.autoSetup ?? config.development?.autoSetup,
              syncFiles: templateConfig.syncFiles || config.development?.syncFiles,
              defaultEditor: templateConfig.editor || config.development?.defaultEditor
            },
            hooks: templateConfig.hooks || config.hooks
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

      // Issue番号が指定された場合の追加情報を表示
      if (isIssue && issueNumber) {
        console.log(chalk.blue(`📝 Issue #${issueNumber} に基づいてブランチを作成します`))
      }

      // ブランチ名の確認
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

      spinner.text = '影分身を作り出し中...'

      // ワークツリーを作成
      const worktreePath = await gitManager.createWorktree(branchName, options.base)

      spinner.succeed(
        `影分身 '${chalk.cyan(branchName)}' を作り出しました！\n` +
          `  📁 ${chalk.gray(worktreePath)}`
      )

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
            } catch (error) {
              console.warn(chalk.yellow(`${file.path} の作成に失敗しました`))
            }
          }
        }
      }

      // tmuxセッションの作成（オプションまたは設定で有効な場合）
      if (options.tmux || (options.tmux === undefined && config.tmux?.enabled)) {
        await createTmuxSession(branchName, worktreePath, { ...config, claude: { autoStart: options.claude || config.claude?.autoStart } })
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

      console.log(chalk.green('\n✨ 影分身を作り出しました！'))
      console.log(chalk.gray(`\ncd ${worktreePath} で移動できます`))
    } catch (error) {
      spinner.fail('影分身を作り出せませんでした')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })

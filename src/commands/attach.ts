import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'

// 利用可能なブランチを取得
async function getAvailableBranches(
  gitManager: GitWorktreeManager,
  includeRemote: boolean
): Promise<string[]> {
  const branches = await gitManager.getAllBranches()
  const worktrees = await gitManager.listWorktrees()
  const attachedBranches = worktrees
    .map(wt => wt.branch?.replace('refs/heads/', ''))
    .filter(Boolean)

  let availableBranches = branches.local.filter(b => !attachedBranches.includes(b))

  if (includeRemote) {
    const remoteAvailable = branches.remote.filter(
      b => !attachedBranches.includes(b.split('/').slice(1).join('/'))
    )
    availableBranches = [...availableBranches, ...remoteAvailable]
  }

  return availableBranches
}

// ブランチを選択
async function selectBranch(availableBranches: string[]): Promise<string> {
  const { selectedBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBranch',
      message: 'どのブランチから演奏者を招集しますか？',
      choices: availableBranches.map(branch => ({
        name: branch.includes('origin/')
          ? `${chalk.yellow('[remote]')} ${chalk.cyan(branch)}`
          : `${chalk.green('[local]')} ${chalk.cyan(branch)}`,
        value: branch,
      })),
      pageSize: 15,
    },
  ])
  return selectedBranch
}

// ブランチの存在を確認
function validateBranchExists(branchName: string, availableBranches: string[]): void {
  if (!availableBranches.includes(branchName)) {
    console.error(chalk.red(`エラー: ブランチ '${branchName}' が見つかりません`))

    const similarBranches = availableBranches.filter(b => b.includes(branchName))
    if (similarBranches.length > 0) {
      console.log(chalk.yellow('\n利用可能なブランチ:'))
      similarBranches.forEach(branch => {
        console.log(`  - ${chalk.cyan(branch)}`)
      })
    }

    process.exit(1)
  }
}

// 環境セットアップを実行
async function setupEnvironment(worktreePath: string): Promise<void> {
  const setupSpinner = ora('環境をセットアップ中...').start()

  try {
    await execa('npm', ['install'], { cwd: worktreePath })
    setupSpinner.succeed('npm install 完了')
  } catch {
    setupSpinner.warn('npm install をスキップ')
  }
}

// エディタで開く
async function openInEditor(worktreePath: string): Promise<void> {
  const openSpinner = ora('エディタで開いています...').start()
  try {
    await execa('cursor', [worktreePath])
    openSpinner.succeed('Cursorで開きました')
  } catch {
    try {
      await execa('code', [worktreePath])
      openSpinner.succeed('VSCodeで開きました')
    } catch {
      openSpinner.warn('エディタが見つかりません')
    }
  }
}

export const attachCommand = new Command('attach')
  .alias('a')
  .description('既存のブランチから演奏者を招集する')
  .argument('[branch-name]', 'ブランチ名（省略時は選択）')
  .option('-r, --remote', 'リモートブランチも含める')
  .option('-f, --fetch', '最初にfetchを実行')
  .option('-o, --open', 'VSCode/Cursorで開く')
  .option('-s, --setup', '環境セットアップを実行')
  .action(
    async (
      branchName?: string,
      options: { remote?: boolean; fetch?: boolean; open?: boolean; setup?: boolean } = {}
    ) => {
      const spinner = ora('オーケストレーション！').start()

      try {
        const gitManager = new GitWorktreeManager()

        // Gitリポジトリかチェック
        const isGitRepo = await gitManager.isGitRepository()
        if (!isGitRepo) {
          spinner.fail('このディレクトリはGitリポジトリではありません')
          process.exit(1)
        }

        if (options?.fetch) {
          spinner.text = 'リモートから最新情報を取得中...'
          await gitManager.fetchAll()
        }

        spinner.text = 'ブランチ一覧を取得中...'
        const availableBranches = await getAvailableBranches(gitManager, options?.remote || false)

        if (availableBranches.length === 0) {
          spinner.fail('利用可能なブランチがありません')
          console.log(chalk.yellow('すべてのブランチは既に演奏者として存在します'))
          process.exit(0)
        }

        spinner.stop()

        if (!branchName) {
          branchName = await selectBranch(availableBranches)
        } else {
          validateBranchExists(branchName, availableBranches)
        }

        spinner.start(`演奏者を招集中...`)

        // ワークツリーを作成
        const worktreePath = await gitManager.attachWorktree(branchName || '')

        spinner.succeed(
          `演奏者 '${chalk.cyan(branchName)}' を招集しました！\n` +
            `  📁 ${chalk.gray(worktreePath)}`
        )

        if (options?.setup) {
          await setupEnvironment(worktreePath)
        }

        if (options?.open) {
          await openInEditor(worktreePath)
        }

        console.log(chalk.green('\n✨ 演奏者の招集が完了しました！'))
        console.log(chalk.gray(`\ncd ${worktreePath} で移動できます`))
      } catch (error) {
        spinner.fail('演奏者を招集できませんでした')
        console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
        process.exit(1)
      }
    }
  )

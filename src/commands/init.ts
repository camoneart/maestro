import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import ora from 'ora'
type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'none'

interface InitOptions {
  minimal?: boolean
  packageManager?: PackageManager
  template?: string
  yes?: boolean
}

interface ProjectType {
  name: string
  detected: boolean
  packageManager?: PackageManager
  setupCommands?: string[]
  syncFiles?: string[]
}

export const initCommand = new Command('init')
  .description('プロジェクトにMaestro設定を初期化')
  .option('-m, --minimal', 'ミニマル設定で初期化')
  .option('-p, --package-manager <manager>', 'パッケージマネージャーを指定 (pnpm/npm/yarn/none)')
  .option('-t, --template <name>', 'テンプレートを指定')
  .option('-y, --yes', 'プロンプトをスキップしてデフォルト値を使用')
  .action(async (options: InitOptions) => {
    try {
      console.log(chalk.cyan('🎼 Welcome to Maestro Setup!\n'))

      // 既存の.maestro.jsonチェック
      const configPath = path.join(process.cwd(), '.maestro.json')
      if (existsSync(configPath)) {
        if (!options.yes) {
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: '.maestro.json が既に存在します。上書きしますか？',
              default: false,
            },
          ])
          if (!overwrite) {
            console.log(chalk.yellow('設定の初期化をキャンセルしました'))
            return
          }
        }
      }

      // プロジェクトタイプの検出
      const projectType = detectProjectType()
      console.log(
        chalk.gray(
          `検出されたプロジェクト: ${projectType.name}${
            projectType.detected ? ' ✅' : ' (自動検出なし)'
          }\n`
        )
      )

      let config: Record<string, unknown>

      if (options.minimal) {
        config = createMinimalConfig()
      } else if (options.yes) {
        config = createDefaultConfig(projectType, options.packageManager)
      } else {
        config = await createInteractiveConfig(projectType)
      }

      // 設定ファイルを書き込み
      const spinner = ora('設定ファイルを作成中...').start()
      try {
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
        spinner.succeed('✨ .maestro.json が作成されました！')
      } catch (error) {
        spinner.fail('設定ファイルの作成に失敗しました')
        throw error
      }

      // 使用方法の表示
      console.log(chalk.green('\n🎉 Maestro の設定が完了しました！\n'))
      console.log(chalk.cyan('次のステップ:'))
      console.log(chalk.gray('  mst create <branch-name>  # 新しい演奏者を招集'))
      console.log(chalk.gray('  mst list                  # 演奏者一覧を表示'))
      console.log(chalk.gray('  mst --help               # その他のコマンドを確認'))

      const postCreate = config.postCreate as { commands?: string[] } | undefined
      if (postCreate?.commands && postCreate.commands.length > 0) {
        console.log(
          chalk.yellow(
            `\n💡 worktree作成時に自動で実行されるコマンド: ${postCreate.commands.join(
              ', '
            )}`
          )
        )
      }
    } catch (error) {
      console.error(chalk.red('エラーが発生しました:'), error)
      process.exit(1)
    }
  })

function detectProjectType(): ProjectType {
  const cwd = process.cwd()

  // package.jsonの存在確認とパッケージマネージャー検出
  if (existsSync(path.join(cwd, 'package.json'))) {
    const packageJson = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf-8'))
    
    let packageManager: PackageManager = 'npm'
    if (existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm'
    } else if (existsSync(path.join(cwd, 'yarn.lock'))) {
      packageManager = 'yarn'
    }

    // プロジェクトタイプの判定
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    
    if (dependencies['next']) {
      return {
        name: 'Next.js',
        detected: true,
        packageManager,
        setupCommands: [`${packageManager} install`],
        syncFiles: ['.env', '.env.local', '.env.development.local'],
      }
    } else if (dependencies['react']) {
      return {
        name: 'React',
        detected: true,
        packageManager,
        setupCommands: [`${packageManager} install`],
        syncFiles: ['.env', '.env.local'],
      }
    } else if (dependencies['vue']) {
      return {
        name: 'Vue.js',
        detected: true,
        packageManager,
        setupCommands: [`${packageManager} install`],
        syncFiles: ['.env', '.env.local'],
      }
    } else {
      return {
        name: 'Node.js',
        detected: true,
        packageManager,
        setupCommands: [`${packageManager} install`],
        syncFiles: ['.env'],
      }
    }
  }

  // Pythonプロジェクト
  if (existsSync(path.join(cwd, 'requirements.txt')) || existsSync(path.join(cwd, 'pyproject.toml'))) {
    return {
      name: 'Python',
      detected: true,
      packageManager: 'none',
      setupCommands: ['pip install -r requirements.txt'],
      syncFiles: ['.env'],
    }
  }

  // Go プロジェクト
  if (existsSync(path.join(cwd, 'go.mod'))) {
    return {
      name: 'Go',
      detected: true,
      packageManager: 'none',
      setupCommands: ['go mod download'],
      syncFiles: ['.env'],
    }
  }

  return {
    name: 'Generic',
    detected: false,
    packageManager: 'none',
    setupCommands: [],
    syncFiles: ['.env'],
  }
}

function createMinimalConfig() {
  return {
    worktrees: {
      path: '.git/orchestra-members',
    },
    development: {
      autoSetup: true,
      defaultEditor: 'cursor',
    },
  }
}

function createDefaultConfig(projectType: ProjectType, packageManager?: PackageManager): Record<string, unknown> {
  let commands: string[] = []
  
  if (packageManager && packageManager !== 'none') {
    // 明示的にpackage managerが指定された場合は、それを使用
    commands = [`${packageManager} install`]
  } else if (projectType.setupCommands && projectType.setupCommands.length > 0) {
    // プロジェクトタイプに特有のsetupCommandsがある場合
    commands = projectType.setupCommands
  } else {
    // デフォルトまたは検出されたpackage managerを使用
    const pm = projectType.packageManager || 'npm'
    if (pm !== 'none') {
      commands = [`${pm} install`]
    }
  }

  return {
    worktrees: {
      path: '.git/orchestra-members',
      branchPrefix: 'feature/',
    },
    development: {
      autoSetup: true,
      defaultEditor: 'cursor',
    },
    postCreate: {
      copyFiles: projectType.syncFiles || ['.env'],
      commands,
    },
    hooks: {
      beforeDelete: 'echo "演奏者を削除します: $ORCHESTRA_MEMBER"',
    },
  }
}

async function createInteractiveConfig(projectType: ProjectType): Promise<Record<string, unknown>> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'packageManager',
      message: 'どのパッケージマネージャーを使用しますか？',
      choices: [
        { name: 'pnpm', value: 'pnpm' },
        { name: 'npm', value: 'npm' },
        { name: 'yarn', value: 'yarn' },
        { name: 'none (パッケージマネージャーを使用しない)', value: 'none' },
      ],
      default: projectType.packageManager || 'pnpm',
    },
    {
      type: 'input',
      name: 'worktreePath',
      message: 'worktreeを作成するディレクトリは？',
      default: '.git/orchestra-members',
    },
    {
      type: 'input',
      name: 'branchPrefix',
      message: 'ブランチ名のプレフィックスは？',
      default: 'feature/',
    },
    {
      type: 'list',
      name: 'defaultEditor',
      message: 'デフォルトのエディタは？',
      choices: [
        { name: 'Cursor', value: 'cursor' },
        { name: 'VS Code', value: 'vscode' },
        { name: 'Vim', value: 'vim' },
        { name: 'その他', value: 'other' },
      ],
      default: 'cursor',
    },
    {
      type: 'confirm',
      name: 'autoSetup',
      message: '依存関係の自動インストールを有効にしますか？',
      default: true,
    },
    {
      type: 'confirm',
      name: 'copyEnvFiles',
      message: '環境ファイルをworktreeにコピーしますか？',
      default: true,
      when: (answers) => answers.autoSetup,
    },
    {
      type: 'input',
      name: 'syncFiles',
      message: 'コピーするファイルを指定 (カンマ区切り):',
      default: (projectType.syncFiles || ['.env']).join(', '),
      when: (answers) => answers.copyEnvFiles,
      filter: (input: string) => input.split(',').map((s) => s.trim()).filter(Boolean),
    },
  ])

  const commands = []
  if (answers.autoSetup && answers.packageManager !== 'none') {
    commands.push(`${answers.packageManager} install`)
  }

  return {
    worktrees: {
      path: answers.worktreePath,
      branchPrefix: answers.branchPrefix,
    },
    development: {
      autoSetup: answers.autoSetup,
      defaultEditor: answers.defaultEditor,
    },
    postCreate: {
      copyFiles: answers.syncFiles || [],
      commands,
    },
    hooks: {
      beforeDelete: 'echo "演奏者を削除します: $ORCHESTRA_MEMBER"',
    },
  }
}
import { Command } from 'commander'
import chalk from 'chalk'
import { ConfigManager } from '../core/config.js'
import inquirer from 'inquirer'
import fs from 'fs/promises'
import path from 'path'

// Helper functions to reduce complexity
async function handleInitAction(configManager: ConfigManager): Promise<void> {
  const { createConfig } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createConfig',
      message: 'プロジェクト設定ファイル (.maestro.json) を作成しますか？',
      default: true,
    },
  ])

  if (!createConfig) {
    console.log(chalk.gray('キャンセルされました'))
    return
  }

  try {
    await configManager.createProjectConfig()
    console.log(chalk.green('✅ .maestro.json を作成しました'))
    console.log(
      chalk.gray('\n設定ファイルを編集して、プロジェクトに合わせてカスタマイズしてください')
    )
  } catch (error) {
    console.error(chalk.red('設定ファイルの作成に失敗しました:'), error)
  }
}

async function handleShowAction(configManager: ConfigManager, options?: { global?: boolean }): Promise<void> {
  const config = configManager.getAll()
  console.log(chalk.bold('\n🎼 maestro 設定:\n'))
  console.log(JSON.stringify(config, null, 2))

  if (options?.global) {
    console.log(chalk.gray(`\nグローバル設定: ${configManager.getConfigPath()}`))
  }
}

async function handlePathAction(configManager: ConfigManager): Promise<void> {
  console.log(chalk.bold('設定ファイルのパス:\n'))

  // グローバル設定
  console.log(chalk.green('グローバル設定:'))
  console.log(`  ${configManager.getConfigPath()}`)

  // プロジェクト設定
  console.log(chalk.green('\nプロジェクト設定 (優先度順):'))
  const configPaths = ['.maestro.json', '.maestrorc.json', 'maestro.config.json']

  for (const configFile of configPaths) {
    const configPath = path.join(process.cwd(), configFile)
    try {
      await fs.access(configPath)
      console.log(`  ✅ ${configPath}`)
    } catch {
      console.log(`  ❌ ${configPath} ${chalk.gray('(存在しません)')}`)
    }
  }
}

function handleGetAction(configManager: ConfigManager, key?: string): void {
  if (!key) {
    console.error(chalk.red('設定キーを指定してください'))
    console.log(chalk.gray('使用例: maestro config get ui.pathDisplay'))
    return
  }

  const value = configManager.getConfigValue(key)
  if (value === undefined) {
    console.log(chalk.gray(`設定値が見つかりません: ${key}`))
  } else if (typeof value === 'object') {
    console.log(JSON.stringify(value, null, 2))
  } else {
    console.log(value)
  }
}

async function handleSetAction(configManager: ConfigManager, key?: string, value?: string): Promise<void> {
  if (!key || value === undefined) {
    console.error(chalk.red('設定キーと値を指定してください'))
    console.log(chalk.gray('使用例: maestro config set ui.pathDisplay relative'))
    return
  }

  try {
    await configManager.setConfigValue(key, value)
    console.log(chalk.green(`✅ ${key} を ${value} に設定しました`))
  } catch (error) {
    console.error(chalk.red('設定の更新に失敗しました:'), error)
  }
}

async function handleResetAction(configManager: ConfigManager, key?: string): Promise<void> {
  if (!key) {
    console.error(chalk.red('設定キーを指定してください'))
    console.log(chalk.gray('使用例: maestro config reset ui.pathDisplay'))
    return
  }

  try {
    await configManager.resetConfigValue(key)
    console.log(chalk.green(`✅ ${key} をデフォルト値にリセットしました`))
    
    // リセット後の値を表示
    const currentValue = configManager.getConfigValue(key)
    if (currentValue !== undefined) {
      console.log(chalk.gray(`現在の値: ${currentValue}`))
    }
  } catch (error) {
    console.error(chalk.red('設定のリセットに失敗しました:'), error)
  }
}

function showUsage(): void {
  console.log(chalk.yellow('使い方:'))
  console.log('  maestro config init           # プロジェクト設定ファイルを作成')
  console.log('  maestro config show           # 現在の設定を表示')
  console.log('  maestro config path           # 設定ファイルのパスを表示')
  console.log('  maestro config get <key>      # 設定値を取得')
  console.log('  maestro config set <key> <value> # 設定値を設定')
  console.log('  maestro config reset <key>   # 設定値をリセット')
  console.log(chalk.gray('\n使用例:'))
  console.log('  maestro config get ui.pathDisplay')
  console.log('  maestro config set ui.pathDisplay relative')
  console.log('  maestro config set development.autoSetup false')
  console.log('  maestro config reset ui.pathDisplay')
  console.log(chalk.gray('\nオプション:'))
  console.log('  -g, --global      # グローバル設定を対象にする')
}

export const configCommand = new Command('config')
  .description('設定を管理')
  .argument('[action]', 'アクション (init, show, path, get, set, reset)')
  .argument('[key]', '設定キー（ドット記法）')
  .argument('[value]', '設定値（setアクションの場合）')
  .option('-g, --global', 'グローバル設定を対象にする')
  .action(async (action?: string, key?: string, value?: string, options?: { global?: boolean }) => {
    const configManager = new ConfigManager()
    await configManager.loadProjectConfig()

    switch (action) {
      case 'init':
        await handleInitAction(configManager)
        break

      case 'show':
        await handleShowAction(configManager, options)
        break

      case 'path':
        await handlePathAction(configManager)
        break

      case 'get':
        handleGetAction(configManager, key)
        break

      case 'set':
        await handleSetAction(configManager, key, value)
        break

      case 'reset':
        await handleResetAction(configManager, key)
        break

      default:
        showUsage()
    }
  })
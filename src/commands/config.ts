import { Command } from 'commander'
import chalk from 'chalk'
import { ConfigManager } from '../core/config.js'
import inquirer from 'inquirer'
import fs from 'fs/promises'
import path from 'path'

export const configCommand = new Command('config')
  .description('設定を管理')
  .argument('[action]', 'アクション (init, show, path)')
  .option('-g, --global', 'グローバル設定を対象にする')
  .action(async (action?: string, options?: { global?: boolean }) => {
    const configManager = new ConfigManager()
    await configManager.loadProjectConfig()

    switch (action) {
      case 'init': {
        // プロジェクト設定ファイルを作成
        const { createConfig } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'createConfig',
            message: 'プロジェクト設定ファイル (.scj.json) を作成しますか？',
            default: true,
          },
        ])

        if (!createConfig) {
          console.log(chalk.gray('キャンセルされました'))
          return
        }

        try {
          await configManager.createProjectConfig()
          console.log(chalk.green('✅ .scj.json を作成しました'))
          console.log(
            chalk.gray('\n設定ファイルを編集して、プロジェクトに合わせてカスタマイズしてください')
          )
        } catch (error) {
          console.error(chalk.red('設定ファイルの作成に失敗しました:'), error)
        }
        break
      }

      case 'show': {
        // 現在の設定を表示
        const config = configManager.getAll()
        console.log(chalk.bold('\n🥷 shadow-clone-jutsu 設定:\n'))
        console.log(JSON.stringify(config, null, 2))

        if (options?.global) {
          console.log(chalk.gray(`\nグローバル設定: ${configManager.getConfigPath()}`))
        }
        break
      }

      case 'path': {
        // 設定ファイルのパスを表示
        console.log(chalk.bold('設定ファイルのパス:\n'))

        // グローバル設定
        console.log(chalk.green('グローバル設定:'))
        console.log(`  ${configManager.getConfigPath()}`)

        // プロジェクト設定
        console.log(chalk.green('\nプロジェクト設定 (優先度順):'))
        const configPaths = ['.scj.json', '.scjrc.json', 'scj.config.json']

        for (const configFile of configPaths) {
          const configPath = path.join(process.cwd(), configFile)
          try {
            await fs.access(configPath)
            console.log(`  ✅ ${configPath}`)
          } catch {
            console.log(`  ❌ ${configPath} ${chalk.gray('(存在しません)')}`)
          }
        }
        break
      }

      default: {
        console.log(chalk.yellow('使い方:'))
        console.log('  scj config init   # プロジェクト設定ファイルを作成')
        console.log('  scj config show   # 現在の設定を表示')
        console.log('  scj config path   # 設定ファイルのパスを表示')
        console.log(chalk.gray('\nオプション:'))
        console.log('  -g, --global      # グローバル設定を対象にする')
      }
    }
  })

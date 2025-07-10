import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { ConfigManager } from '../core/config.js'
import fs from 'fs/promises'
import path from 'path'
import { homedir } from 'os'

interface TemplateOptions {
  list?: boolean
  save?: string
  apply?: string
  delete?: string
  edit?: string
  global?: boolean
}

interface WorktreeTemplate {
  name: string
  description?: string
  config: {
    branchPrefix?: string
    autoSetup?: boolean
    syncFiles?: string[]
    editor?: 'vscode' | 'cursor' | 'none'
    tmux?: boolean
    claude?: boolean
    hooks?: {
      afterCreate?: string
      beforeDelete?: string
    }
    customFiles?: Array<{
      path: string
      content: string
    }>
  }
}

// テンプレートディレクトリのパス
function getTemplateDir(global = false): string {
  if (global) {
    return path.join(homedir(), '.scj', 'templates')
  }
  return path.join(process.cwd(), '.scj', 'templates')
}

// テンプレートファイルのパス
function getTemplatePath(name: string, global = false): string {
  return path.join(getTemplateDir(global), `${name}.json`)
}

// 利用可能なテンプレートを取得
async function getAvailableTemplates(global = false): Promise<WorktreeTemplate[]> {
  const templates: WorktreeTemplate[] = []
  
  try {
    const templateDir = getTemplateDir(global)
    await fs.mkdir(templateDir, { recursive: true })
    
    const files = await fs.readdir(templateDir)
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(templateDir, file), 'utf-8')
          const template = JSON.parse(content) as WorktreeTemplate
          templates.push(template)
        } catch {
          // 無効なテンプレートは無視
        }
      }
    }
  } catch {
    // エラーは無視
  }
  
  return templates
}

// デフォルトテンプレート
const defaultTemplates: WorktreeTemplate[] = [
  {
    name: 'feature',
    description: '新機能開発用の標準テンプレート',
    config: {
      branchPrefix: 'feature/',
      autoSetup: true,
      syncFiles: ['.env', '.env.local'],
      editor: 'cursor',
      claude: true
    }
  },
  {
    name: 'bugfix',
    description: 'バグ修正用のテンプレート',
    config: {
      branchPrefix: 'bugfix/',
      autoSetup: true,
      syncFiles: ['.env', '.env.local'],
      editor: 'cursor',
      claude: false
    }
  },
  {
    name: 'experiment',
    description: '実験的な機能開発用',
    config: {
      branchPrefix: 'exp/',
      autoSetup: false,
      syncFiles: [],
      editor: 'none',
      tmux: true,
      hooks: {
        afterCreate: 'echo "実験開始！"'
      }
    }
  },
  {
    name: 'docs',
    description: 'ドキュメント作成用',
    config: {
      branchPrefix: 'docs/',
      autoSetup: false,
      syncFiles: [],
      editor: 'vscode',
      customFiles: [
        {
          path: 'NOTES.md',
          content: '# ドキュメント作成メモ\n\n## TODO\n- [ ] \n'
        }
      ]
    }
  }
]

// テンプレート一覧を表示
async function listTemplates(global: boolean): Promise<void> {
  const localTemplates = await getAvailableTemplates(false)
  const globalTemplates = global ? await getAvailableTemplates(true) : []
  
  console.log(chalk.bold('\n📋 利用可能なテンプレート:\n'))
  
  // デフォルトテンプレート
  console.log(chalk.cyan('デフォルトテンプレート:'))
  defaultTemplates.forEach(template => {
    console.log(`  ${chalk.green(template.name)} - ${chalk.gray(template.description)}`)
    console.log(chalk.gray(`    ブランチ接頭辞: ${template.config.branchPrefix || 'なし'}`))
  })
  
  // ローカルテンプレート
  if (localTemplates.length > 0) {
    console.log(chalk.cyan('\nローカルテンプレート:'))
    localTemplates.forEach(template => {
      console.log(`  ${chalk.blue(template.name)} - ${chalk.gray(template.description || '説明なし')}`)
    })
  }
  
  // グローバルテンプレート
  if (globalTemplates.length > 0) {
    console.log(chalk.cyan('\nグローバルテンプレート:'))
    globalTemplates.forEach(template => {
      console.log(`  ${chalk.magenta(template.name)} - ${chalk.gray(template.description || '説明なし')}`)
    })
  }
}

// テンプレートを保存
async function saveTemplate(name: string, global: boolean): Promise<void> {
  const spinner = ora('現在の設定を読み込み中...').start()
  
  try {
    const configManager = new ConfigManager()
    await configManager.loadProjectConfig()
    const currentConfig = configManager.getAll()
    
    spinner.stop()
    
    // テンプレート情報を入力
    const { description, includeFiles } = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'テンプレートの説明:',
        default: `${name}用のテンプレート`
      },
      {
        type: 'confirm',
        name: 'includeFiles',
        message: 'カスタムファイルを含めますか？',
        default: false
      }
    ])
    
    const template: WorktreeTemplate = {
      name,
      description,
      config: {
        branchPrefix: currentConfig.worktrees?.branchPrefix,
        autoSetup: currentConfig.development?.autoSetup,
        syncFiles: currentConfig.development?.syncFiles,
        editor: currentConfig.development?.defaultEditor,
        hooks: currentConfig.hooks
      }
    }
    
    // カスタムファイルの追加
    if (includeFiles) {
      const customFiles: Array<{ path: string; content: string }> = []
      let addMore = true
      
      while (addMore) {
        const { filePath, fileContent, continueAdding } = await inquirer.prompt([
          {
            type: 'input',
            name: 'filePath',
            message: 'ファイルパス（worktree内の相対パス）:',
            validate: input => input.trim().length > 0 || 'パスを入力してください'
          },
          {
            type: 'editor',
            name: 'fileContent',
            message: 'ファイル内容:'
          },
          {
            type: 'confirm',
            name: 'continueAdding',
            message: 'さらにファイルを追加しますか？',
            default: false
          }
        ])
        
        customFiles.push({ path: filePath, content: fileContent })
        addMore = continueAdding
      }
      
      template.config.customFiles = customFiles
    }
    
    // テンプレートを保存
    const templatePath = getTemplatePath(name, global)
    await fs.mkdir(path.dirname(templatePath), { recursive: true })
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2))
    
    console.log(chalk.green(`✨ テンプレート '${name}' を保存しました`))
    console.log(chalk.gray(`パス: ${templatePath}`))
  } catch (error) {
    spinner.fail('テンプレートの保存に失敗しました')
    throw error
  }
}

// テンプレートを適用
async function applyTemplate(templateName: string): Promise<Record<string, any>> {
  // デフォルトテンプレートを確認
  let template = defaultTemplates.find(t => t.name === templateName)
  
  // ローカルテンプレートを確認
  if (!template) {
    const localTemplates = await getAvailableTemplates(false)
    template = localTemplates.find(t => t.name === templateName)
  }
  
  // グローバルテンプレートを確認
  if (!template) {
    const globalTemplates = await getAvailableTemplates(true)
    template = globalTemplates.find(t => t.name === templateName)
  }
  
  if (!template) {
    throw new Error(`テンプレート '${templateName}' が見つかりません`)
  }
  
  console.log(chalk.green(`✨ テンプレート '${templateName}' を適用します`))
  console.log(chalk.gray(template.description))
  
  // 設定を返す（createコマンドで使用）
  return {
    branchPrefix: template.config.branchPrefix,
    autoSetup: template.config.autoSetup,
    syncFiles: template.config.syncFiles,
    editor: template.config.editor,
    tmux: template.config.tmux,
    claude: template.config.claude,
    hooks: template.config.hooks,
    customFiles: template.config.customFiles
  }
}

// テンプレートを削除
async function deleteTemplate(name: string, global: boolean): Promise<void> {
  const templatePath = getTemplatePath(name, global)
  
  try {
    await fs.access(templatePath)
    
    const { confirmDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmDelete',
        message: `テンプレート '${name}' を削除しますか？`,
        default: false
      }
    ])
    
    if (confirmDelete) {
      await fs.unlink(templatePath)
      console.log(chalk.green(`✨ テンプレート '${name}' を削除しました`))
    }
  } catch {
    throw new Error(`テンプレート '${name}' が見つかりません`)
  }
}

export const templateCommand = new Command('template')
  .alias('tpl')
  .description('worktreeテンプレートを管理')
  .option('-l, --list', '利用可能なテンプレートを表示')
  .option('-s, --save <name>', '現在の設定をテンプレートとして保存')
  .option('-a, --apply <name>', 'テンプレートを適用')
  .option('-d, --delete <name>', 'テンプレートを削除')
  .option('-g, --global', 'グローバルテンプレートとして操作')
  .action(async (options: TemplateOptions) => {
    try {
      if (options.list || Object.keys(options).length === 0) {
        await listTemplates(options.global || false)
      }
      
      if (options.save) {
        await saveTemplate(options.save, options.global || false)
      }
      
      if (options.apply) {
        const config = await applyTemplate(options.apply)
        console.log(chalk.gray('\n適用される設定:'))
        console.log(JSON.stringify(config, null, 2))
      }
      
      if (options.delete) {
        await deleteTemplate(options.delete, options.global || false)
      }
      
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })

// テンプレート設定を取得する関数（createコマンドから使用）
export async function getTemplateConfig(templateName: string): Promise<Record<string, any> | null> {
  try {
    return await applyTemplate(templateName)
  } catch {
    return null
  }
}
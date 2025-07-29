import { z } from 'zod'
import Conf from 'conf'
import path from 'path'
import fs from 'fs/promises'

// 設定ファイルのスキーマ定義
export const ConfigSchema = z.object({
  // Git worktree設定
  worktrees: z
    .object({
      // worktreeを作成するディレクトリ（デフォルト: .git/orchestrations）
      path: z.string().optional(),
      // ブランチ名のプレフィックス
      branchPrefix: z.string().optional(),
      // ディレクトリ名のプレフィックス（デフォルト: 空文字列）
      directoryPrefix: z.string().optional(),
    })
    .optional(),

  // 開発環境設定
  development: z
    .object({
      // 自動でnpm installを実行
      autoSetup: z.boolean().default(true),
      // 同期するファイル（.envなど）
      syncFiles: z.array(z.string()).default(['.env', '.env.local']),
      // デフォルトのエディタ
      defaultEditor: z.enum(['vscode', 'cursor', 'none']).default('cursor'),
    })
    .optional(),

  // tmux統合設定
  tmux: z
    .object({
      enabled: z.boolean().default(false),
      // 新規ウィンドウかペインか
      openIn: z.enum(['window', 'pane']).default('window'),
      // セッション名の命名規則
      sessionNaming: z.string().default('{branch}'),
    })
    .optional(),

  // Claude Code統合設定
  claude: z
    .object({
      // CLAUDE.mdの処理方法
      markdownMode: z.enum(['shared', 'split']).default('shared'),
    })
    .optional(),

  // GitHub統合設定
  github: z
    .object({
      // 自動でfetchを実行
      autoFetch: z.boolean().default(true),
      // ブランチ命名規則
      branchNaming: z
        .object({
          // PR用のテンプレート (例: "pr-{number}-{title}")
          prTemplate: z.string().default('pr-{number}'),
          // Issue用のテンプレート (例: "issue-{number}-{title}")
          issueTemplate: z.string().default('issue-{number}'),
        })
        .optional(),
    })
    .optional(),

  // UI表示設定
  ui: z
    .object({
      // パス表示形式 ('absolute' | 'relative')
      pathDisplay: z.enum(['absolute', 'relative']).default('absolute'),
    })
    .optional(),

  // カスタムコマンドとファイルコピー設定
  hooks: z
    .object({
      // worktree作成後に実行（文字列または配列）
      afterCreate: z.union([z.string(), z.array(z.string())]).optional(),
      // worktree削除前に実行
      beforeDelete: z.string().optional(),
    })
    .optional(),

  // worktree作成時の処理
  postCreate: z
    .object({
      // コピーするファイル（gitignoreファイルも含む）
      copyFiles: z.array(z.string()).optional(),
      // 実行するコマンド
      commands: z.array(z.string()).optional(),
    })
    .optional(),
})

export type Config = z.infer<typeof ConfigSchema>

// デフォルト設定
const DEFAULT_CONFIG: Config = {
  worktrees: {
    path: '../maestro-{branch}',
    directoryPrefix: '',
  },
  development: {
    autoSetup: true,
    syncFiles: ['.env', '.env.local'],
    defaultEditor: 'cursor',
  },
  tmux: {
    enabled: false,
    openIn: 'window',
    sessionNaming: '{branch}',
  },
  claude: {
    markdownMode: 'shared',
  },
  github: {
    autoFetch: true,
  },
  ui: {
    pathDisplay: 'absolute',
  },
  hooks: {},
}

export class ConfigManager {
  private conf: Conf<Config>
  private projectConfig: Config | null = null
  private userConfig: Config | null = null

  constructor() {
    // グローバル設定（ユーザーホーム）
    this.conf = new Conf<Config>({
      projectName: 'maestro',
      defaults: DEFAULT_CONFIG,
    })
  }

  async loadProjectConfig(): Promise<void> {
    try {
      // ユーザー設定ファイル(.maestro.local.json)を先に読み込む
      await this.loadUserConfig()

      // プロジェクトルートの設定ファイルを探す
      const configPaths = [
        path.join(process.cwd(), '.maestro.json'),
        path.join(process.cwd(), '.maestrorc.json'),
        path.join(process.cwd(), 'maestro.config.json'),
        // グローバル設定ファイル
        path.join(process.env.HOME || '~', '.maestrorc'),
        path.join(process.env.HOME || '~', '.maestrorc.json'),
      ]

      for (const configPath of configPaths) {
        try {
          const configData = await fs.readFile(configPath, 'utf-8')
          const parsedConfig = JSON.parse(configData)
          this.projectConfig = ConfigSchema.parse(parsedConfig)
          return
        } catch {
          // ファイルが存在しない場合は次を試す
        }
      }
    } catch (error) {
      console.error('プロジェクト設定の読み込みに失敗しました:', error)
    }
  }

  async loadUserConfig(): Promise<void> {
    try {
      const userConfigPath = path.join(process.cwd(), '.maestro.local.json')
      const configData = await fs.readFile(userConfigPath, 'utf-8')
      const parsedConfig = JSON.parse(configData)
      this.userConfig = ConfigSchema.parse(parsedConfig)
    } catch {
      // ユーザー設定ファイルが存在しない場合は無視
      this.userConfig = null
    }
  }

  // 設定を取得（ユーザー設定 > プロジェクト設定 > グローバル設定 > デフォルト）
  get<K extends keyof Config>(key: K): Config[K] {
    if (this.userConfig && this.userConfig[key] !== undefined) {
      return this.userConfig[key]
    }
    if (this.projectConfig && this.projectConfig[key] !== undefined) {
      return this.projectConfig[key]
    }
    return this.conf.get(key) ?? DEFAULT_CONFIG[key]
  }

  // 設定を更新（グローバル設定のみ）
  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.conf.set(key, value)
  }

  // 全設定を取得
  getAll(): Config {
    const globalConfig = this.conf.store
    return { 
      ...DEFAULT_CONFIG, 
      ...globalConfig, 
      ...(this.projectConfig || {}),
      ...(this.userConfig || {})
    }
  }

  // 設定ファイルのパスを取得
  getConfigPath(): string {
    return this.conf.path
  }

  // ドット記法で設定値を取得
  getConfigValue(keyPath: string): unknown {
    const keys = keyPath.split('.')
    const config = this.getAll()

    return keys.reduce((obj: unknown, key: string) => {
      if (obj && typeof obj === 'object' && key in obj) {
        return (obj as Record<string, unknown>)[key]
      }
      return undefined
    }, config as unknown)
  }

  // ドット記法で設定値を設定
  async setConfigValue(keyPath: string, value: unknown, target: 'user' | 'project' = 'project'): Promise<void> {
    if (target === 'user') {
      await this.setUserConfigValue(keyPath, value)
    } else {
      await this.setProjectConfigValue(keyPath, value)
    }
  }

  // ユーザー設定を設定
  async setUserConfigValue(keyPath: string, value: unknown): Promise<void> {
    const configPath = path.join(process.cwd(), '.maestro.local.json')

    // 既存のユーザー設定を読み込む
    let userConfig: Record<string, unknown> = {}
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      userConfig = JSON.parse(configData)
    } catch {
      // ファイルが存在しない場合は空のオブジェクトから開始
    }

    // ドット記法でネストしたオブジェクトを作成
    const keys = keyPath.split('.')
    let current = userConfig

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!key) continue
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }

    // 値の型変換
    const lastKey = keys[keys.length - 1]
    if (lastKey) {
      current[lastKey] = this.parseValue(value)
    }

    // バリデーション
    const validatedConfig = ConfigSchema.parse(userConfig)

    // ファイルに保存
    await fs.writeFile(configPath, JSON.stringify(validatedConfig, null, 2) + '\n', 'utf-8')

    // メモリ上の設定も更新
    this.userConfig = validatedConfig
  }

  // プロジェクト設定を設定
  async setProjectConfigValue(keyPath: string, value: unknown): Promise<void> {
    const configPath = path.join(process.cwd(), '.maestro.json')

    // 既存のプロジェクト設定を読み込む
    let projectConfig: Record<string, unknown> = {}
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      projectConfig = JSON.parse(configData)
    } catch {
      // ファイルが存在しない場合は空のオブジェクトから開始
    }

    // ドット記法でネストしたオブジェクトを作成
    const keys = keyPath.split('.')
    let current = projectConfig

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!key) continue
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }

    // 値の型変換
    const lastKey = keys[keys.length - 1]
    if (lastKey) {
      current[lastKey] = this.parseValue(value)
    }

    // バリデーション
    const validatedConfig = ConfigSchema.parse(projectConfig)

    // ファイルに保存
    await fs.writeFile(configPath, JSON.stringify(validatedConfig, null, 2) + '\n', 'utf-8')

    // メモリ上の設定も更新
    this.projectConfig = validatedConfig
  }

  // 設定値をリセット（デフォルトに戻す）
  async resetConfigValue(keyPath: string): Promise<void> {
    const configPath = path.join(process.cwd(), '.maestro.json')

    // 既存のプロジェクト設定を読み込む
    let projectConfig: Record<string, unknown> = {}
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      projectConfig = JSON.parse(configData)
    } catch {
      // ファイルが存在しない場合は何もしない
      return
    }

    // ドット記法でキーを削除
    const keys = keyPath.split('.')
    let current = projectConfig
    const parents: Array<{ obj: Record<string, unknown>; key: string }> = []

    // パスをたどって削除対象を見つける
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!key || !current[key]) {
        return // キーが存在しない場合は何もしない
      }
      parents.push({ obj: current, key })
      current = current[key] as Record<string, unknown>
    }

    const lastKey = keys[keys.length - 1]
    if (lastKey && current[lastKey] !== undefined) {
      delete current[lastKey]
    }

    // 空のオブジェクトを削除
    this.cleanEmptyObjects(projectConfig, keyPath.split('.').slice(0, -1))

    // ファイルに保存
    await fs.writeFile(configPath, JSON.stringify(projectConfig, null, 2) + '\n', 'utf-8')

    // メモリ上の設定も更新
    this.projectConfig = Object.keys(projectConfig).length > 0 ? projectConfig : null
  }

  // 値の型変換
  private parseValue(value: unknown): unknown {
    if (typeof value === 'string') {
      // boolean値の変換
      if (value === 'true') return true
      if (value === 'false') return false

      // 数値の変換
      if (/^\d+$/.test(value)) return parseInt(value, 10)
      if (/^\d+\.\d+$/.test(value)) return parseFloat(value)
    }

    return value
  }

  // 空のオブジェクトを削除
  private cleanEmptyObjects(obj: Record<string, unknown>, keys: string[]): void {
    if (keys.length === 0) return

    let current = obj
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!key || !current[key]) return
      current = current[key] as Record<string, unknown>
    }

    const lastKey = keys[keys.length - 1]
    if (
      lastKey &&
      current[lastKey] &&
      typeof current[lastKey] === 'object' &&
      Object.keys(current[lastKey] as Record<string, unknown>).length === 0
    ) {
      delete current[lastKey]
      // 再帰的にチェック
      this.cleanEmptyObjects(obj, keys.slice(0, -1))
    }
  }

  // プロジェクト設定ファイルの作成
  async createProjectConfig(configPath?: string): Promise<void> {
    const targetPath = configPath || path.join(process.cwd(), '.maestro.json')
    const exampleConfig: Partial<Config> = {
      worktrees: {
        path: '../maestro-{branch}',
        branchPrefix: 'feature/',
        directoryPrefix: 'maestro-',
      },
      development: {
        autoSetup: true,
        syncFiles: ['.env', '.env.local'],
        defaultEditor: 'cursor',
      },
      tmux: {
        enabled: true,
        openIn: 'window',
        sessionNaming: '{branch}',
      },
      claude: {
        markdownMode: 'shared',
      },
      github: {
        autoFetch: true,
        branchNaming: {
          prTemplate: 'pr-{number}',
          issueTemplate: 'issue-{number}',
        },
      },
      ui: {
        pathDisplay: 'absolute',
      },
      hooks: {
        afterCreate: 'npm install',
        beforeDelete: 'echo "オーケストラメンバーを解散します: $MAESTRO_BRANCH"',
      },
      postCreate: {
        copyFiles: ['.env', '.env.local'],
        commands: ['pnpm install', 'pnpm run dev'],
      },
    }

    await fs.writeFile(targetPath, JSON.stringify(exampleConfig, null, 2) + '\n', 'utf-8')
  }
}

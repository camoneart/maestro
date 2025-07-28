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

  constructor() {
    // グローバル設定（ユーザーホーム）
    this.conf = new Conf<Config>({
      projectName: 'maestro',
      defaults: DEFAULT_CONFIG,
    })
  }

  async loadProjectConfig(): Promise<void> {
    try {
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

  // 設定を取得（プロジェクト設定 > グローバル設定 > デフォルト）
  get<K extends keyof Config>(key: K): Config[K] {
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
    if (this.projectConfig) {
      return { ...DEFAULT_CONFIG, ...globalConfig, ...this.projectConfig }
    }
    return { ...DEFAULT_CONFIG, ...globalConfig }
  }

  // 設定ファイルのパスを取得
  getConfigPath(): string {
    return this.conf.path
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

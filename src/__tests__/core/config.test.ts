import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConfigManager, ConfigSchema } from '../../core/config'
import Conf from 'conf'
import fs from 'fs/promises'
import path from 'path'

// モック設定
vi.mock('conf')
vi.mock('fs/promises')

describe('ConfigManager', () => {
  let configManager: ConfigManager
  let mockStore: Record<string, any>

  beforeEach(() => {
    mockStore = {}

    // Confのモック実装
    vi.mocked(Conf).mockImplementation(
      () =>
        ({
          get: (key: string, defaultValue?: any) => mockStore[key] ?? defaultValue,
          set: (key: string, value: any) => {
            mockStore[key] = value
          },
          clear: () => {
            mockStore = {}
          },
          store: mockStore,
        }) as any
    )

    configManager = new ConfigManager()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('get/set', () => {
    it('should set and get config values', () => {
      configManager.set('worktrees', { branchPrefix: 'feature/' })
      const value = configManager.get('worktrees')

      expect(value?.branchPrefix).toBe('feature/')
    })

    it('should return default value for non-existent keys', () => {
      // ConfigManagerは存在しないキーに対してデフォルト値を返す
      const value = configManager.get('worktrees')
      expect(value).toBeDefined() // デフォルト値が返される
    })
  })

  describe('getAll', () => {
    it('should return all config values', () => {
      mockStore.worktrees = { branchPrefix: 'feature/' }
      mockStore.development = { autoSetup: true }

      const config = configManager.getAll()

      // デフォルト値とマージされるので、部分的にチェック
      expect(config.worktrees?.branchPrefix).toBe('feature/')
      expect(config.development?.autoSetup).toBe(true)
    })

    it('should return default config when no custom config', () => {
      const config = configManager.getAll()
      // デフォルト設定が返される
      expect(config).toHaveProperty('worktrees')
      expect(config).toHaveProperty('development')
      expect(config).toHaveProperty('github')
    })
  })

  describe('clear', () => {
    it('should clear all config values', () => {
      configManager.set('worktrees', { branchPrefix: 'feature/' })
      configManager.set('development', { autoSetup: false })

      // Confのclearメソッドを使用
      const conf = (configManager as any).conf
      conf.clear()

      // clearしてもデフォルト値は残る
      const config = configManager.getAll()
      expect(config).toHaveProperty('worktrees')
    })
  })

  describe('loadProjectConfig', () => {
    it('should load project config from .maestrorc', async () => {
      const configData = {
        worktrees: {
          branchPrefix: 'feature/',
        },
        development: {
          autoSetup: false,
          defaultEditor: 'vscode',
        },
      }

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(configData))

      await configManager.loadProjectConfig()

      // .maestro.jsonを最初に試す
      expect(fs.readFile).toHaveBeenCalledWith(path.join(process.cwd(), '.maestro.json'), 'utf-8')
      expect(configManager.get('worktrees')?.branchPrefix).toBe('feature/')
      expect(configManager.get('development')?.autoSetup).toBe(false)
      expect(configManager.get('development')?.defaultEditor).toBe('vscode')
    })

    it('should handle missing config file gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'))

      await expect(configManager.loadProjectConfig()).resolves.not.toThrow()
    })

    it('should validate config schema', async () => {
      const invalidConfig = {
        development: {
          defaultEditor: 'invalid-editor', // Should be 'vscode' | 'cursor' | 'none'
        },
      }

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(invalidConfig))

      // バリデーションエラーはキャッチされるのでrejectしない
      await configManager.loadProjectConfig()

      // プロジェクト設定は読み込まれない（null にセットされる）
      const projectConfig = (configManager as any).projectConfig
      expect(projectConfig).toBeNull()
    })

    it('should merge with existing config', async () => {
      configManager.set('development', { syncFiles: ['.env'] })

      const configData = {
        worktrees: {
          branchPrefix: 'feature/',
        },
      }

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(configData))

      await configManager.loadProjectConfig()

      expect(configManager.get('worktrees')?.branchPrefix).toBe('feature/')
      // グローバル設定も保持される
      const config = configManager.getAll()
      expect(config.development?.syncFiles).toBeDefined()
    })
  })

  describe('getConfigPath', () => {
    it('should return config file path', () => {
      // Confインスタンスのpathプロパティにアクセス
      const conf = (configManager as any).conf
      conf.path = '/path/to/config'

      const path = configManager.getConfigPath()
      expect(path).toBe('/path/to/config')
      expect(typeof path).toBe('string')
    })
  })

  describe('dot notation methods', () => {
    it('should get nested value using dot notation', () => {
      configManager.set('ui', { pathDisplay: 'relative' })

      // 新しいメソッドを使用
      const value = configManager.getConfigValue('ui.pathDisplay')
      expect(value).toBe('relative')
    })

    it('should get nested value from project config', async () => {
      const configData = {
        ui: { pathDisplay: 'relative' },
        development: { defaultEditor: 'vscode' },
      }

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(configData))
      await configManager.loadProjectConfig()

      expect(configManager.getConfigValue('ui.pathDisplay')).toBe('relative')
      expect(configManager.getConfigValue('development.defaultEditor')).toBe('vscode')
    })

    it('should return undefined for non-existent keys', () => {
      const value = configManager.getConfigValue('nonexistent.key')
      expect(value).toBeUndefined()
    })

    it('should set nested value using dot notation', async () => {
      await configManager.setConfigValue('ui.pathDisplay', 'relative')

      // プロジェクト設定ファイルに書き込まれたかチェック
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.maestro.json'),
        expect.stringContaining('"pathDisplay": "relative"'),
        'utf-8'
      )
    })

    it('should create nested structure when setting deep keys', async () => {
      await configManager.setConfigValue('github.branchNaming.prTemplate', 'pr-{number}-{title}')

      // ネストした構造が作成される
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.maestro.json'),
        expect.stringContaining('"github"'),
        'utf-8'
      )
    })

    it('should validate value when setting config', async () => {
      // バリデーションエラーが発生する場合
      await expect(
        configManager.setConfigValue('ui.pathDisplay', 'invalid-value')
      ).rejects.toThrow()
    })

    it('should reset config value and remove empty objects', async () => {
      // fsのモック設定を調整
      vi.mocked(fs.readFile).mockResolvedValueOnce('{"ui":{"pathDisplay":"relative"}}')
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      // リセット
      await configManager.resetConfigValue('ui.pathDisplay')

      // 空のオブジェクトが削除されることを確認
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.maestro.json'),
        expect.stringMatching(/^((?!ui).)*$/s), // uiキーを含まない
        'utf-8'
      )
    })

    it('should preserve other values when resetting', async () => {
      // fsのモック設定 - 複数の設定が存在する状態
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        '{"ui":{"pathDisplay":"relative"},"development":{"autoSetup":false}}'
      )
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      // 1つだけリセット
      await configManager.resetConfigValue('ui.pathDisplay')

      // 他の設定は保持される
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.maestro.json'),
        expect.stringContaining('"development"'),
        'utf-8'
      )
    })
  })

  describe('ConfigSchema validation', () => {
    it('should validate correct config', () => {
      const validConfig = {
        worktrees: {
          path: '.git/orchestrations',
          branchPrefix: 'feature/',
        },
        development: {
          autoSetup: true,
          syncFiles: ['.env', '.env.local'],
          defaultEditor: 'cursor' as const,
        },
        tmux: {
          enabled: true,
          openIn: 'window' as const,
        },
        ui: {
          pathDisplay: 'relative' as const,
        },
        github: {
          autoFetch: true,
          branchNaming: {
            prTemplate: 'pr-{number}-{title}',
            issueTemplate: 'issue-{number}-{title}',
          },
        },
        hooks: {
          afterCreate: 'npm install',
          beforeDelete: 'echo "Deleting worktree"',
        },
      }

      const result = ConfigSchema.safeParse(validConfig)
      expect(result.success).toBe(true)
    })

    it('should reject invalid editor type', () => {
      const invalidConfig = {
        development: {
          defaultEditor: 'sublime', // Not in enum
        },
      }

      const result = ConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })

    it('should use default values', () => {
      const minimalConfig = {
        development: {},
      }

      const result = ConfigSchema.parse(minimalConfig)
      expect(result.development?.autoSetup).toBe(true)
      expect(result.development?.syncFiles).toEqual(['.env', '.env.local'])
      expect(result.development?.defaultEditor).toBe('cursor')
    })

    it('should validate ui.pathDisplay settings', () => {
      const configWithAbsolute = {
        ui: {
          pathDisplay: 'absolute' as const,
        },
      }

      const configWithRelative = {
        ui: {
          pathDisplay: 'relative' as const,
        },
      }

      expect(ConfigSchema.safeParse(configWithAbsolute).success).toBe(true)
      expect(ConfigSchema.safeParse(configWithRelative).success).toBe(true)
    })

    it('should reject invalid pathDisplay values', () => {
      const invalidConfig = {
        ui: {
          pathDisplay: 'invalid' as any,
        },
      }

      const result = ConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })

    it('should use default pathDisplay value', () => {
      const result = ConfigSchema.parse({ ui: {} })
      expect(result.ui?.pathDisplay).toBe('absolute')
    })
  })
})

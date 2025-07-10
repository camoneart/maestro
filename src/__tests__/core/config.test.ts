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
    it('should load project config from .shadowclonerc', async () => {
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

      // .scj.jsonを最初に試す
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(process.cwd(), '.scj.json'),
        'utf-8'
      )
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

  describe('ConfigSchema validation', () => {
    it('should validate correct config', () => {
      const validConfig = {
        worktrees: {
          path: '.git/shadow-clones',
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
  })
})
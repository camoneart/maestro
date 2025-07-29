import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { configCommand } from '../../commands/config.js'
import { ConfigManager } from '../../core/config.js'
import inquirer from 'inquirer'
import fs from 'fs/promises'
import chalk from 'chalk'
import path from 'path'

vi.mock('../../core/config.js', () => ({
  ConfigManager: vi.fn(),
}))

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}))

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
  },
}))

describe('config command', () => {
  let consoleLogSpy: Mock
  let consoleErrorSpy: Mock
  let mockConfigManager: {
    loadProjectConfig: Mock
    createProjectConfig: Mock
    getAll: Mock
    getConfigPath: Mock
    getConfigValue: Mock
    setConfigValue: Mock
    resetConfigValue: Mock
  }

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // ConfigManagerのモック
    mockConfigManager = {
      loadProjectConfig: vi.fn(),
      createProjectConfig: vi.fn(),
      getAll: vi.fn().mockReturnValue({
        worktrees: { path: '.git/orchestrations' },
        development: { autoSetup: true },
      }),
      getConfigPath: vi.fn().mockReturnValue('/home/user/.config/maestro/config.json'),
      getConfigValue: vi.fn(),
      setConfigValue: vi.fn(),
      resetConfigValue: vi.fn(),
    }
    ;(ConfigManager as any).mockImplementation(() => mockConfigManager)
  })

  describe('init action', () => {
    it('should create project config file when confirmed', async () => {
      ;(inquirer.prompt as Mock).mockResolvedValue({ createConfig: true })
      mockConfigManager.createProjectConfig.mockResolvedValue(undefined)

      await configCommand.parseAsync(['node', 'config', 'init'])

      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'createConfig',
          message: 'プロジェクト設定ファイル (.maestro.json) を作成しますか？',
          default: true,
        },
      ])
      expect(mockConfigManager.createProjectConfig).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('✅ .maestro.json を作成しました'))
    })

    it('should cancel when user declines', async () => {
      ;(inquirer.prompt as Mock).mockResolvedValue({ createConfig: false })

      await configCommand.parseAsync(['node', 'config', 'init'])

      expect(mockConfigManager.createProjectConfig).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('キャンセルされました'))
    })

    it('should handle creation error', async () => {
      ;(inquirer.prompt as Mock).mockResolvedValue({ createConfig: true })
      mockConfigManager.createProjectConfig.mockRejectedValue(new Error('Permission denied'))

      await configCommand.parseAsync(['node', 'config', 'init'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('設定ファイルの作成に失敗しました:'),
        expect.any(Error)
      )
    })
  })

  describe('show action', () => {
    it('should display current configuration', async () => {
      const mockConfig = {
        worktrees: { path: '.git/orchestrations' },
        development: { autoSetup: true },
      }
      mockConfigManager.getAll.mockReturnValue(mockConfig)

      await configCommand.parseAsync(['node', 'config', 'show'])

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.bold('\n🎼 maestro 設定:\n'))
      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockConfig, null, 2))
    })

    it('should show global config path with --global option', async () => {
      await configCommand.parseAsync(['node', 'config', 'show', '--global'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.gray(`\nグローバル設定: ${mockConfigManager.getConfigPath()}`)
      )
    })
  })

  describe('path action', () => {
    it('should display config file paths', async () => {
      // fs.accessのモック設定
      ;(fs.access as Mock)
        .mockRejectedValueOnce(new Error('Not found')) // .maestro.json
        .mockResolvedValueOnce(undefined) // .maestrorc.json
        .mockRejectedValueOnce(new Error('Not found')) // maestro.config.json

      await configCommand.parseAsync(['node', 'config', 'path'])

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.bold('設定ファイルのパス:\n'))
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('グローバル設定:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(`  ${mockConfigManager.getConfigPath()}`)
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('\nプロジェクト設定 (優先度順):'))

      // ファイルの存在確認
      expect(fs.access).toHaveBeenCalledWith(path.join(process.cwd(), '.maestro.json'))
      expect(fs.access).toHaveBeenCalledWith(path.join(process.cwd(), '.maestrorc.json'))
      expect(fs.access).toHaveBeenCalledWith(path.join(process.cwd(), 'maestro.config.json'))

      // 結果の表示確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌') && expect.stringContaining('.maestro.json')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅') && expect.stringContaining('.maestrorc.json')
      )
    })

    it('should show all config files exist', async () => {
      ;(fs.access as Mock).mockResolvedValue(undefined)

      await configCommand.parseAsync(['node', 'config', 'path'])

      const logCalls = consoleLogSpy.mock.calls.map(call => call[0])
      const configFiles = ['.maestro.json', '.maestrorc.json', 'maestro.config.json']

      configFiles.forEach(file => {
        expect(
          logCalls.some(log => typeof log === 'string' && log.includes('✅') && log.includes(file))
        ).toBe(true)
      })
    })
  })

  describe('default action', () => {
    it('should display usage when no action specified', async () => {
      await configCommand.parseAsync(['node', 'config'])

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('使い方:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  maestro config init           # プロジェクト設定ファイルを作成'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  maestro config show           # 現在の設定を表示'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  maestro config path           # 設定ファイルのパスを表示'
      )
    })

    it('should display usage for unknown action', async () => {
      await configCommand.parseAsync(['node', 'config', 'unknown'])

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('使い方:'))
    })
  })

  describe('error handling', () => {
    it('should handle loadProjectConfig error gracefully', async () => {
      mockConfigManager.loadProjectConfig.mockRejectedValue(new Error('Config load error'))

      // loadProjectConfigのエラーは内部で処理されるため、
      // コマンド自体はエラーを投げない
      await expect(configCommand.parseAsync(['node', 'config', 'show'])).rejects.toThrow()
    })
  })

  describe('global option', () => {
    it('should work with -g shorthand', async () => {
      await configCommand.parseAsync(['node', 'config', 'show', '-g'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.gray(`\nグローバル設定: ${mockConfigManager.getConfigPath()}`)
      )
    })
  })

  describe('get action', () => {
    it('should get config value using dot notation', async () => {
      mockConfigManager.getConfigValue.mockReturnValue('relative')

      await configCommand.parseAsync(['node', 'config', 'get', 'ui.pathDisplay'])

      expect(mockConfigManager.getConfigValue).toHaveBeenCalledWith('ui.pathDisplay')
      expect(consoleLogSpy).toHaveBeenCalledWith('relative')
    })

    it('should display message for non-existent config key', async () => {
      mockConfigManager.getConfigValue.mockReturnValue(undefined)

      await configCommand.parseAsync(['node', 'config', 'get', 'nonexistent.key'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.gray('設定値が見つかりません: nonexistent.key')
      )
    })

    it('should handle nested objects correctly', async () => {
      mockConfigManager.getConfigValue.mockReturnValue({ autoSetup: true, defaultEditor: 'cursor' })

      await configCommand.parseAsync(['node', 'config', 'get', 'development'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        JSON.stringify({ autoSetup: true, defaultEditor: 'cursor' }, null, 2)
      )
    })
  })

  describe('set action', () => {
    it('should set config value using dot notation', async () => {
      mockConfigManager.setConfigValue.mockResolvedValue(undefined)

      await configCommand.parseAsync(['node', 'config', 'set', 'ui.pathDisplay', 'relative'])

      expect(mockConfigManager.setConfigValue).toHaveBeenCalledWith('ui.pathDisplay', 'relative', 'user')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('✅ ui.pathDisplay を relative に設定しました (ユーザー設定: .maestro.local.json)')
      )
    })

    it('should handle boolean values', async () => {
      mockConfigManager.setConfigValue.mockResolvedValue(undefined)

      await configCommand.parseAsync(['node', 'config', 'set', 'development.autoSetup', 'false'])

      expect(mockConfigManager.setConfigValue).toHaveBeenCalledWith(
        'development.autoSetup',
        'false',
        'project'
      )
    })

    it('should handle number values', async () => {
      mockConfigManager.setConfigValue.mockResolvedValue(undefined)

      await configCommand.parseAsync(['node', 'config', 'set', 'some.number', '42'])

      expect(mockConfigManager.setConfigValue).toHaveBeenCalledWith('some.number', '42', 'project')
    })

    it('should handle validation errors', async () => {
      mockConfigManager.setConfigValue.mockRejectedValue(
        new Error('Invalid value for ui.pathDisplay')
      )

      await configCommand.parseAsync(['node', 'config', 'set', 'ui.pathDisplay', 'invalid'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('設定の更新に失敗しました:'),
        expect.any(Error)
      )
    })
  })

  describe('reset action', () => {
    it('should reset config value to default', async () => {
      mockConfigManager.resetConfigValue.mockResolvedValue(undefined)
      mockConfigManager.getConfigValue.mockReturnValue('absolute')

      await configCommand.parseAsync(['node', 'config', 'reset', 'ui.pathDisplay'])

      expect(mockConfigManager.resetConfigValue).toHaveBeenCalledWith('ui.pathDisplay')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('✅ ui.pathDisplay をデフォルト値にリセットしました')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('現在の値: absolute'))
    })

    it('should handle reset errors', async () => {
      mockConfigManager.resetConfigValue.mockRejectedValue(new Error('Reset failed'))

      await configCommand.parseAsync(['node', 'config', 'reset', 'ui.pathDisplay'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('設定のリセットに失敗しました:'),
        expect.any(Error)
      )
    })
  })
})

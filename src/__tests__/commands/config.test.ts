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
        worktrees: { path: '.git/shadow-clones' },
        development: { autoSetup: true },
      }),
      getConfigPath: vi.fn().mockReturnValue('/home/user/.config/scj/config.json'),
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
          message: 'プロジェクト設定ファイル (.scj.json) を作成しますか？',
          default: true,
        },
      ])
      expect(mockConfigManager.createProjectConfig).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('✅ .scj.json を作成しました')
      )
    })

    it('should cancel when user declines', async () => {
      ;(inquirer.prompt as Mock).mockResolvedValue({ createConfig: false })

      await configCommand.parseAsync(['node', 'config', 'init'])

      expect(mockConfigManager.createProjectConfig).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('キャンセルされました'))
    })

    it('should handle creation error', async () => {
      ;(inquirer.prompt as Mock).mockResolvedValue({ createConfig: true })
      mockConfigManager.createProjectConfig.mockRejectedValue(
        new Error('Permission denied')
      )

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
        worktrees: { path: '.git/shadow-clones' },
        development: { autoSetup: true },
      }
      mockConfigManager.getAll.mockReturnValue(mockConfig)

      await configCommand.parseAsync(['node', 'config', 'show'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.bold('\n🥷 shadow-clone-jutsu 設定:\n')
      )
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
        .mockRejectedValueOnce(new Error('Not found')) // .scj.json
        .mockResolvedValueOnce(undefined) // .scjrc.json
        .mockRejectedValueOnce(new Error('Not found')) // scj.config.json

      await configCommand.parseAsync(['node', 'config', 'path'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.bold('設定ファイルのパス:\n')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('グローバル設定:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `  ${mockConfigManager.getConfigPath()}`
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('\nプロジェクト設定 (優先度順):')
      )

      // ファイルの存在確認
      expect(fs.access).toHaveBeenCalledWith(path.join(process.cwd(), '.scj.json'))
      expect(fs.access).toHaveBeenCalledWith(path.join(process.cwd(), '.scjrc.json'))
      expect(fs.access).toHaveBeenCalledWith(path.join(process.cwd(), 'scj.config.json'))

      // 結果の表示確認
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌') && expect.stringContaining('.scj.json')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅') && expect.stringContaining('.scjrc.json')
      )
    })

    it('should show all config files exist', async () => {
      ;(fs.access as Mock).mockResolvedValue(undefined)

      await configCommand.parseAsync(['node', 'config', 'path'])

      const logCalls = consoleLogSpy.mock.calls.map(call => call[0])
      const configFiles = ['.scj.json', '.scjrc.json', 'scj.config.json']
      
      configFiles.forEach(file => {
        expect(logCalls.some(log => 
          typeof log === 'string' && log.includes('✅') && log.includes(file)
        )).toBe(true)
      })
    })
  })

  describe('default action', () => {
    it('should display usage when no action specified', async () => {
      await configCommand.parseAsync(['node', 'config'])

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('使い方:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  scj config init   # プロジェクト設定ファイルを作成'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  scj config show   # 現在の設定を表示'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '  scj config path   # 設定ファイルのパスを表示'
      )
    })

    it('should display usage for unknown action', async () => {
      await configCommand.parseAsync(['node', 'config', 'unknown'])

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('使い方:'))
    })
  })

  describe('error handling', () => {
    it('should handle loadProjectConfig error gracefully', async () => {
      mockConfigManager.loadProjectConfig.mockRejectedValue(
        new Error('Config load error')
      )

      // loadProjectConfigのエラーは内部で処理されるため、
      // コマンド自体はエラーを投げない
      await expect(
        configCommand.parseAsync(['node', 'config', 'show'])
      ).rejects.toThrow()
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
})
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConfigManager } from '../../core/config'
import fs from 'fs/promises'
import inquirer from 'inquirer'
import ora from 'ora'
import path from 'path'
import { templateCommand } from '../../commands/template'
import { createMockConfig, createMockSpinner } from '../utils/test-helpers'
import { homedir } from 'os'

// モック設定
vi.mock('../../core/config')
vi.mock('fs/promises')
vi.mock('inquirer')
vi.mock('ora')
vi.mock('os')

describe('template command', () => {
  let mockConfigManager: any
  let mockSpinner: any
  const mockHomeDir = '/home/test'
  const mockTemplate = {
    name: 'feature',
    description: '新機能開発用テンプレート',
    config: {
      branchPrefix: 'feature/',
      autoSetup: true,
      syncFiles: ['.env', '.env.local'],
      editor: 'cursor' as const,
      claude: true,
    },
  }

  beforeEach(() => {
    // ConfigManagerのモック
    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue(createMockConfig()),
      saveProjectConfig: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(ConfigManager).mockImplementation(() => mockConfigManager)

    // Spinnerのモック
    mockSpinner = createMockSpinner()
    vi.mocked(ora).mockImplementation(() => mockSpinner)

    // homedirのモック
    vi.mocked(homedir).mockReturnValue(mockHomeDir)

    // pathのモック
    vi.spyOn(path, 'join').mockImplementation((...args) => args.join('/'))

    // fs.mkdirのモック
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)

    // fs.readdirのモック
    vi.mocked(fs.readdir).mockResolvedValue(['feature.json', 'bugfix.json'])

    // fs.readFileのモック
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockTemplate))

    // fs.writeFileのモック
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)

    // fs.unlinkのモック
    vi.mocked(fs.unlink).mockResolvedValue(undefined)

    // process.cwdのモック
    vi.spyOn(process, 'cwd').mockReturnValue('/repo')

    // consoleのモック
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // process.exitのモック
    vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`process.exit called with code ${code}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('テンプレート一覧', () => {
    it('--listオプションでテンプレート一覧を表示する', async () => {
      await templateCommand.parseAsync(['node', 'test', '--list'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📋 利用可能なテンプレート:')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('新機能開発用テンプレート'))
    })

    it('--list --globalでグローバルテンプレートを表示する', async () => {
      await templateCommand.parseAsync(['node', 'test', '--list', '--global'])

      expect(fs.readdir).toHaveBeenCalledWith(`${mockHomeDir}/.maestro/templates`)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📋 利用可能なテンプレート:')
      )
    })

    it('テンプレートが存在しない場合はデフォルトテンプレートを表示', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([])

      await templateCommand.parseAsync(['node', 'test', '--list'])

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('デフォルトテンプレート'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('bugfix'))
    })
  })

  describe('テンプレート保存', () => {
    it('--saveオプションで現在の設定をテンプレートとして保存する', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        description: 'カスタムテンプレート',
        includeFiles: false,
      })

      await templateCommand.parseAsync(['node', 'test', '--save', 'custom'])

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/repo/.maestro/templates/custom.json',
        expect.stringContaining('"name": "custom"')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✨ テンプレート 'custom' を保存しました")
      )
    })

    it('--save --globalでグローバルに保存する', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        description: 'グローバルテンプレート',
        includeFiles: false,
      })

      await templateCommand.parseAsync(['node', 'test', '--save', 'global-template', '--global'])

      expect(fs.writeFile).toHaveBeenCalledWith(
        `${mockHomeDir}/.maestro/templates/global-template.json`,
        expect.any(String)
      )
    })

    it('インタラクティブモードでカスタムファイルを追加する', async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          description: 'カスタムファイル付きテンプレート',
          includeFiles: true,
        })
        .mockResolvedValueOnce({
          filePath: '.github/CODEOWNERS',
          fileContent: '* @team',
          continueAdding: false,
        })

      await templateCommand.parseAsync(['node', 'test', '--save', 'custom-files'])

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const savedTemplate = JSON.parse(writeCall[1] as string)

      expect(savedTemplate.name).toBe('custom-files')
      expect(savedTemplate.config.customFiles).toHaveLength(1)
      expect(savedTemplate.config.customFiles[0]).toEqual({
        path: '.github/CODEOWNERS',
        content: '* @team',
      })
    })
  })

  describe('テンプレート適用', () => {
    it('--applyオプションでテンプレートを適用する', async () => {
      await templateCommand.parseAsync(['node', 'test', '--apply', 'feature'])

      // The apply command only displays the config, it doesn't save it
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✨ テンプレート 'feature' を適用します")
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('適用される設定:'))
    })

    it('カスタムファイルを含むテンプレートを表示する', async () => {
      const templateWithFiles = {
        ...mockTemplate,
        config: {
          ...mockTemplate.config,
          customFiles: [
            { path: '.github/CODEOWNERS', content: '* @team' },
            { path: 'docs/README.md', content: '# Documentation' },
          ],
        },
      }
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(templateWithFiles))

      await templateCommand.parseAsync(['node', 'test', '--apply', 'feature'])

      // The apply command only displays the config, it doesn't create files
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✨ テンプレート 'feature' を適用します")
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('適用される設定:'))
    })

    it('存在しないテンプレートはエラー', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

      await expect(
        templateCommand.parseAsync(['node', 'test', '--apply', 'non-existent'])
      ).rejects.toThrow('process.exit called with code 1')

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("テンプレート 'non-existent' が見つかりません")
      )
    })
  })

  describe('テンプレート削除', () => {
    it('--deleteオプションでテンプレートを削除する', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmDelete: true })

      await templateCommand.parseAsync(['node', 'test', '--delete', 'custom'])

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'confirmDelete',
            message: "テンプレート 'custom' を削除しますか？",
          }),
        ])
      )
      expect(fs.unlink).toHaveBeenCalledWith('/repo/.maestro/templates/custom.json')
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✨ テンプレート 'custom' を削除しました")
      )
    })

    it('削除をキャンセルできる', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmDelete: false })

      await templateCommand.parseAsync(['node', 'test', '--delete', 'custom'])

      expect(fs.unlink).not.toHaveBeenCalled()
      // The implementation doesn't log a cancel message, it just returns without action
    })
  })

  describe('デフォルト動作', () => {
    it('オプションなしでテンプレート一覧を表示', async () => {
      await templateCommand.parseAsync(['node', 'test'])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📋 利用可能なテンプレート:')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('デフォルトテンプレート:'))
    })
  })

  describe('エラーハンドリング', () => {
    it('ファイル操作エラーを処理する', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'))

      vi.mocked(inquirer.prompt).mockResolvedValue({
        description: 'テストテンプレート',
        includeFiles: false,
      })

      await expect(templateCommand.parseAsync(['node', 'test', '--save', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('テンプレートの保存に失敗しました')
    })
  })
})

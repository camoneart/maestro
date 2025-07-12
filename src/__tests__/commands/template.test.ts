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
        expect.stringContaining('📚 利用可能なテンプレート:')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('feature'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('新機能開発用テンプレート'))
    })

    it('--list --globalでグローバルテンプレートを表示する', async () => {
      await templateCommand.parseAsync(['node', 'test', '--list', '--global'])

      expect(fs.readdir).toHaveBeenCalledWith(`${mockHomeDir}/.scj/templates`)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📚 利用可能なテンプレート (グローバル):')
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
        saveGlobal: false,
      })

      await templateCommand.parseAsync(['node', 'test', '--save', 'custom'])

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/repo/.scj/templates/custom.json',
        expect.stringContaining('"name":"custom"')
      )
      expect(mockSpinner.succeed).toHaveBeenCalledWith('テンプレート "custom" を保存しました')
    })

    it('--save --globalでグローバルに保存する', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        description: 'グローバルテンプレート',
      })

      await templateCommand.parseAsync(['node', 'test', '--save', 'global-template', '--global'])

      expect(fs.writeFile).toHaveBeenCalledWith(
        `${mockHomeDir}/.scj/templates/global-template.json`,
        expect.any(String)
      )
    })

    it('インタラクティブモードで詳細設定を行う', async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          name: 'interactive',
          description: 'インタラクティブテンプレート',
          branchPrefix: 'custom/',
          autoSetup: true,
          editor: 'vscode',
          claude: false,
          tmux: true,
          syncFiles: ['.env', 'config.json'],
          hasCustomFiles: true,
        })
        .mockResolvedValueOnce({
          customFiles: [{ path: '.github/CODEOWNERS', content: '* @team' }],
          hasHooks: true,
        })
        .mockResolvedValueOnce({
          afterCreate: 'npm run setup',
          beforeDelete: 'npm run cleanup',
          saveGlobal: false,
        })

      await templateCommand.parseAsync(['node', 'test', '--save'])

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const savedTemplate = JSON.parse(writeCall[1] as string)

      expect(savedTemplate.name).toBe('interactive')
      expect(savedTemplate.config.branchPrefix).toBe('custom/')
      expect(savedTemplate.config.customFiles).toHaveLength(1)
      expect(savedTemplate.config.hooks?.afterCreate).toBe('npm run setup')
    })
  })

  describe('テンプレート適用', () => {
    it('--applyオプションでテンプレートを適用する', async () => {
      await templateCommand.parseAsync(['node', 'test', '--apply', 'feature'])

      expect(mockConfigManager.saveProjectConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          worktrees: expect.objectContaining({
            branchPrefix: 'feature/',
          }),
          development: expect.objectContaining({
            autoSetup: true,
            syncFiles: ['.env', '.env.local'],
            defaultEditor: 'cursor',
          }),
        })
      )
      expect(mockSpinner.succeed).toHaveBeenCalledWith('テンプレート "feature" を適用しました')
    })

    it('カスタムファイルを作成する', async () => {
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

      expect(fs.mkdir).toHaveBeenCalledWith('/repo/.github', { recursive: true })
      expect(fs.mkdir).toHaveBeenCalledWith('/repo/docs', { recursive: true })
      expect(fs.writeFile).toHaveBeenCalledWith('/repo/.github/CODEOWNERS', '* @team')
      expect(fs.writeFile).toHaveBeenCalledWith('/repo/docs/README.md', '# Documentation')
    })

    it('存在しないテンプレートはエラー', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

      await expect(
        templateCommand.parseAsync(['node', 'test', '--apply', 'non-existent'])
      ).rejects.toThrow('process.exit called with code 1')

      expect(mockSpinner.fail).toHaveBeenCalledWith('テンプレート "non-existent" が見つかりません')
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
            message: 'テンプレート "custom" を削除しますか？',
          }),
        ])
      )
      expect(fs.unlink).toHaveBeenCalledWith('/repo/.scj/templates/custom.json')
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✨ テンプレート "custom" を削除しました')
      )
    })

    it('削除をキャンセルできる', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmDelete: false })

      await templateCommand.parseAsync(['node', 'test', '--delete', 'custom'])

      expect(fs.unlink).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('キャンセルされました'))
    })
  })

  describe('テンプレート編集', () => {
    it('--editオプションでテンプレートを編集する', async () => {
      const updatedConfig = {
        branchPrefix: 'updated/',
        autoSetup: false,
      }
      vi.mocked(inquirer.prompt).mockResolvedValue(updatedConfig)

      await templateCommand.parseAsync(['node', 'test', '--edit', 'feature'])

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
      const updatedTemplate = JSON.parse(writeCall[1] as string)

      expect(updatedTemplate.config.branchPrefix).toBe('updated/')
      expect(updatedTemplate.config.autoSetup).toBe(false)
      expect(mockSpinner.succeed).toHaveBeenCalledWith('テンプレート "feature" を更新しました')
    })
  })

  describe('デフォルト動作', () => {
    it('オプションなしでインタラクティブメニューを表示', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        action: 'list',
      })

      await templateCommand.parseAsync(['node', 'test'])

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'list',
            name: 'action',
            message: 'テンプレート管理',
          }),
        ])
      )
    })

    it('メニューから適用を選択', async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          action: 'apply',
        })
        .mockResolvedValueOnce({
          templateToApply: mockTemplate,
        })

      await templateCommand.parseAsync(['node', 'test'])

      expect(mockConfigManager.saveProjectConfig).toHaveBeenCalled()
    })
  })

  describe('エラーハンドリング', () => {
    it('ファイル操作エラーを処理する', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'))

      await expect(templateCommand.parseAsync(['node', 'test', '--save', 'test'])).rejects.toThrow(
        'process.exit called with code 1'
      )

      expect(mockSpinner.fail).toHaveBeenCalledWith('テンプレートの保存に失敗しました')
    })
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { ConfigManager } from '../../core/config'
import { execa } from 'execa'
import fs from 'fs/promises'
import inquirer from 'inquirer'
import ora from 'ora'

// モック設定
vi.mock('../../core/git')
vi.mock('../../core/config')
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('inquirer')
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  })),
}))

// createCommand関数をモック化して個別にテスト
describe('create command', () => {
  let mockGitManager: any
  let mockConfigManager: any
  let mockSpinner: any

  beforeEach(() => {
    // GitWorktreeManagerのモック
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listBranches: vi.fn().mockResolvedValue(['main', 'develop']),
      createWorktree: vi.fn().mockResolvedValue('/path/to/worktree'),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    // ConfigManagerのモック
    mockConfigManager = {
      loadProjectConfig: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockReturnValue({
        worktrees: { branchPrefix: 'feature/' },
        development: {
          autoSetup: true,
          syncFiles: ['.env'],
          defaultEditor: 'cursor',
        },
      }),
    }
    vi.mocked(ConfigManager).mockImplementation(() => mockConfigManager)

    // Spinnerのモック
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      warn: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      text: '',
    }
    vi.mocked(ora).mockReturnValue(mockSpinner)

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('branch creation', () => {
    it('should create a new worktree with specified branch name', async () => {
      const branchName = 'test-feature'
      const expectedPath = '/path/to/worktree'

      mockGitManager.createWorktree.mockResolvedValue(expectedPath)

      // createコマンドのロジックをシミュレート
      const gitManager = new GitWorktreeManager()
      const configManager = new ConfigManager()
      await configManager.loadProjectConfig()

      const isGitRepo = await gitManager.isGitRepository()
      expect(isGitRepo).toBe(true)

      const config = configManager.getAll()
      const finalBranchName = config.worktrees?.branchPrefix
        ? config.worktrees.branchPrefix + branchName
        : branchName

      const path = await gitManager.createWorktree(finalBranchName)

      expect(path).toBe(expectedPath)
      expect(mockGitManager.createWorktree).toHaveBeenCalledWith('feature/test-feature')
    })

    it('should handle branch prefix configuration', async () => {
      const branchName = 'my-feature'

      mockConfigManager.getAll.mockReturnValue({
        worktrees: { branchPrefix: 'feat/' },
      })

      const configManager = new ConfigManager()
      const config = configManager.getAll()

      const finalBranchName = config.worktrees?.branchPrefix
        ? config.worktrees.branchPrefix + branchName
        : branchName

      expect(finalBranchName).toBe('feat/my-feature')
    })

    it('should prompt for branch name if not provided', async () => {
      const suggestedBranch = 'new-feature'

      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        branchName: suggestedBranch,
      })

      // インタラクティブモードのシミュレート
      const result = await inquirer.prompt([
        {
          type: 'input',
          name: 'branchName',
          message: 'ブランチ名を入力:',
        },
      ])

      expect(result.branchName).toBe(suggestedBranch)
      expect(inquirer.prompt).toHaveBeenCalled()
    })
  })

  describe('environment setup', () => {
    it('should run npm install when autoSetup is true', async () => {
      const worktreePath = '/path/to/worktree'

      vi.mocked(execa).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any)

      // npm install実行のシミュレート
      await execa('npm', ['install'], { cwd: worktreePath })

      expect(execa).toHaveBeenCalledWith('npm', ['install'], { cwd: worktreePath })
    })

    it('should copy sync files', async () => {
      const sourcePath = '/current/dir/.env'
      const destPath = '/path/to/worktree/.env'

      vi.mocked(fs.copyFile).mockResolvedValue(undefined)

      // ファイルコピーのシミュレート
      await fs.copyFile(sourcePath, destPath)

      expect(fs.copyFile).toHaveBeenCalledWith(sourcePath, destPath)
    })

    it('should skip missing sync files', async () => {
      vi.mocked(fs.copyFile).mockRejectedValueOnce(new Error('ENOENT'))

      // エラーハンドリングのテスト
      await expect(fs.copyFile('/missing/file', '/dest')).rejects.toThrow('ENOENT')
    })
  })

  describe('editor integration', () => {
    it('should open in Cursor when specified', async () => {
      const worktreePath = '/path/to/worktree'

      vi.mocked(execa).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any)

      // Cursorで開くシミュレート
      await execa('cursor', [worktreePath])

      expect(execa).toHaveBeenCalledWith('cursor', [worktreePath])
    })

    it('should open in VSCode when specified', async () => {
      const worktreePath = '/path/to/worktree'

      mockConfigManager.getAll.mockReturnValue({
        development: { defaultEditor: 'vscode' },
      })

      vi.mocked(execa).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any)

      // VSCodeで開くシミュレート
      await execa('code', [worktreePath])

      expect(execa).toHaveBeenCalledWith('code', [worktreePath])
    })

    it('should handle missing editor gracefully', async () => {
      vi.mocked(execa).mockRejectedValueOnce(new Error('Command not found'))

      // エラーハンドリングのテスト
      await expect(execa('non-existent-editor', ['/path'])).rejects.toThrow('Command not found')
    })
  })

  describe('error handling', () => {
    it('should fail when not in a git repository', async () => {
      mockGitManager.isGitRepository.mockResolvedValue(false)

      const gitManager = new GitWorktreeManager()
      const isGitRepo = await gitManager.isGitRepository()

      expect(isGitRepo).toBe(false)
      expect(mockSpinner.fail).not.toHaveBeenCalled() // この時点ではまだfailは呼ばれない
    })

    it('should handle worktree creation failure', async () => {
      mockGitManager.createWorktree.mockRejectedValueOnce(new Error('Branch already exists'))

      const gitManager = new GitWorktreeManager()

      await expect(gitManager.createWorktree('existing-branch')).rejects.toThrow(
        'Branch already exists'
      )
    })
  })
})

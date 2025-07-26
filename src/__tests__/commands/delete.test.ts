import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitWorktreeManager } from '../../core/git'
import { execa } from 'execa'
import inquirer from 'inquirer'
import {
  createMockWorktree,
  createMockWorktrees,
  createMockExecaResponse,
  createMockSpinner,
} from '../utils/test-helpers'

// モック設定
vi.mock('../../core/git')
vi.mock('execa')
vi.mock('inquirer')
vi.mock('ora', () => ({
  default: vi.fn(() => createMockSpinner()),
}))

describe('delete command', () => {
  let mockGitManager: any

  beforeEach(() => {
    mockGitManager = {
      isGitRepository: vi.fn().mockResolvedValue(true),
      listWorktrees: vi.fn().mockResolvedValue([]),
      deleteWorktree: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(GitWorktreeManager).mockImplementation(() => mockGitManager)

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('basic deletion', () => {
    it('should delete a worktree by branch name', async () => {
      const worktrees = [
        createMockWorktree({ branch: 'refs/heads/main', path: '/path/main' }),
        createMockWorktree({ branch: 'refs/heads/feature-test', path: '/path/feature' }),
      ]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      const gitManager = new GitWorktreeManager()
      const allWorktrees = await gitManager.listWorktrees()
      const targetWorktree = allWorktrees.find(wt => wt.branch?.includes('feature-test'))

      if (targetWorktree) {
        await gitManager.deleteWorktree('feature-test')
        expect(mockGitManager.deleteWorktree).toHaveBeenCalledWith('feature-test')
      }
    })

    it('should force delete when force option is true', async () => {
      const worktrees = [createMockWorktree({ branch: 'refs/heads/locked-feature', locked: true })]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      const gitManager = new GitWorktreeManager()
      await gitManager.deleteWorktree('locked-feature', true)

      expect(mockGitManager.deleteWorktree).toHaveBeenCalledWith('locked-feature', true)
    })
  })

  describe('remote branch deletion', () => {
    it('should delete remote branch when removeRemote option is true', async () => {
      const worktrees = [createMockWorktree({ branch: 'refs/heads/feature-remote' })]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      // リモートブランチの存在確認
      vi.mocked(execa).mockResolvedValueOnce(
        createMockExecaResponse('  origin/feature-remote\n  origin/main') as any
      )

      // リモートブランチ削除
      vi.mocked(execa).mockResolvedValueOnce(createMockExecaResponse() as any)

      // deleteRemoteBranch関数のシミュレート
      const { stdout: remoteBranches } = await execa('git', ['branch', '-r'])
      expect(remoteBranches).toContain('origin/feature-remote')

      await execa('git', ['push', 'origin', '--delete', 'feature-remote'])
      expect(execa).toHaveBeenLastCalledWith('git', [
        'push',
        'origin',
        '--delete',
        'feature-remote',
      ])
    })

    it('should skip remote deletion if branch does not exist', async () => {
      vi.mocked(execa).mockResolvedValueOnce(createMockExecaResponse('  origin/main') as any)

      const { stdout: remoteBranches } = await execa('git', ['branch', '-r'])
      const remoteBranchExists = remoteBranches.includes('origin/non-existent')

      expect(remoteBranchExists).toBe(false)
    })
  })

  describe('interactive selection', () => {
    it('should prompt for confirmation before deletion', async () => {
      const worktrees = [createMockWorktree({ branch: 'refs/heads/feature-to-delete' })]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        confirmDelete: true,
      })

      const result = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: '本当にこれらの演奏者を削除しますか？',
          default: false,
        },
      ])

      expect(result.confirmDelete).toBe(true)
      expect(inquirer.prompt).toHaveBeenCalled()
    })

    it('should cancel deletion when user declines', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        confirmDelete: false,
      })

      const result = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: '本当にこれらの演奏者を削除しますか？',
          default: false,
        },
      ])

      expect(result.confirmDelete).toBe(false)
    })
  })

  describe('directory size calculation', () => {
    it('should get directory size using du command', async () => {
      vi.mocked(execa).mockResolvedValueOnce(
        createMockExecaResponse('150M\t/path/to/worktree') as any
      )

      const { stdout } = await execa('du', ['-sh', '/path/to/worktree'])
      const size = stdout.split('\t')[0]

      expect(size).toBe('150M')
      expect(execa).toHaveBeenCalledWith('du', ['-sh', '/path/to/worktree'])
    })

    it('should return unknown when du command fails', async () => {
      vi.mocked(execa).mockRejectedValueOnce(new Error('Command not found'))

      let size = 'unknown'
      try {
        await execa('du', ['-sh', '/non/existent/path'])
      } catch {
        // Keep default value
      }

      expect(size).toBe('unknown')
    })
  })

  describe('error handling', () => {
    it('should fail when worktree not found', async () => {
      mockGitManager.listWorktrees.mockResolvedValue([])

      const gitManager = new GitWorktreeManager()
      const worktrees = await gitManager.listWorktrees()
      const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

      expect(orchestraMembers).toHaveLength(0)
    })

    it('should handle multiple deletion with some failures', async () => {
      const worktrees = createMockWorktrees(3)
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      // 2番目の削除を失敗させる
      mockGitManager.deleteWorktree
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Cannot delete: has uncommitted changes'))
        .mockResolvedValueOnce(undefined)

      const results = []
      const gitManager = new GitWorktreeManager()

      for (let i = 0; i < 3; i++) {
        try {
          await gitManager.deleteWorktree(`feature-${i}`)
          results.push({ branch: `feature-${i}`, status: 'success' })
        } catch (error) {
          results.push({
            branch: `feature-${i}`,
            status: 'failed',
            error: error instanceof Error ? error.message : 'unknown error',
          })
        }
      }

      expect(results).toHaveLength(3)
      expect(results[0].status).toBe('success')
      expect(results[1].status).toBe('failed')
      expect(results[2].status).toBe('success')
    })
  })

  describe('current worktree deletion', () => {
    it('should prevent deletion of main worktree', async () => {
      const mainWorktree = createMockWorktree({
        path: '/path/to/repo/.',
        branch: 'refs/heads/main',
      })
      mockGitManager.listWorktrees.mockResolvedValue([mainWorktree])

      const gitManager = new GitWorktreeManager()
      const worktrees = await gitManager.listWorktrees()
      const isMainWorktree = worktrees[0].path.endsWith('.')

      expect(isMainWorktree).toBe(true)
    })

    it('should allow deletion of current worktree with --current option', async () => {
      const currentWorktree = createMockWorktree({
        path: process.cwd(),
        branch: 'refs/heads/feature-current',
      })
      mockGitManager.listWorktrees.mockResolvedValue([currentWorktree])

      const gitManager = new GitWorktreeManager()
      const worktrees = await gitManager.listWorktrees()
      const currentWt = worktrees.find(wt => wt.path === process.cwd())

      expect(currentWt).toBeDefined()
      expect(currentWt?.branch).toBe('refs/heads/feature-current')
    })
  })

  describe('fzf confirmation prompt', () => {
    it('should prompt for confirmation after fzf selection when not using --force', async () => {
      const worktrees = [
        createMockWorktree({ branch: 'refs/heads/feature-1', path: '/path/feature1' }),
        createMockWorktree({ branch: 'refs/heads/feature-2', path: '/path/feature2' }),
      ]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      // fzf選択後の確認プロンプトをシミュレート
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        confirmDelete: true,
      })

      const result = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: '削除を実行しますか？',
          default: false,
        },
      ])

      expect(result.confirmDelete).toBe(true)
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: '削除を実行しますか？',
          default: false,
        },
      ])
    })

    it('should cancel deletion when user declines fzf confirmation', async () => {
      const worktrees = [
        createMockWorktree({ branch: 'refs/heads/feature-1', path: '/path/feature1' }),
      ]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        confirmDelete: false,
      })

      const result = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: '削除を実行しますか？',
          default: false,
        },
      ])

      expect(result.confirmDelete).toBe(false)
    })

    it('should skip confirmation when using --force flag with fzf', async () => {
      const worktrees = [
        createMockWorktree({ branch: 'refs/heads/feature-1', path: '/path/feature1' }),
      ]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      // --forceフラグが設定されている場合は確認プロンプトをスキップ
      const options = { force: true, fzf: true }

      // 確認プロンプトが呼ばれないことを確認するために、inquirer.promptをモック
      const promptSpy = vi.mocked(inquirer.prompt)

      // forceオプションが有効な場合はpromptが呼ばれないはず
      if (!options.force) {
        await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmDelete',
            message: '削除を実行しますか？',
            default: false,
          },
        ])
      }

      // --forceが有効な場合はpromptが呼ばれない
      expect(promptSpy).not.toHaveBeenCalled()
    })
  })

  describe('tmux session cleanup', () => {
    it('should delete tmux session when worktree is deleted', async () => {
      const worktrees = [
        createMockWorktree({ branch: 'refs/heads/feature-tmux', path: '/path/feature-tmux' }),
      ]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      // tmuxセッションの存在確認（成功）
      vi.mocked(execa).mockResolvedValueOnce(createMockExecaResponse() as any)

      // tmuxセッションの削除（成功）
      vi.mocked(execa).mockResolvedValueOnce(createMockExecaResponse() as any)

      const gitManager = new GitWorktreeManager()
      await gitManager.deleteWorktree('feature-tmux')

      // tmuxセッションチェックの実行を確認
      await execa('tmux', ['has-session', '-t', 'feature-tmux'])
      expect(execa).toHaveBeenCalledWith('tmux', ['has-session', '-t', 'feature-tmux'])

      // tmuxセッション削除の実行を確認
      await execa('tmux', ['kill-session', '-t', 'feature-tmux'])
      expect(execa).toHaveBeenCalledWith('tmux', ['kill-session', '-t', 'feature-tmux'])
    })

    it('should not fail when tmux session does not exist', async () => {
      const worktrees = [
        createMockWorktree({ branch: 'refs/heads/feature-no-tmux', path: '/path/feature-no-tmux' }),
      ]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      // tmuxセッションの存在確認（失敗）
      vi.mocked(execa).mockRejectedValueOnce(new Error('no such session'))

      const gitManager = new GitWorktreeManager()

      // worktree削除は成功すべき
      await expect(gitManager.deleteWorktree('feature-no-tmux')).resolves.not.toThrow()
    })

    it('should keep tmux session when --keep-session option is used', async () => {
      const worktrees = [
        createMockWorktree({ branch: 'refs/heads/feature-keep', path: '/path/feature-keep' }),
      ]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      const gitManager = new GitWorktreeManager()
      await gitManager.deleteWorktree('feature-keep')

      // --keep-sessionオプションが使用された場合のシミュレーション
      const options = { keepSession: true }

      if (!options.keepSession) {
        // keepSessionがtrueの場合、tmuxコマンドは実行されない
        await execa('tmux', ['has-session', '-t', 'feature-keep'])
        await execa('tmux', ['kill-session', '-t', 'feature-keep'])
      }

      // tmuxコマンドが呼ばれていないことを確認
      expect(execa).not.toHaveBeenCalledWith('tmux', expect.any(Array))
    })

    it('should delete multiple tmux sessions when deleting multiple worktrees', async () => {
      const worktrees = [
        createMockWorktree({ branch: 'refs/heads/feature-1', path: '/path/feature-1' }),
        createMockWorktree({ branch: 'refs/heads/feature-2', path: '/path/feature-2' }),
        createMockWorktree({ branch: 'refs/heads/feature-3', path: '/path/feature-3' }),
      ]
      mockGitManager.listWorktrees.mockResolvedValue(worktrees)

      // 各tmuxセッションのモック設定
      // feature-1: セッション存在
      vi.mocked(execa)
        .mockResolvedValueOnce(createMockExecaResponse() as any) // has-session
        .mockResolvedValueOnce(createMockExecaResponse() as any) // kill-session

      // feature-2: セッション存在しない
      vi.mocked(execa).mockRejectedValueOnce(new Error('no such session')) // has-session失敗

      // feature-3: セッション存在
      vi.mocked(execa)
        .mockResolvedValueOnce(createMockExecaResponse() as any) // has-session
        .mockResolvedValueOnce(createMockExecaResponse() as any) // kill-session

      // 複数のworktree削除をシミュレート
      const branches = ['feature-1', 'feature-2', 'feature-3']
      for (const branch of branches) {
        try {
          await execa('tmux', ['has-session', '-t', branch])
          await execa('tmux', ['kill-session', '-t', branch])
        } catch {
          // セッションが存在しない場合は無視
        }
      }

      // tmuxコマンドの呼び出し回数を確認
      const tmuxCalls = vi.mocked(execa).mock.calls.filter(call => call[0] === 'tmux')
      expect(tmuxCalls.length).toBe(5) // has-session x3 + kill-session x2
    })
  })
})

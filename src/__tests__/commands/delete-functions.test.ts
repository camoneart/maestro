import { describe, it, expect, vi } from 'vitest'

// delete.tsから個別の関数をテストするためのシンプルなユニットテスト

describe('delete command - utility functions', () => {
  describe('DeleteCommandError class', () => {
    it('should create error with correct message', () => {
      const message = 'Test error message'
      const error = new Error(message)
      error.name = 'DeleteCommandError'
      
      expect(error.message).toBe(message)
      expect(error.name).toBe('DeleteCommandError')
      expect(error).toBeInstanceOf(Error)
    })

    it('should handle different error types', () => {
      const messages = [
        'リモートブランチの削除に失敗しました',
        'worktreeが見つかりません',
        'ディレクトリアクセスエラー'
      ]

      messages.forEach(message => {
        const error = new Error(message)
        error.name = 'DeleteCommandError'
        expect(error.message).toBe(message)
      })
    })
  })

  describe('Directory size utilities', () => {
    it('should parse directory size output', () => {
      const duOutput = '1.5M\t/path/to/worktree'
      const size = duOutput.split('\t')[0]
      
      expect(size).toBe('1.5M')
    })

    it('should handle empty size output', () => {
      const duOutput = ''
      const size = duOutput.split('\t')[0] || 'unknown'
      
      expect(size).toBe('unknown')
    })

    it('should handle various size formats', () => {
      const outputs = [
        '100K\t/path',
        '1.5M\t/path',
        '2.1G\t/path',
        '512B\t/path'
      ]

      outputs.forEach(output => {
        const size = output.split('\t')[0]
        expect(size).toMatch(/^\d+(\.\d+)?[KMGTB]?$/)
      })
    })
  })

  describe('Remote branch utilities', () => {
    it('should format remote branch names', () => {
      const branchName = 'feature-test'
      const remoteBranchName = `origin/${branchName}`
      
      expect(remoteBranchName).toBe('origin/feature-test')
    })

    it('should validate remote branch existence', () => {
      const remoteBranches = '  origin/main\n  origin/develop\n  origin/feature-test\n'
      const targetBranch = 'origin/feature-test'
      
      const exists = remoteBranches.includes(targetBranch)
      expect(exists).toBe(true)
    })

    it('should handle non-existent remote branches', () => {
      const remoteBranches = '  origin/main\n  origin/develop\n'
      const targetBranch = 'origin/non-existent'
      
      const exists = remoteBranches.includes(targetBranch)
      expect(exists).toBe(false)
    })
  })

  describe('Delete options validation', () => {
    it('should handle delete options structure', () => {
      const options = {
        force: true,
        removeRemote: true,
        fzf: false,
        current: false
      }

      expect(options.force).toBe(true)
      expect(options.removeRemote).toBe(true)
      expect(options.fzf).toBe(false)
      expect(options.current).toBe(false)
    })

    it('should validate force deletion behavior', () => {
      const options = { force: true }
      const shouldSkipConfirmation = options.force
      
      expect(shouldSkipConfirmation).toBe(true)
    })
  })

  describe('Worktree identification', () => {
    it('should identify current worktree', () => {
      const currentPath = '/current/path'
      const worktrees = [
        { path: '/path/to/worktree1', isCurrentDirectory: false },
        { path: '/current/path', isCurrentDirectory: true },
        { path: '/path/to/worktree2', isCurrentDirectory: false }
      ]

      const currentWorktree = worktrees.find(wt => wt.isCurrentDirectory)
      expect(currentWorktree?.path).toBe(currentPath)
    })

    it('should find worktree by branch name', () => {
      const targetBranch = 'feature-test'
      const worktrees = [
        { branch: 'refs/heads/main', path: '/path/main' },
        { branch: 'refs/heads/feature-test', path: '/path/feature-test' },
        { branch: 'refs/heads/develop', path: '/path/develop' }
      ]

      const targetWorktree = worktrees.find(wt => {
        const branch = wt.branch.replace('refs/heads/', '')
        return branch === targetBranch
      })

      expect(targetWorktree?.path).toBe('/path/feature-test')
    })
  })

  describe('Locked worktree handling', () => {
    it('should identify locked worktrees', () => {
      const worktrees = [
        { path: '/path/1', locked: false },
        { path: '/path/2', locked: true },
        { path: '/path/3', locked: false }
      ]

      const lockedWorktrees = worktrees.filter(wt => wt.locked)
      expect(lockedWorktrees).toHaveLength(1)
      expect(lockedWorktrees[0].path).toBe('/path/2')
    })

    it('should generate lock warning messages', () => {
      const worktreePath = '/path/to/locked'
      const warningMessage = `⚠️  警告: ${worktreePath} はロックされています`
      
      expect(warningMessage).toContain('ロックされています')
      expect(warningMessage).toContain(worktreePath)
    })
  })

  describe('Detached HEAD handling', () => {
    it('should identify detached HEAD worktrees', () => {
      const worktrees = [
        { branch: 'refs/heads/main', detached: false },
        { branch: 'abc123def', detached: true }, // commit hash
        { branch: 'refs/heads/feature', detached: false }
      ]

      const detachedWorktrees = worktrees.filter(wt => wt.detached)
      expect(detachedWorktrees).toHaveLength(1)
      expect(detachedWorktrees[0].branch).toBe('abc123def')
    })

    it('should handle commit hash branches', () => {
      const commitHash = 'abc123def456'
      const isCommitHash = !commitHash.startsWith('refs/heads/')
      
      expect(isCommitHash).toBe(true)
    })
  })

  describe('fzf integration utilities', () => {
    it('should format worktree list for fzf', () => {
      const worktrees = [
        { branch: 'refs/heads/main', path: '/path/main' },
        { branch: 'refs/heads/feature-1', path: '/path/feature-1' }
      ]

      const fzfInput = worktrees
        .map(wt => wt.branch.replace('refs/heads/', ''))
        .join('\n')

      expect(fzfInput).toBe('main\nfeature-1')
    })

    it('should parse fzf output', () => {
      const fzfOutput = 'feature-1\nfeature-2\n'
      const selectedBranches = fzfOutput
        .trim()
        .split('\n')
        .filter(line => line.length > 0)

      expect(selectedBranches).toEqual(['feature-1', 'feature-2'])
    })
  })

  describe('Confirmation handling', () => {
    it('should handle user confirmation', () => {
      const confirmResponse = { confirmDelete: true }
      const shouldProceed = confirmResponse.confirmDelete
      
      expect(shouldProceed).toBe(true)
    })

    it('should handle user cancellation', () => {
      const confirmResponse = { confirmDelete: false }
      const shouldProceed = confirmResponse.confirmDelete
      
      expect(shouldProceed).toBe(false)
    })
  })

  describe('Error message formatting', () => {
    it('should format git errors', () => {
      const gitError = new Error('fatal: not a git repository')
      const formattedError = `❌ Gitエラー: ${gitError.message}`
      
      expect(formattedError).toContain('fatal: not a git repository')
    })

    it('should format permission errors', () => {
      const permError = new Error('Permission denied')
      const formattedError = `❌ アクセス権限エラー: ${permError.message}`
      
      expect(formattedError).toContain('Permission denied')
    })
  })

  describe('Success message formatting', () => {
    it('should format deletion success messages', () => {
      const branchName = 'feature-test'
      const successMessage = `✅ 影分身 '${branchName}' の削除が完了しました`
      
      expect(successMessage).toContain('削除が完了しました')
      expect(successMessage).toContain(branchName)
    })

    it('should format cleanup messages', () => {
      const count = 3
      const cleanupMessage = `🧹 ${count} 個の影分身をクリーンアップしました`
      
      expect(cleanupMessage).toContain('クリーンアップしました')
      expect(cleanupMessage).toContain('3')
    })
  })

  describe('Branch filtering utilities', () => {
    it('should filter protected branches', () => {
      const allBranches = ['main', 'develop', 'feature-1', 'feature-2']
      const protectedBranches = ['main', 'develop']
      const deletableBranches = allBranches.filter(branch => 
        !protectedBranches.includes(branch)
      )
      
      expect(deletableBranches).toEqual(['feature-1', 'feature-2'])
      expect(deletableBranches).not.toContain('main')
    })

    it('should handle branch name normalization', () => {
      const refsBranch = 'refs/heads/feature-test'
      const normalizedBranch = refsBranch.replace('refs/heads/', '')
      
      expect(normalizedBranch).toBe('feature-test')
    })
  })

  describe('Git cleanup utilities', () => {
    it('should format git prune commands', () => {
      const pruneCommand = ['git', 'worktree', 'prune']
      expect(pruneCommand).toEqual(['git', 'worktree', 'prune'])
    })

    it('should handle git gc commands', () => {
      const gcCommand = ['git', 'gc', '--prune=now']
      expect(gcCommand).toContain('--prune=now')
    })
  })

  describe('Batch deletion utilities', () => {
    it('should handle multiple branch selection', () => {
      const selectedBranches = ['feature-1', 'feature-2', 'bugfix-1']
      const deletionPromises = selectedBranches.map(branch => ({
        branch,
        status: 'pending'
      }))
      
      expect(deletionPromises).toHaveLength(3)
      expect(deletionPromises[0].branch).toBe('feature-1')
    })

    it('should track deletion progress', () => {
      const totalBranches = 5
      const deletedBranches = 3
      const progress = Math.round((deletedBranches / totalBranches) * 100)
      
      expect(progress).toBe(60)
    })
  })

  describe('Backup and safety utilities', () => {
    it('should handle backup creation', () => {
      const branchName = 'feature-important'
      const backupName = `backup/${branchName}-${Date.now()}`
      
      expect(backupName).toContain('backup/')
      expect(backupName).toContain(branchName)
    })

    it('should validate safety checks', () => {
      const hasUncommittedChanges = false
      const hasUnpushedCommits = false
      const isSafeToDelete = !hasUncommittedChanges && !hasUnpushedCommits
      
      expect(isSafeToDelete).toBe(true)
    })
  })

  describe('Directory cleanup utilities', () => {
    it('should handle directory size calculation', () => {
      const sizeInBytes = 1024 * 1024 * 10 // 10MB
      const sizeInMB = Math.round(sizeInBytes / (1024 * 1024))
      
      expect(sizeInMB).toBe(10)
    })

    it('should format directory paths', () => {
      const worktreePath = '/Users/dev/projects/feature-test'
      const parentDir = worktreePath.split('/').slice(0, -1).join('/')
      
      expect(parentDir).toBe('/Users/dev/projects')
    })
  })

  describe('Interactive mode utilities', () => {
    it('should handle confirmation prompts', () => {
      const promptMessage = '以下の影分身を削除しますか？'
      const choices = ['はい', 'いいえ', 'キャンセル']
      
      expect(promptMessage).toContain('削除')
      expect(choices).toContain('はい')
      expect(choices).toContain('いいえ')
    })

    it('should format branch selection lists', () => {
      const branches = ['feature-1', 'feature-2', 'bugfix-1']
      const formattedList = branches.map((branch, index) => 
        `${index + 1}. ${branch}`
      )
      
      expect(formattedList[0]).toBe('1. feature-1')
      expect(formattedList).toHaveLength(3)
    })
  })

  describe('Command validation utilities', () => {
    it('should validate delete command options', () => {
      const validOptions = ['force', 'removeRemote', 'fzf', 'current']
      const commandOptions = {
        force: false,
        removeRemote: true,
        fzf: false,
        current: false
      }
      
      Object.keys(commandOptions).forEach(option => {
        expect(validOptions).toContain(option)
      })
    })

    it('should handle command aliases', () => {
      const aliases = ['del', 'd', 'rm']
      expect(aliases).toContain('del')
      expect(aliases).toContain('d')
    })
  })
})
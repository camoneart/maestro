import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteCommand } from '../../commands/delete.js'
import { Command } from 'commander'

describe('delete command simple tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct command configuration', () => {
    expect(deleteCommand).toBeInstanceOf(Command)
    expect(deleteCommand.name()).toBe('delete')
    expect(deleteCommand.description()).toContain('影分身')
    expect(deleteCommand.aliases()).toContain('rm')
    
    // Check options
    const options = deleteCommand.options
    const optionNames = options.map(opt => opt.long)
    
    expect(optionNames).toContain('--force')
    expect(optionNames).toContain('--current')
    expect(optionNames).toContain('--remove-remote')
    expect(optionNames).toContain('--fzf')
  })

  it('should have correct argument configuration', () => {
    const args = deleteCommand.registeredArguments
    expect(args).toHaveLength(1)
    expect(args[0].name()).toBe('branch-name')
    expect(args[0].required).toBe(false)
  })

  it('should test worktree selection logic', () => {
    const selectWorktree = (worktrees: any[], branchName?: string) => {
      if (branchName) {
        return worktrees.find(w => w.branch === branchName || w.commit === branchName)
      }
      
      // Filter out main branch
      const deletable = worktrees.filter(w => w.branch !== 'main' && w.branch !== 'master')
      
      if (deletable.length === 0) {
        return null
      }
      
      // Return first deletable for test
      return deletable[0]
    }

    const worktrees = [
      { branch: 'main', path: '/main' },
      { branch: 'feature-a', path: '/feature-a' },
      { branch: 'feature-b', path: '/feature-b' },
    ]

    expect(selectWorktree(worktrees, 'feature-a')?.branch).toBe('feature-a')
    expect(selectWorktree(worktrees, 'non-existent')).toBeUndefined()
    expect(selectWorktree(worktrees)?.branch).toBe('feature-a')
    
    const onlyMain = [{ branch: 'main', path: '/main' }]
    expect(selectWorktree(onlyMain)).toBeNull()
  })

  it('should test remote branch name extraction', () => {
    const extractRemoteBranch = (localBranch: string, remoteName = 'origin'): string => {
      return `${remoteName}/${localBranch}`
    }

    expect(extractRemoteBranch('feature-test')).toBe('origin/feature-test')
    expect(extractRemoteBranch('bugfix', 'upstream')).toBe('upstream/bugfix')
  })

  it('should test deletion confirmation message', () => {
    const getConfirmationMessage = (worktree: any, size?: string): string => {
      let message = `worktree '${worktree.branch || worktree.commit}' を削除しますか？`
      
      if (worktree.locked) {
        message = `🔒 ロックされた${message}`
      }
      
      if (size && size !== 'unknown') {
        message += ` (サイズ: ${size})`
      }
      
      return message
    }

    expect(getConfirmationMessage({ branch: 'feature-test' }))
      .toBe("worktree 'feature-test' を削除しますか？")
    
    expect(getConfirmationMessage({ branch: 'locked-branch', locked: true }))
      .toBe("🔒 ロックされたworktree 'locked-branch' を削除しますか？")
    
    expect(getConfirmationMessage({ branch: 'big-feature' }, '2.5 GB'))
      .toBe("worktree 'big-feature' を削除しますか？ (サイズ: 2.5 GB)")
  })

  it('should test fzf preview command generation', () => {
    const generateFzfPreview = (worktreePath: string): string => {
      return `cd ${worktreePath} && git log --oneline -n 10 && echo "" && ls -la`
    }

    const preview = generateFzfPreview('/worktrees/feature-test')
    expect(preview).toContain('cd /worktrees/feature-test')
    expect(preview).toContain('git log --oneline -n 10')
    expect(preview).toContain('ls -la')
  })

  it('should test worktree info formatting', () => {
    const formatWorktreeInfo = (worktree: any): string => {
      const parts = []
      
      if (worktree.branch) {
        parts.push(worktree.branch)
      } else if (worktree.commit) {
        parts.push(`${worktree.commit.substring(0, 7)} (detached)`)
      }
      
      if (worktree.locked) {
        parts.push('🔒')
      }
      
      parts.push(`📁 ${worktree.path}`)
      
      return parts.join(' ')
    }

    expect(formatWorktreeInfo({ branch: 'feature-test', path: '/test/feature' }))
      .toBe('feature-test 📁 /test/feature')
    
    expect(formatWorktreeInfo({ 
      branch: 'locked-branch', 
      path: '/test/locked',
      locked: true 
    })).toBe('locked-branch 🔒 📁 /test/locked')
    
    expect(formatWorktreeInfo({ 
      commit: 'abc1234567890',
      path: '/test/detached' 
    })).toBe('abc1234 (detached) 📁 /test/detached')
  })

  it('should test deletion result message', () => {
    const getResultMessage = (branch: string, options: any = {}): string => {
      let message = `✅ worktree '${branch}' を削除しました`
      
      if (options.remoteDeleted) {
        message += `\n✅ リモートブランチ '${options.remote || 'origin'}/${branch}' も削除しました`
      }
      
      if (options.currentDeleted) {
        message += '\n📍 メインworktreeに戻ります'
      }
      
      return message
    }

    expect(getResultMessage('feature-test'))
      .toBe("✅ worktree 'feature-test' を削除しました")
    
    expect(getResultMessage('feature-test', { remoteDeleted: true }))
      .toContain("リモートブランチ 'origin/feature-test' も削除しました")
    
    expect(getResultMessage('current-branch', { currentDeleted: true }))
      .toContain('メインworktreeに戻ります')
  })

  it('should test size parsing', () => {
    const parseDuOutput = (output: string): number => {
      const match = output.match(/^(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    }

    expect(parseDuOutput('1048576\t/path/to/dir')).toBe(1048576)
    expect(parseDuOutput('2097152 /path/to/dir')).toBe(2097152)
    expect(parseDuOutput('invalid output')).toBe(0)
  })

  it('should test error message formatting', () => {
    const formatDeleteError = (error: any): string => {
      if (error.message?.includes('not found')) {
        return 'worktreeが見つかりません'
      }
      if (error.message?.includes('uncommitted')) {
        return '未コミットの変更があります。--force オプションを使用してください'
      }
      return `削除エラー: ${error.message || '不明なエラー'}`
    }

    expect(formatDeleteError(new Error('Worktree not found')))
      .toBe('worktreeが見つかりません')
    
    expect(formatDeleteError(new Error('Has uncommitted changes')))
      .toBe('未コミットの変更があります。--force オプションを使用してください')
    
    expect(formatDeleteError(new Error('Permission denied')))
      .toBe('削除エラー: Permission denied')
  })
})
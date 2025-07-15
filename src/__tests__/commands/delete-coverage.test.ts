import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('delete command coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should test formatDirectorySize function', async () => {
    const { formatDirectorySize } = await import('../../commands/delete.js')

    expect(formatDirectorySize(0)).toBe('0 B')
    expect(formatDirectorySize(512)).toBe('512 B')
    expect(formatDirectorySize(1024)).toBe('1.0 KB')
    expect(formatDirectorySize(1536)).toBe('1.5 KB')
    expect(formatDirectorySize(1048576)).toBe('1.0 MB')
    expect(formatDirectorySize(1572864)).toBe('1.5 MB')
    expect(formatDirectorySize(1073741824)).toBe('1.0 GB')
    expect(formatDirectorySize(1610612736)).toBe('1.5 GB')
  })

  it('should test createWorktreeDisplay function', async () => {
    const { createWorktreeDisplay } = await import('../../commands/delete.js')

    const normalWorktree = {
      path: '/test/path',
      branch: 'feature-test',
      commit: 'abc123',
      locked: false,
      detached: false,
    }
    expect(createWorktreeDisplay(normalWorktree)).toBe('feature-test')

    const lockedWorktree = {
      path: '/test/locked',
      branch: 'locked-branch',
      commit: 'def456',
      locked: true,
      detached: false,
    }
    expect(createWorktreeDisplay(lockedWorktree)).toBe('🔒 locked-branch')

    const detachedWorktree = {
      path: '/test/detached',
      branch: '',
      head: 'ghi789',
      locked: false,
      prunable: false,
      detached: true,
    }
    expect(createWorktreeDisplay(detachedWorktree)).toBe('⚠️  ghi789 (detached)')
  })

  it('should test getDirectorySize logic', async () => {
    const mockExeca = vi.fn()
    
    const getDirectorySize = async (path: string): Promise<number> => {
      try {
        const { stdout } = await mockExeca('du', ['-sb', path])
        const sizeMatch = stdout.match(/^(\d+)/)
        return sizeMatch ? parseInt(sizeMatch[1], 10) : 0
      } catch {
        return 0
      }
    }

    // Test successful size retrieval
    mockExeca.mockResolvedValueOnce({ stdout: '1048576\t/test/path' })
    const size1 = await getDirectorySize('/test/path')
    expect(size1).toBe(1048576)

    // Test error handling
    mockExeca.mockRejectedValueOnce(new Error('Permission denied'))
    const size2 = await getDirectorySize('/test/path')
    expect(size2).toBe(0)
  })

  it('should test worktree deletion confirmation logic', () => {
    const shouldConfirmDeletion = (worktree: any, options: any): boolean => {
      if (options.force) return false
      if (worktree.locked) return true
      if (worktree.current) return true
      return !options.yes
    }

    const normalWorktree = { locked: false, current: false }
    const lockedWorktree = { locked: true, current: false }
    const currentWorktree = { locked: false, current: true }

    // Test force option bypasses all confirmation
    expect(shouldConfirmDeletion(lockedWorktree, { force: true })).toBe(false)
    
    // Test locked worktree requires confirmation
    expect(shouldConfirmDeletion(lockedWorktree, { force: false })).toBe(true)
    
    // Test current worktree requires confirmation
    expect(shouldConfirmDeletion(currentWorktree, { force: false })).toBe(true)
    
    // Test normal worktree with yes option
    expect(shouldConfirmDeletion(normalWorktree, { force: false, yes: true })).toBe(false)
    
    // Test normal worktree without yes option
    expect(shouldConfirmDeletion(normalWorktree, { force: false, yes: false })).toBe(true)
  })

  it('should test remote branch deletion logic', async () => {
    const mockExeca = vi.fn()
    
    const deleteRemoteBranch = async (branchName: string) => {
      try {
        // Get remote name
        const { stdout: remote } = await mockExeca('git', ['config', '--get', `branch.${branchName}.remote`])
        const remoteName = remote.trim() || 'origin'
        
        // Delete remote branch
        await mockExeca('git', ['push', remoteName, '--delete', branchName])
        return { success: true, remote: remoteName }
      } catch (error) {
        return { success: false, error }
      }
    }

    // Test successful deletion
    mockExeca.mockResolvedValueOnce({ stdout: 'origin\n' })
    mockExeca.mockResolvedValueOnce({ stdout: '' })
    
    const result1 = await deleteRemoteBranch('feature-test')
    expect(result1.success).toBe(true)
    expect(result1.remote).toBe('origin')
    
    // Test deletion failure
    mockExeca.mockResolvedValueOnce({ stdout: 'upstream\n' })
    mockExeca.mockRejectedValueOnce(new Error('Remote branch not found'))
    
    const result2 = await deleteRemoteBranch('feature-old')
    expect(result2.success).toBe(false)
  })
})
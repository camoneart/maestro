import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all external dependencies
const mockGitWorktreeManager = vi.fn(() => ({
  deleteWorktree: vi.fn().mockResolvedValue(undefined),
  listWorktrees: vi.fn().mockResolvedValue([]),
  isGitRepository: vi.fn().mockResolvedValue(true),
}))

const mockExeca = vi.fn()
const mockSpawn = vi.fn()
const mockInquirer = {
  prompt: vi.fn().mockResolvedValue({ confirmDelete: true }),
}

const mockOra = vi.fn(() => ({
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  warn: vi.fn().mockReturnThis(),
}))

const mockCommand = vi.fn(() => ({
  alias: vi.fn().mockReturnThis(),
  description: vi.fn().mockReturnThis(),
  argument: vi.fn().mockReturnThis(),
  option: vi.fn().mockReturnThis(),
  exitOverride: vi.fn().mockReturnThis(),
  action: vi.fn().mockReturnThis(),
}))

// Mock external dependencies
vi.mock('commander', () => ({ Command: mockCommand }))
vi.mock('execa', () => ({ execa: mockExeca }))
vi.mock('child_process', () => ({ spawn: mockSpawn }))
vi.mock('inquirer', () => ({ default: mockInquirer }))
vi.mock('ora', () => ({ default: mockOra }))
vi.mock('chalk', () => ({
  default: {
    red: vi.fn(text => text),
    green: vi.fn(text => text),
    yellow: vi.fn(text => text),
    cyan: vi.fn(text => text),
    gray: vi.fn(text => text),
    bold: vi.fn(text => text),
  },
}))
vi.mock('../../core/git.js', () => ({ GitWorktreeManager: mockGitWorktreeManager }))

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
      head: 'abc123',
      locked: false,
      detached: false,
      prunable: false,
    }
    expect(createWorktreeDisplay(normalWorktree)).toBe('feature-test')

    const lockedWorktree = {
      path: '/test/locked',
      branch: 'locked-branch',
      head: 'def456',
      locked: true,
      detached: false,
      prunable: false,
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

    // Test worktree without branch (using head)
    const noBranchWorktree = {
      path: '/test/nobranch',
      branch: '',
      head: 'xyz123',
      locked: false,
      detached: false,
      prunable: false,
    }
    expect(createWorktreeDisplay(noBranchWorktree)).toBe('xyz123')
  })

  it('should test getDirectorySize function', async () => {
    const { getDirectorySize } = await import('../../commands/delete.js')

    // Test successful size retrieval
    mockExeca.mockResolvedValueOnce({ stdout: '1.5M\t/test/path' })
    const size1 = await getDirectorySize('/test/path')
    expect(size1).toBe('1.5M')

    // Test error handling
    mockExeca.mockRejectedValueOnce(new Error('Permission denied'))
    const size2 = await getDirectorySize('/test/path')
    expect(size2).toBe('unknown')

    // Test empty output
    mockExeca.mockResolvedValueOnce({ stdout: '' })
    const size3 = await getDirectorySize('/test/path')
    expect(size3).toBe('unknown')
  })

  it('should test deleteRemoteBranch function', async () => {
    const { deleteRemoteBranch } = await import('../../commands/delete.js')

    // Test successful remote branch deletion
    mockExeca
      .mockResolvedValueOnce({ stdout: 'origin/feature-test\n  origin/main' })
      .mockResolvedValueOnce({ stdout: '' })

    await deleteRemoteBranch('feature-test')

    expect(mockExeca).toHaveBeenCalledWith('git', ['branch', '-r'])
    expect(mockExeca).toHaveBeenCalledWith('git', ['push', 'origin', '--delete', 'feature-test'])
  })

  it('should test deleteRemoteBranch when remote branch does not exist', async () => {
    const { deleteRemoteBranch } = await import('../../commands/delete.js')

    // Test when remote branch doesn't exist
    mockExeca.mockResolvedValueOnce({ stdout: 'origin/main\n  origin/other' })

    await deleteRemoteBranch('nonexistent-branch')

    expect(mockExeca).toHaveBeenCalledWith('git', ['branch', '-r'])
    // Should not call push command
    expect(mockExeca).not.toHaveBeenCalledWith('git', [
      'push',
      'origin',
      '--delete',
      'nonexistent-branch',
    ])
  })

  it('should test deleteRemoteBranch error handling', async () => {
    const { deleteRemoteBranch } = await import('../../commands/delete.js')

    // Test when git push fails
    mockExeca
      .mockResolvedValueOnce({ stdout: 'origin/feature-test' })
      .mockRejectedValueOnce(new Error('Network error'))

    await expect(deleteRemoteBranch('feature-test')).rejects.toThrow()
  })

  it('should test DeleteCommandError class', async () => {
    // The DeleteCommandError is defined in the file but not exported
    // We'll test error handling scenarios instead
    const { deleteRemoteBranch } = await import('../../commands/delete.js')

    mockExeca
      .mockResolvedValueOnce({ stdout: 'origin/test-branch' })
      .mockRejectedValueOnce(new Error('Permission denied'))

    await expect(deleteRemoteBranch('test-branch')).rejects.toThrow('Permission denied')
  })

  it('should test command builder pattern', async () => {
    const { deleteCommand } = await import('../../commands/delete.js')

    expect(deleteCommand).toBeDefined()
    // The command may be created at module load time, so just check it exists
  })

  it('should test different directory size formats', async () => {
    const { formatDirectorySize } = await import('../../commands/delete.js')

    // Test edge cases
    expect(formatDirectorySize(1023)).toBe('1023 B')
    expect(formatDirectorySize(1025)).toBe('1.0 KB')
    expect(formatDirectorySize(1048575)).toBe('1024.0 KB')
    expect(formatDirectorySize(1048577)).toBe('1.0 MB')
    expect(formatDirectorySize(1073741823)).toBe('1024.0 MB')
    expect(formatDirectorySize(1073741825)).toBe('1.0 GB')
  })

  it('should test createWorktreeDisplay with all combinations', async () => {
    const { createWorktreeDisplay } = await import('../../commands/delete.js')

    // Test locked and detached
    const lockedDetachedWorktree = {
      path: '/test/both',
      branch: 'test-branch',
      head: 'abc123',
      locked: true,
      detached: true,
      prunable: false,
    }
    expect(createWorktreeDisplay(lockedDetachedWorktree)).toBe('⚠️  🔒 test-branch (detached)')

    // Test empty branch and head
    const emptyWorktree = {
      path: '/test/empty',
      branch: '',
      head: '',
      locked: false,
      detached: false,
      prunable: false,
    }
    expect(createWorktreeDisplay(emptyWorktree)).toBe('')
  })

  it('should test getDirectorySize with various formats', async () => {
    const { getDirectorySize } = await import('../../commands/delete.js')

    // Test different du output formats
    mockExeca.mockResolvedValueOnce({ stdout: '2.3G\t/large/dir' })
    expect(await getDirectorySize('/large/dir')).toBe('2.3G')

    mockExeca.mockResolvedValueOnce({ stdout: '500K\t/small/dir' })
    expect(await getDirectorySize('/small/dir')).toBe('500K')

    mockExeca.mockResolvedValueOnce({ stdout: '0\t/empty/dir' })
    expect(await getDirectorySize('/empty/dir')).toBe('0')
  })
})

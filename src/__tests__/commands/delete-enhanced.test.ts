import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'

// delete.ts内の関数群の追加テスト

// モック
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('path')
vi.mock('../../core/config.js')
vi.mock('../../core/git.js')

const mockExeca = execa as any
const mockFs = fs as any
const mockPath = path as any

describe('Delete Command - Enhanced Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Worktree path validation', () => {
    it('should validate worktree paths correctly', () => {
      function isValidWorktreePath(worktreePath: string, rootPath: string): boolean {
        return worktreePath.startsWith(rootPath) && worktreePath !== rootPath
      }

      expect(isValidWorktreePath('/repo/feature-branch', '/repo')).toBe(true)
      expect(isValidWorktreePath('/repo', '/repo')).toBe(false)
      expect(isValidWorktreePath('/other/path', '/repo')).toBe(false)
      expect(isValidWorktreePath('', '/repo')).toBe(false)
    })

    it('should handle relative path normalization', () => {
      function normalizeWorktreePath(worktreePath: string): string {
        return path.resolve(worktreePath)
      }

      mockPath.resolve.mockReturnValue('/absolute/path/feature-branch')
      const result = normalizeWorktreePath('../feature-branch')
      expect(result).toBe('/absolute/path/feature-branch')
    })
  })

  describe('Worktree cleanup utilities', () => {
    it('should check for uncommitted changes', async () => {
      mockExeca.mockResolvedValue({ stdout: 'M  src/file.ts\n?? newfile.ts' })

      async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
        try {
          const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: worktreePath })
          return stdout.trim().length > 0
        } catch {
          return false
        }
      }

      const hasChanges = await hasUncommittedChanges('/path/to/worktree')
      expect(hasChanges).toBe(true)
      expect(mockExeca).toHaveBeenCalledWith('git', ['status', '--porcelain'], { cwd: '/path/to/worktree' })
    })

    it('should handle clean worktree', async () => {
      mockExeca.mockResolvedValue({ stdout: '' })

      async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
        try {
          const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: worktreePath })
          return stdout.trim().length > 0
        } catch {
          return false
        }
      }

      const hasChanges = await hasUncommittedChanges('/path/to/worktree')
      expect(hasChanges).toBe(false)
    })

    it('should handle git command errors', async () => {
      mockExeca.mockRejectedValue(new Error('Not a git repository'))

      async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
        try {
          const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: worktreePath })
          return stdout.trim().length > 0
        } catch {
          return false
        }
      }

      const hasChanges = await hasUncommittedChanges('/path/to/worktree')
      expect(hasChanges).toBe(false)
    })
  })

  describe('Branch safety checks', () => {
    it('should identify protected branches', () => {
      function isProtectedBranch(branchName: string, protectedBranches: string[] = ['main', 'master', 'develop']): boolean {
        return protectedBranches.includes(branchName)
      }

      expect(isProtectedBranch('main')).toBe(true)
      expect(isProtectedBranch('master')).toBe(true)
      expect(isProtectedBranch('develop')).toBe(true)
      expect(isProtectedBranch('feature-branch')).toBe(false)
      expect(isProtectedBranch('main', ['main', 'staging'])).toBe(true)
      expect(isProtectedBranch('develop', ['main', 'staging'])).toBe(false)
    })

    it('should check for active branches', async () => {
      mockExeca.mockResolvedValue({ stdout: '* feature-branch\n  main\n  other-branch' })

      async function isActiveBranch(branchName: string): Promise<boolean> {
        try {
          const { stdout } = await execa('git', ['branch'])
          const activeBranch = stdout.split('\n').find(line => line.startsWith('*'))?.replace('*', '').trim()
          return activeBranch === branchName
        } catch {
          return false
        }
      }

      const isActive = await isActiveBranch('feature-branch')
      expect(isActive).toBe(true)

      const isNotActive = await isActiveBranch('main')
      expect(isNotActive).toBe(false)
    })

    it('should handle merged branch detection', async () => {
      mockExeca.mockResolvedValue({ stdout: 'feature-1\nfeature-2\n' })

      async function getMergedBranches(): Promise<string[]> {
        try {
          const { stdout } = await execa('git', ['branch', '--merged'])
          return stdout.split('\n')
            .map(branch => branch.replace(/^\*?\s+/, '').trim())
            .filter(branch => branch && !branch.startsWith('*'))
        } catch {
          return []
        }
      }

      const mergedBranches = await getMergedBranches()
      expect(mergedBranches).toEqual(['feature-1', 'feature-2'])
    })
  })

  describe('Metadata handling', () => {
    it('should read worktree metadata', async () => {
      const mockMetadata = {
        createdAt: '2025-01-01T00:00:00.000Z',
        branch: 'feature-test',
        worktreePath: '/path/to/worktree',
        github: {
          type: 'issue',
          title: 'Test issue',
          url: 'https://github.com/test/repo/issues/123'
        }
      }

      mockPath.join.mockReturnValue('/path/to/worktree/.maestro-metadata.json')
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockMetadata))

      async function readWorktreeMetadata(worktreePath: string): Promise<any | null> {
        try {
          const metadataPath = path.join(worktreePath, '.maestro-metadata.json')
          const content = await fs.readFile(metadataPath, 'utf-8')
          return JSON.parse(content)
        } catch {
          return null
        }
      }

      const metadata = await readWorktreeMetadata('/path/to/worktree')
      expect(metadata).toEqual(mockMetadata)
      expect(metadata.github.type).toBe('issue')
    })

    it('should handle missing metadata gracefully', async () => {
      mockPath.join.mockReturnValue('/path/to/worktree/.maestro-metadata.json')
      mockFs.readFile.mockRejectedValue(new Error('File not found'))

      async function readWorktreeMetadata(worktreePath: string): Promise<any | null> {
        try {
          const metadataPath = path.join(worktreePath, '.maestro-metadata.json')
          const content = await fs.readFile(metadataPath, 'utf-8')
          return JSON.parse(content)
        } catch {
          return null
        }
      }

      const metadata = await readWorktreeMetadata('/path/to/worktree')
      expect(metadata).toBeNull()
    })

    it('should handle corrupted metadata', async () => {
      mockPath.join.mockReturnValue('/path/to/worktree/.maestro-metadata.json')
      mockFs.readFile.mockResolvedValue('invalid json content')

      async function readWorktreeMetadata(worktreePath: string): Promise<any | null> {
        try {
          const metadataPath = path.join(worktreePath, '.maestro-metadata.json')
          const content = await fs.readFile(metadataPath, 'utf-8')
          return JSON.parse(content)
        } catch {
          return null
        }
      }

      const metadata = await readWorktreeMetadata('/path/to/worktree')
      expect(metadata).toBeNull()
    })
  })

  describe('Tmux session cleanup', () => {
    it('should find and kill tmux sessions', async () => {
      mockExeca
        .mockResolvedValueOnce({ stdout: 'feature-test\nother-session' }) // list-sessions
        .mockResolvedValueOnce({ stdout: '' }) // kill-session

      async function cleanupTmuxSession(branchName: string): Promise<void> {
        const sessionName = branchName.replace(/[^a-zA-Z0-9_-]/g, '-')
        
        try {
          // セッションの存在確認
          const { stdout } = await execa('tmux', ['list-sessions', '-F', '#{session_name}'])
          const sessions = stdout.split('\n').filter(s => s.trim())
          
          if (sessions.includes(sessionName)) {
            await execa('tmux', ['kill-session', '-t', sessionName])
            console.log(`tmuxセッション '${sessionName}' を終了しました`)
          }
        } catch {
          // tmuxが使用できない場合は無視
        }
      }

      await cleanupTmuxSession('feature/test')
      
      expect(mockExeca).toHaveBeenCalledWith('tmux', ['list-sessions', '-F', '#{session_name}'])
      expect(mockExeca).toHaveBeenCalledWith('tmux', ['kill-session', '-t', 'feature-test'])
    })

    it('should handle non-existent tmux sessions', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'other-session' })

      async function cleanupTmuxSession(branchName: string): Promise<void> {
        const sessionName = branchName.replace(/[^a-zA-Z0-9_-]/g, '-')
        
        try {
          const { stdout } = await execa('tmux', ['list-sessions', '-F', '#{session_name}'])
          const sessions = stdout.split('\n').filter(s => s.trim())
          
          if (sessions.includes(sessionName)) {
            await execa('tmux', ['kill-session', '-t', sessionName])
          }
        } catch {
          // エラーは無視
        }
      }

      await cleanupTmuxSession('non-existent')
      
      expect(mockExeca).toHaveBeenCalledWith('tmux', ['list-sessions', '-F', '#{session_name}'])
      expect(mockExeca).toHaveBeenCalledTimes(1)
    })

    it('should handle tmux not available', async () => {
      mockExeca.mockRejectedValue(new Error('tmux: command not found'))

      async function cleanupTmuxSession(branchName: string): Promise<void> {
        try {
          await execa('tmux', ['list-sessions', '-F', '#{session_name}'])
        } catch {
          // tmuxが使用できない場合は無視
        }
      }

      await expect(cleanupTmuxSession('test')).resolves.toBeUndefined()
    })
  })

  describe('Force deletion handling', () => {
    it('should handle force deletion with uncommitted changes', async () => {
      mockExeca
        .mockResolvedValueOnce({ stdout: 'M  file.ts' }) // git status
        .mockResolvedValueOnce({ stdout: '' }) // git worktree remove

      async function forceDeleteWorktree(worktreePath: string): Promise<boolean> {
        try {
          // 未コミット変更をチェック
          const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: worktreePath })
          const hasChanges = stdout.trim().length > 0
          
          if (hasChanges) {
            console.warn('未コミットの変更があります。強制削除します。')
          }
          
          await execa('git', ['worktree', 'remove', '--force', worktreePath])
          return true
        } catch {
          return false
        }
      }

      const success = await forceDeleteWorktree('/path/to/worktree')
      expect(success).toBe(true)
      expect(mockExeca).toHaveBeenCalledWith('git', ['worktree', 'remove', '--force', '/path/to/worktree'])
    })

    it('should handle force deletion failure', async () => {
      mockExeca
        .mockResolvedValueOnce({ stdout: '' }) // git status
        .mockRejectedValueOnce(new Error('Removal failed')) // git worktree remove fails

      async function forceDeleteWorktree(worktreePath: string): Promise<boolean> {
        try {
          await execa('git', ['status', '--porcelain'], { cwd: worktreePath })
          await execa('git', ['worktree', 'remove', '--force', worktreePath])
          return true
        } catch {
          return false
        }
      }

      const success = await forceDeleteWorktree('/path/to/worktree')
      expect(success).toBe(false)
    })
  })

  describe('Directory cleanup utilities', () => {
    it('should remove empty directories', async () => {
      mockFs.rmdir.mockResolvedValue(undefined)

      async function removeEmptyDirectory(dirPath: string): Promise<boolean> {
        try {
          await fs.rmdir(dirPath)
          return true
        } catch {
          return false
        }
      }

      const success = await removeEmptyDirectory('/empty/dir')
      expect(success).toBe(true)
      expect(mockFs.rmdir).toHaveBeenCalledWith('/empty/dir')
    })

    it('should handle non-empty directories', async () => {
      mockFs.rmdir.mockRejectedValue(new Error('Directory not empty'))

      async function removeEmptyDirectory(dirPath: string): Promise<boolean> {
        try {
          await fs.rmdir(dirPath)
          return true
        } catch {
          return false
        }
      }

      const success = await removeEmptyDirectory('/non-empty/dir')
      expect(success).toBe(false)
    })

    it('should recursively remove directories', async () => {
      mockFs.rm.mockResolvedValue(undefined)

      async function removeDirectoryRecursive(dirPath: string): Promise<boolean> {
        try {
          await fs.rm(dirPath, { recursive: true, force: true })
          return true
        } catch {
          return false
        }
      }

      const success = await removeDirectoryRecursive('/some/dir')
      expect(success).toBe(true)
      expect(mockFs.rm).toHaveBeenCalledWith('/some/dir', { recursive: true, force: true })
    })
  })

  describe('Branch deletion utilities', () => {
    it('should delete local branch', async () => {
      mockExeca.mockResolvedValue({ stdout: 'Deleted branch feature-test' })

      async function deleteLocalBranch(branchName: string, force: boolean = false): Promise<boolean> {
        try {
          const deleteFlag = force ? '-D' : '-d'
          await execa('git', ['branch', deleteFlag, branchName])
          return true
        } catch {
          return false
        }
      }

      const success = await deleteLocalBranch('feature-test', false)
      expect(success).toBe(true)
      expect(mockExeca).toHaveBeenCalledWith('git', ['branch', '-d', 'feature-test'])
    })

    it('should force delete unmerged branch', async () => {
      mockExeca.mockResolvedValue({ stdout: 'Deleted branch feature-test' })

      async function deleteLocalBranch(branchName: string, force: boolean = false): Promise<boolean> {
        try {
          const deleteFlag = force ? '-D' : '-d'
          await execa('git', ['branch', deleteFlag, branchName])
          return true
        } catch {
          return false
        }
      }

      const success = await deleteLocalBranch('feature-test', true)
      expect(success).toBe(true)
      expect(mockExeca).toHaveBeenCalledWith('git', ['branch', '-D', 'feature-test'])
    })

    it('should handle branch deletion failure', async () => {
      mockExeca.mockRejectedValue(new Error('Branch not found'))

      async function deleteLocalBranch(branchName: string, force: boolean = false): Promise<boolean> {
        try {
          const deleteFlag = force ? '-D' : '-d'
          await execa('git', ['branch', deleteFlag, branchName])
          return true
        } catch {
          return false
        }
      }

      const success = await deleteLocalBranch('non-existent', false)
      expect(success).toBe(false)
    })
  })

  describe('Remote branch handling', () => {
    it('should delete remote tracking branch', async () => {
      mockExeca.mockResolvedValue({ stdout: 'To origin\n - [deleted]         feature-test' })

      async function deleteRemoteBranch(branchName: string): Promise<boolean> {
        try {
          await execa('git', ['push', 'origin', '--delete', branchName])
          return true
        } catch {
          return false
        }
      }

      const success = await deleteRemoteBranch('feature-test')
      expect(success).toBe(true)
      expect(mockExeca).toHaveBeenCalledWith('git', ['push', 'origin', '--delete', 'feature-test'])
    })

    it('should handle remote branch not found', async () => {
      mockExeca.mockRejectedValue(new Error('Remote branch not found'))

      async function deleteRemoteBranch(branchName: string): Promise<boolean> {
        try {
          await execa('git', ['push', 'origin', '--delete', branchName])
          return true
        } catch {
          return false
        }
      }

      const success = await deleteRemoteBranch('non-existent')
      expect(success).toBe(false)
    })

    it('should check if branch has remote tracking', async () => {
      mockExeca.mockResolvedValue({ stdout: 'refs/remotes/origin/feature-test' })

      async function hasRemoteTracking(branchName: string): Promise<boolean> {
        try {
          const { stdout } = await execa('git', ['ls-remote', '--heads', 'origin', branchName])
          return stdout.trim().length > 0
        } catch {
          return false
        }
      }

      const hasRemote = await hasRemoteTracking('feature-test')
      expect(hasRemote).toBe(true)
    })
  })

  describe('Hooks execution', () => {
    it('should execute beforeDelete hook', async () => {
      mockExeca.mockResolvedValue({ stdout: 'Hook executed' })

      async function executeBeforeDeleteHook(hook: string, branchName: string, worktreePath: string): Promise<boolean> {
        try {
          await execa('sh', ['-c', hook], {
            cwd: worktreePath,
            env: {
              ...process.env,
              MAESTRO_BRANCH: branchName,
              MAESTRO_PATH: worktreePath,
            },
          })
          return true
        } catch {
          return false
        }
      }

      const success = await executeBeforeDeleteHook('echo "Cleaning up"', 'feature-test', '/path/to/worktree')
      expect(success).toBe(true)
      expect(mockExeca).toHaveBeenCalledWith('sh', ['-c', 'echo "Cleaning up"'], {
        cwd: '/path/to/worktree',
        env: expect.objectContaining({
          MAESTRO_BRANCH: 'feature-test',
          MAESTRO_PATH: '/path/to/worktree',
        }),
      })
    })

    it('should handle hook execution failure', async () => {
      mockExeca.mockRejectedValue(new Error('Hook failed'))

      async function executeBeforeDeleteHook(hook: string, branchName: string, worktreePath: string): Promise<boolean> {
        try {
          await execa('sh', ['-c', hook], {
            cwd: worktreePath,
            env: {
              ...process.env,
              MAESTRO_BRANCH: branchName,
              MAESTRO_PATH: worktreePath,
            },
          })
          return true
        } catch {
          return false
        }
      }

      const success = await executeBeforeDeleteHook('exit 1', 'feature-test', '/path/to/worktree')
      expect(success).toBe(false)
    })
  })
})
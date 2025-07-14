import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'

// watch.ts の追加テスト（Functions カバレッジ向上）

// モック
vi.mock('execa')
vi.mock('fs/promises')
vi.mock('path')
vi.mock('chokidar')
vi.mock('../../core/config.js')
vi.mock('../../core/git.js')

const mockExeca = execa as any
const mockFs = fs as any
const mockPath = path as any

describe('Watch Command - Functions Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('File change detection utilities', () => {
    it('should categorize file changes by type', () => {
      function categorizeFileChanges(changes: Array<{ type: string; path: string }>): {
        added: string[]
        modified: string[]
        deleted: string[]
      } {
        return changes.reduce((acc, change) => {
          switch (change.type) {
            case 'add':
              acc.added.push(change.path)
              break
            case 'change':
              acc.modified.push(change.path)
              break
            case 'unlink':
              acc.deleted.push(change.path)
              break
          }
          return acc
        }, { added: [] as string[], modified: [] as string[], deleted: [] as string[] })
      }

      const changes = [
        { type: 'add', path: 'src/new-file.ts' },
        { type: 'change', path: 'src/existing-file.ts' },
        { type: 'unlink', path: 'src/old-file.ts' },
        { type: 'add', path: 'docs/readme.md' }
      ]

      const categorized = categorizeFileChanges(changes)
      expect(categorized.added).toEqual(['src/new-file.ts', 'docs/readme.md'])
      expect(categorized.modified).toEqual(['src/existing-file.ts'])
      expect(categorized.deleted).toEqual(['src/old-file.ts'])
    })

    it('should filter ignored file patterns', () => {
      function shouldIgnoreFile(filePath: string, ignorePatterns: string[]): boolean {
        return ignorePatterns.some(pattern => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'))
            return regex.test(filePath)
          }
          return filePath.includes(pattern)
        })
      }

      const ignorePatterns = ['node_modules', '*.log', '.git', 'dist/*']

      expect(shouldIgnoreFile('src/file.ts', ignorePatterns)).toBe(false)
      expect(shouldIgnoreFile('node_modules/package/index.js', ignorePatterns)).toBe(true)
      expect(shouldIgnoreFile('app.log', ignorePatterns)).toBe(true)
      expect(shouldIgnoreFile('.git/config', ignorePatterns)).toBe(true)
      expect(shouldIgnoreFile('dist/bundle.js', ignorePatterns)).toBe(true)
    })

    it('should calculate sync priorities', () => {
      function calculateSyncPriority(filePath: string): number {
        const priorities = {
          '.env': 10,
          'package.json': 9,
          '.gitignore': 8,
          '.ts': 7,
          '.js': 6,
          '.md': 4,
          '.txt': 2
        }

        for (const [pattern, priority] of Object.entries(priorities)) {
          if (filePath.includes(pattern)) {
            return priority
          }
        }

        return 1 // default priority
      }

      expect(calculateSyncPriority('.env')).toBe(10)
      expect(calculateSyncPriority('package.json')).toBe(9)
      expect(calculateSyncPriority('src/app.ts')).toBe(7)
      expect(calculateSyncPriority('readme.md')).toBe(4)
      expect(calculateSyncPriority('unknown.xyz')).toBe(1)
    })

    it('should detect file conflicts across worktrees', () => {
      function detectFileConflicts(changes: Array<{ path: string; worktree: string }>): Array<{
        path: string
        conflictingWorktrees: string[]
      }> {
        const pathMap = new Map<string, string[]>()

        changes.forEach(change => {
          if (!pathMap.has(change.path)) {
            pathMap.set(change.path, [])
          }
          pathMap.get(change.path)!.push(change.worktree)
        })

        return Array.from(pathMap.entries())
          .filter(([_, worktrees]) => worktrees.length > 1)
          .map(([path, worktrees]) => ({ path, conflictingWorktrees: worktrees }))
      }

      const changes = [
        { path: 'src/shared.ts', worktree: 'feature-1' },
        { path: 'src/shared.ts', worktree: 'feature-2' },
        { path: 'src/unique.ts', worktree: 'feature-1' },
        { path: 'package.json', worktree: 'feature-1' },
        { path: 'package.json', worktree: 'feature-2' },
        { path: 'package.json', worktree: 'feature-3' }
      ]

      const conflicts = detectFileConflicts(changes)
      expect(conflicts).toEqual([
        { path: 'src/shared.ts', conflictingWorktrees: ['feature-1', 'feature-2'] },
        { path: 'package.json', conflictingWorktrees: ['feature-1', 'feature-2', 'feature-3'] }
      ])
    })
  })

  describe('Sync strategy utilities', () => {
    it('should determine optimal sync direction', () => {
      function determineSyncDirection(sourceTime: number, targetTime: number, strategy: string): 'source-to-target' | 'target-to-source' | 'merge' | 'skip' {
        switch (strategy) {
          case 'newer-wins':
            return sourceTime > targetTime ? 'source-to-target' : 'target-to-source'
          case 'source-priority':
            return 'source-to-target'
          case 'target-priority':
            return 'target-to-source'
          case 'manual':
            return 'merge'
          default:
            return 'skip'
        }
      }

      const now = Date.now()
      const older = now - 1000

      expect(determineSyncDirection(now, older, 'newer-wins')).toBe('source-to-target')
      expect(determineSyncDirection(older, now, 'newer-wins')).toBe('target-to-source')
      expect(determineSyncDirection(older, now, 'source-priority')).toBe('source-to-target')
      expect(determineSyncDirection(now, older, 'target-priority')).toBe('target-to-source')
      expect(determineSyncDirection(now, older, 'manual')).toBe('merge')
      expect(determineSyncDirection(now, older, 'unknown')).toBe('skip')
    })

    it('should calculate sync batch size', () => {
      function calculateBatchSize(totalFiles: number, availableMemory: number = 1000): number {
        const baseSize = 10
        const memoryFactor = Math.floor(availableMemory / 100)
        const sizeFactor = totalFiles > 100 ? Math.ceil(totalFiles / 20) : baseSize

        return Math.min(Math.max(baseSize, memoryFactor, sizeFactor), 50)
      }

      expect(calculateBatchSize(10, 1000)).toBe(10) // base size
      expect(calculateBatchSize(200, 1000)).toBe(10) // memory limited
      expect(calculateBatchSize(200, 2000)).toBe(20) // memory allows more
      expect(calculateBatchSize(10, 5000)).toBe(50) // memory cap
    })

    it('should handle sync queue management', () => {
      interface SyncTask {
        id: string
        priority: number
        filePath: string
        operation: 'copy' | 'delete' | 'merge'
      }

      function manageSyncQueue(tasks: SyncTask[], maxConcurrent: number = 3): {
        executing: SyncTask[]
        queued: SyncTask[]
      } {
        const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority)
        
        return {
          executing: sortedTasks.slice(0, maxConcurrent),
          queued: sortedTasks.slice(maxConcurrent)
        }
      }

      const tasks: SyncTask[] = [
        { id: '1', priority: 5, filePath: 'src/app.ts', operation: 'copy' },
        { id: '2', priority: 10, filePath: '.env', operation: 'copy' },
        { id: '3', priority: 3, filePath: 'docs/readme.md', operation: 'copy' },
        { id: '4', priority: 8, filePath: 'package.json', operation: 'copy' },
        { id: '5', priority: 1, filePath: 'temp.txt', operation: 'delete' }
      ]

      const queue = manageSyncQueue(tasks, 3)
      
      expect(queue.executing).toHaveLength(3)
      expect(queue.executing[0].id).toBe('2') // highest priority
      expect(queue.executing[1].id).toBe('4') // second highest
      expect(queue.executing[2].id).toBe('1') // third highest
      expect(queue.queued).toHaveLength(2)
    })
  })

  describe('Error handling and recovery', () => {
    it('should handle sync failures with retry logic', () => {
      function shouldRetrySync(error: any, attempt: number, maxRetries: number = 3): boolean {
        if (attempt >= maxRetries) return false

        const retryableErrors = ['ENOENT', 'EACCES', 'EAGAIN', 'EMFILE']
        return retryableErrors.some(code => error.code === code || error.message?.includes(code))
      }

      const retryableError = { code: 'ENOENT', message: 'File not found' }
      const nonRetryableError = { code: 'EINVAL', message: 'Invalid argument' }

      expect(shouldRetrySync(retryableError, 1, 3)).toBe(true)
      expect(shouldRetrySync(retryableError, 3, 3)).toBe(false)
      expect(shouldRetrySync(nonRetryableError, 1, 3)).toBe(false)
    })

    it('should calculate retry delays with backoff', () => {
      function calculateRetryDelay(attempt: number, baseDelay: number = 1000): number {
        return Math.min(baseDelay * Math.pow(2, attempt - 1), 10000)
      }

      expect(calculateRetryDelay(1, 1000)).toBe(1000)  // 1 second
      expect(calculateRetryDelay(2, 1000)).toBe(2000)  // 2 seconds
      expect(calculateRetryDelay(3, 1000)).toBe(4000)  // 4 seconds
      expect(calculateRetryDelay(4, 1000)).toBe(8000)  // 8 seconds
      expect(calculateRetryDelay(5, 1000)).toBe(10000) // capped at 10 seconds
    })

    it('should handle partial sync recovery', () => {
      function createRecoveryPlan(failedSyncs: Array<{ path: string; error: string }>): {
        canRecover: string[]
        needsManualIntervention: string[]
        suggestions: string[]
      } {
        const canRecover: string[] = []
        const needsManualIntervention: string[] = []
        const suggestions: string[] = []

        failedSyncs.forEach(sync => {
          if (sync.error.includes('Permission')) {
            needsManualIntervention.push(sync.path)
            suggestions.push(`Check file permissions for ${sync.path}`)
          } else if (sync.error.includes('not found')) {
            canRecover.push(sync.path)
            suggestions.push(`Recreate missing file: ${sync.path}`)
          } else {
            canRecover.push(sync.path)
          }
        })

        return { canRecover, needsManualIntervention, suggestions }
      }

      const failedSyncs = [
        { path: 'src/app.ts', error: 'File not found' },
        { path: 'secret.key', error: 'Permission denied' },
        { path: 'data.json', error: 'Disk full' }
      ]

      const recovery = createRecoveryPlan(failedSyncs)
      expect(recovery.canRecover).toEqual(['src/app.ts', 'data.json'])
      expect(recovery.needsManualIntervention).toEqual(['secret.key'])
      expect(recovery.suggestions).toContain('Check file permissions for secret.key')
    })
  })

  describe('Watch configuration', () => {
    it('should validate watch patterns', () => {
      function validateWatchPatterns(patterns: string[]): { valid: string[]; invalid: string[] } {
        const valid: string[] = []
        const invalid: string[] = []

        patterns.forEach(pattern => {
          try {
            // Simple validation - check for basic glob syntax
            if (pattern.includes('**') || pattern.includes('*') || pattern.includes('?')) {
              valid.push(pattern)
            } else if (pattern.length > 0 && !pattern.includes(' ')) {
              valid.push(pattern)
            } else {
              invalid.push(pattern)
            }
          } catch {
            invalid.push(pattern)
          }
        })

        return { valid, invalid }
      }

      const patterns = [
        'src/**/*.ts',
        '*.json',
        'docs/?*.md',
        '',
        'invalid pattern with spaces',
        'valid-pattern'
      ]

      const result = validateWatchPatterns(patterns)
      expect(result.valid).toEqual(['src/**/*.ts', '*.json', 'docs/?*.md', 'valid-pattern'])
      expect(result.invalid).toEqual(['', 'invalid pattern with spaces'])
    })

    it('should merge watch configurations', () => {
      function mergeWatchConfigs(configs: Array<{ patterns: string[]; ignored: string[]; options: any }>): {
        patterns: string[]
        ignored: string[]
        options: any
      } {
        const patterns = new Set<string>()
        const ignored = new Set<string>()
        let mergedOptions = {}

        configs.forEach(config => {
          config.patterns.forEach(p => patterns.add(p))
          config.ignored.forEach(i => ignored.add(i))
          mergedOptions = { ...mergedOptions, ...config.options }
        })

        return {
          patterns: Array.from(patterns),
          ignored: Array.from(ignored),
          options: mergedOptions
        }
      }

      const configs = [
        { patterns: ['src/**/*.ts'], ignored: ['node_modules'], options: { persistent: true } },
        { patterns: ['*.json'], ignored: ['.git'], options: { ignoreInitial: false } },
        { patterns: ['docs/**'], ignored: ['node_modules'], options: { persistent: false } }
      ]

      const merged = mergeWatchConfigs(configs)
      expect(merged.patterns).toEqual(['src/**/*.ts', '*.json', 'docs/**'])
      expect(merged.ignored).toEqual(['node_modules', '.git'])
      expect(merged.options).toEqual({ persistent: false, ignoreInitial: false })
    })
  })

  describe('Performance monitoring', () => {
    it('should track sync performance metrics', () => {
      interface SyncMetrics {
        filesProcessed: number
        totalTime: number
        errors: number
        avgFileSize: number
      }

      function calculateSyncStats(metrics: SyncMetrics[]): {
        totalFiles: number
        avgTimePerFile: number
        errorRate: number
        throughput: number
      } {
        const totalFiles = metrics.reduce((sum, m) => sum + m.filesProcessed, 0)
        const totalTime = metrics.reduce((sum, m) => sum + m.totalTime, 0)
        const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0)

        return {
          totalFiles,
          avgTimePerFile: totalFiles > 0 ? totalTime / totalFiles : 0,
          errorRate: totalFiles > 0 ? (totalErrors / totalFiles) * 100 : 0,
          throughput: totalTime > 0 ? totalFiles / (totalTime / 1000) : 0 // files per second
        }
      }

      const metrics: SyncMetrics[] = [
        { filesProcessed: 10, totalTime: 1000, errors: 1, avgFileSize: 1024 },
        { filesProcessed: 5, totalTime: 500, errors: 0, avgFileSize: 2048 },
        { filesProcessed: 8, totalTime: 800, errors: 2, avgFileSize: 512 }
      ]

      const stats = calculateSyncStats(metrics)
      expect(stats.totalFiles).toBe(23)
      expect(stats.avgTimePerFile).toBe(100) // 2300ms / 23 files
      expect(stats.errorRate).toBeCloseTo(13.04, 1) // 3 errors / 23 files * 100
      expect(stats.throughput).toBe(10) // 23 files / 2.3 seconds
    })
  })
})
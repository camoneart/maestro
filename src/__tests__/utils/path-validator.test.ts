import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isPathWithinWorktree,
  containsDirectoryTraversal,
  validatePath,
  safeRelativePath,
  loopTracker,
  PATH_VALIDATION_ERRORS,
} from '../../utils/path-validator.js'
import path from 'path'
import chalk from 'chalk'

// モックの設定
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text: string) => text),
  },
}))

describe('path-validator', () => {
  beforeEach(() => {
    // consoleのモック
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // ループトラッカーのリセット
    loopTracker.reset()
  })

  describe('isPathWithinWorktree', () => {
    it('worktree内のパスは許可する', () => {
      expect(isPathWithinWorktree('/repo/worktree/src/file.ts', '/repo/worktree')).toBe(true)
      expect(isPathWithinWorktree('/repo/worktree/deep/nested/file.ts', '/repo/worktree')).toBe(
        true
      )
      expect(isPathWithinWorktree('/repo/worktree', '/repo/worktree')).toBe(true)
    })

    it('worktree外のパスは拒否する', () => {
      expect(isPathWithinWorktree('/repo/other/file.ts', '/repo/worktree')).toBe(false)
      expect(isPathWithinWorktree('/etc/passwd', '/repo/worktree')).toBe(false)
      expect(isPathWithinWorktree('/repo', '/repo/worktree')).toBe(false)
    })
  })

  describe('containsDirectoryTraversal', () => {
    it('../を含むパスを検出する', () => {
      expect(containsDirectoryTraversal('../file.ts')).toBe(true)
      expect(containsDirectoryTraversal('../../etc/passwd')).toBe(true)
      expect(containsDirectoryTraversal('src/../../../file.ts')).toBe(true)
      expect(containsDirectoryTraversal('..')).toBe(true)
      expect(containsDirectoryTraversal('../')).toBe(true)
    })

    it('Windowsスタイルの..\\も検出する', () => {
      expect(containsDirectoryTraversal('..\\file.ts')).toBe(true)
      expect(containsDirectoryTraversal('src\\..\\..\\file.ts')).toBe(true)
    })

    it('安全なパスは許可する', () => {
      expect(containsDirectoryTraversal('src/file.ts')).toBe(false)
      expect(containsDirectoryTraversal('./file.ts')).toBe(false)
      expect(containsDirectoryTraversal('file.ts')).toBe(false)
      expect(containsDirectoryTraversal('src/nested/file.ts')).toBe(false)
    })
  })

  describe('validatePath', () => {
    it('安全なパスを許可する', () => {
      const result = validatePath(
        '/repo/worktree2/src/file.ts',
        '/repo/worktree1',
        '/repo/worktree2'
      )
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('ディレクトリトラバーサルを含むパスを拒否する', () => {
      const result = validatePath('../../../etc/passwd', '/repo/worktree1', '/repo/worktree2')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain(PATH_VALIDATION_ERRORS.DIRECTORY_TRAVERSAL)
    })

    it('worktree外へのパスを拒否する', () => {
      const result = validatePath('/etc/passwd', '/repo/worktree1', '/repo/worktree2')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain(PATH_VALIDATION_ERRORS.OUTSIDE_WORKTREE)
    })

    it('ループを検出する', () => {
      // 同じディレクトリを複数回作成しようとする
      const targetPath = '/repo/worktree2/src/file.ts'

      // 最初の3回は成功
      for (let i = 0; i < 3; i++) {
        const result = validatePath(targetPath, '/repo/worktree1', '/repo/worktree2')
        expect(result.isValid).toBe(true)
      }

      // 4回目で失敗
      const result = validatePath(targetPath, '/repo/worktree1', '/repo/worktree2')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain(PATH_VALIDATION_ERRORS.LOOP_DETECTED)
    })

    it('深いディレクトリ構造を拒否する', () => {
      // 11階層の深さを持つパス
      const deepPath = '/repo/worktree2/a/b/c/d/e/f/g/h/i/j/k/file.ts'
      const result = validatePath(deepPath, '/repo/worktree1', '/repo/worktree2')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain(PATH_VALIDATION_ERRORS.LOOP_DETECTED)
    })
  })

  describe('safeRelativePath', () => {
    it('安全な相対パスを計算する', () => {
      vi.spyOn(path, 'relative').mockReturnValue('src/file.ts')

      const result = safeRelativePath('/repo/worktree1', '/repo/worktree1/src/file.ts')
      expect(result).toBe('src/file.ts')
    })

    it('危険な相対パスはnullを返す', () => {
      vi.spyOn(path, 'relative').mockReturnValue('../../../etc/passwd')

      const result = safeRelativePath('/repo/worktree1', '/etc/passwd')
      expect(result).toBeNull()
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('危険な相対パス'))
    })

    it('エラー時はnullを返す', () => {
      vi.spyOn(path, 'relative').mockImplementation(() => {
        throw new Error('Path calculation error')
      })

      const result = safeRelativePath('/repo/worktree1', '/invalid/path')
      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('相対パス計算エラー'))
    })
  })

  describe('DirectoryLoopTracker', () => {
    it('トラッカーをリセットできる', () => {
      // 同じパスを3回追加
      const targetPath = '/repo/worktree2/src/file.ts'
      for (let i = 0; i < 3; i++) {
        validatePath(targetPath, '/repo/worktree1', '/repo/worktree2')
      }

      // リセット
      loopTracker.reset()

      // リセット後は再び3回まで許可される
      for (let i = 0; i < 3; i++) {
        const result = validatePath(targetPath, '/repo/worktree1', '/repo/worktree2')
        expect(result.isValid).toBe(true)
      }
    })
  })

  describe('Edge cases', () => {
    it('空のパスを処理する', () => {
      const result = validatePath('', '/repo/worktree1', '/repo/worktree2')
      expect(result.isValid).toBe(true) // 空のパスはworktree2のルートとして解釈される
    })

    it('特殊文字を含むパスを処理する', () => {
      const result = validatePath(
        '/repo/worktree2/src/file-with-@special#chars$.ts',
        '/repo/worktree1',
        '/repo/worktree2'
      )
      expect(result.isValid).toBe(true)
    })
  })
})

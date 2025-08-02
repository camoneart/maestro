import path from 'path'
import chalk from 'chalk'

/**
 * パス検証のエラーメッセージ
 */
export const PATH_VALIDATION_ERRORS = {
  DIRECTORY_TRAVERSAL: '🚨 ディレクトリトラバーサル攻撃の可能性があるパスを検出しました',
  OUTSIDE_WORKTREE: '🚨 worktree境界を超えるパスを検出しました',
  INVALID_PATH: '🚨 無効なパスを検出しました',
  LOOP_DETECTED: '🚨 ディレクトリ作成ループを検出しました',
} as const

/**
 * ディレクトリ作成のループを検出するためのトラッカー
 */
class DirectoryLoopTracker {
  private createdPaths: Map<string, number> = new Map()
  private readonly maxDepth = 10
  private readonly maxSamePathCount = 3

  /**
   * パスを記録し、ループを検出
   */
  track(dirPath: string): boolean {
    const normalizedPath = path.normalize(dirPath)
    const depth = normalizedPath.split(path.sep).length

    // 深さチェック
    if (depth > this.maxDepth) {
      console.warn(
        chalk.red(`${PATH_VALIDATION_ERRORS.LOOP_DETECTED}: 深さ ${depth} (最大: ${this.maxDepth})`)
      )
      return false
    }

    // 同じパスの作成回数をチェック
    const count = (this.createdPaths.get(normalizedPath) || 0) + 1
    this.createdPaths.set(normalizedPath, count)

    if (count > this.maxSamePathCount) {
      console.warn(
        chalk.red(
          `${PATH_VALIDATION_ERRORS.LOOP_DETECTED}: ${normalizedPath} が ${count} 回作成されました`
        )
      )
      return false
    }

    return true
  }

  /**
   * トラッカーをリセット
   */
  reset(): void {
    this.createdPaths.clear()
  }
}

// グローバルなループトラッカー
export const loopTracker = new DirectoryLoopTracker()

/**
 * パスがworktree内に収まっているかを検証
 */
export function isPathWithinWorktree(targetPath: string, worktreePath: string): boolean {
  const normalizedTarget = path.resolve(targetPath)
  const normalizedWorktree = path.resolve(worktreePath)

  // worktreeパスで始まっているかチェック
  return (
    normalizedTarget.startsWith(normalizedWorktree + path.sep) ||
    normalizedTarget === normalizedWorktree
  )
}

/**
 * ディレクトリトラバーサル攻撃の可能性があるパスかチェック
 */
export function containsDirectoryTraversal(pathStr: string): boolean {
  // ../ または .. を含むパスを検出
  return (
    pathStr.includes('../') ||
    pathStr.includes('..\\') ||
    pathStr === '..' ||
    pathStr.startsWith('..') ||
    pathStr.endsWith('..')
  )
}

/**
 * 安全なパスかどうかを総合的に検証
 */
export function validatePath(
  targetPath: string,
  _sourceWorktree: string,
  targetWorktree: string
): { isValid: boolean; error?: string } {
  try {
    // 1. ディレクトリトラバーサルチェック
    if (containsDirectoryTraversal(targetPath)) {
      return {
        isValid: false,
        error: `${PATH_VALIDATION_ERRORS.DIRECTORY_TRAVERSAL}: ${targetPath}`,
      }
    }

    // 2. 絶対パスの正規化
    const normalizedPath = path.resolve(targetWorktree, targetPath)

    // 3. worktree境界チェック
    if (!isPathWithinWorktree(normalizedPath, targetWorktree)) {
      return {
        isValid: false,
        error: `${PATH_VALIDATION_ERRORS.OUTSIDE_WORKTREE}: ${normalizedPath}`,
      }
    }

    // 4. ループ検出（ディレクトリ作成時のみ）
    const dirPath = path.dirname(normalizedPath)
    if (!loopTracker.track(dirPath)) {
      return {
        isValid: false,
        error: PATH_VALIDATION_ERRORS.LOOP_DETECTED,
      }
    }

    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error: `${PATH_VALIDATION_ERRORS.INVALID_PATH}: ${error}`,
    }
  }
}

/**
 * 相対パスを安全に計算
 */
export function safeRelativePath(from: string, to: string): string | null {
  try {
    const relativePath = path.relative(from, to)

    // 相対パスが安全でない場合はnullを返す
    if (containsDirectoryTraversal(relativePath)) {
      console.warn(chalk.red(`危険な相対パスを検出: ${relativePath}`))
      return null
    }

    return relativePath
  } catch (error) {
    console.error(chalk.red(`相対パス計算エラー: ${error}`))
    return null
  }
}

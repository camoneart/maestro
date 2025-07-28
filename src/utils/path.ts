import path from 'path'
import { Config } from '../core/config.js'

/**
 * 設定に基づいてパス表示形式をフォーマットする
 * @param absolutePath - 絶対パス
 * @param config - maestro設定
 * @returns フォーマットされたパス文字列
 */
export function formatPath(absolutePath: string, config: Config): string {
  const pathDisplay = config.ui?.pathDisplay || 'absolute'

  if (pathDisplay === 'relative') {
    const relativePath = path.relative(process.cwd(), absolutePath)
    // 同じディレクトリの場合は'.'を返す
    return relativePath === '' ? '.' : relativePath
  }

  return absolutePath
}

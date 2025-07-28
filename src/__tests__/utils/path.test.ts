import { describe, it, expect, beforeEach } from 'vitest'
import path from 'path'
import { formatPath } from '../../utils/path.js'
import { Config } from '../../core/config.js'

describe('formatPath', () => {
  const testAbsolutePath = '/Users/test/projects/maestro/demo-branch'
  let mockConfig: Config

  beforeEach(() => {
    // デフォルト設定
    mockConfig = {
      ui: {
        pathDisplay: 'absolute',
      },
    } as Config
  })

  describe('absolute pathDisplay設定', () => {
    it('absolute設定時は絶対パスをそのまま返す', () => {
      mockConfig.ui = { pathDisplay: 'absolute' }

      const result = formatPath(testAbsolutePath, mockConfig)

      expect(result).toBe(testAbsolutePath)
    })

    it('ui設定がundefinedの場合はabsoluteとして扱う', () => {
      mockConfig.ui = undefined

      const result = formatPath(testAbsolutePath, mockConfig)

      expect(result).toBe(testAbsolutePath)
    })

    it('pathDisplay設定がundefinedの場合はabsoluteとして扱う', () => {
      mockConfig.ui = {}

      const result = formatPath(testAbsolutePath, mockConfig)

      expect(result).toBe(testAbsolutePath)
    })
  })

  describe('relative pathDisplay設定', () => {
    it('relative設定時は相対パスを返す', () => {
      mockConfig.ui = { pathDisplay: 'relative' }

      const result = formatPath(testAbsolutePath, mockConfig)
      const expected = path.relative(process.cwd(), testAbsolutePath)

      expect(result).toBe(expected)
    })

    it('現在のディレクトリと同じ場合は.を返す', () => {
      mockConfig.ui = { pathDisplay: 'relative' }
      const currentDir = process.cwd()

      const result = formatPath(currentDir, mockConfig)

      expect(result).toBe('.')
    })

    it('現在のディレクトリのサブディレクトリの場合は相対パスを返す', () => {
      mockConfig.ui = { pathDisplay: 'relative' }
      const subDir = path.join(process.cwd(), 'subdirectory')

      const result = formatPath(subDir, mockConfig)

      expect(result).toBe('subdirectory')
    })

    it('親ディレクトリの場合は../パスを返す', () => {
      mockConfig.ui = { pathDisplay: 'relative' }
      const parentDir = path.dirname(process.cwd())

      const result = formatPath(parentDir, mockConfig)

      expect(result).toBe('..')
    })
  })

  describe('エラーケース', () => {
    it('空の設定オブジェクトでも動作する', () => {
      const emptyConfig = {} as Config

      const result = formatPath(testAbsolutePath, emptyConfig)

      expect(result).toBe(testAbsolutePath)
    })

    it('空文字列のパスでも安全に処理される', () => {
      mockConfig.ui = { pathDisplay: 'relative' }

      const result = formatPath('', mockConfig)

      // 空文字列の場合、path.relativeは空文字列を返すが、formatPathは'.'を返す
      expect(result).toBe('.')
    })
  })
})

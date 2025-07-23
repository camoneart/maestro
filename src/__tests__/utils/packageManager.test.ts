import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { detectPackageManager } from '../../utils/packageManager.js'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}))

const mockExistsSync = vi.mocked(existsSync)
const mockReadFileSync = vi.mocked(readFileSync)

describe('detectPackageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should detect pnpm when pnpm-lock.yaml exists', () => {
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('pnpm-lock.yaml')
    })

    const result = detectPackageManager('/test/project')
    expect(result).toBe('pnpm')
  })

  it('should detect yarn when yarn.lock exists', () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('pnpm-lock.yaml')) return false
      return path.includes('yarn.lock')
    })

    const result = detectPackageManager('/test/project')
    expect(result).toBe('yarn')
  })

  it('should detect npm when package-lock.json exists', () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('pnpm-lock.yaml')) return false
      if (path.includes('yarn.lock')) return false
      return path.includes('package-lock.json')
    })

    const result = detectPackageManager('/test/project')
    expect(result).toBe('npm')
  })

  it('should detect package manager from package.json packageManager field', () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('pnpm-lock.yaml')) return false
      if (path.includes('yarn.lock')) return false
      if (path.includes('package-lock.json')) return false
      return path.includes('package.json')
    })

    mockReadFileSync.mockReturnValue(JSON.stringify({
      packageManager: 'pnpm@8.15.0'
    }))

    const result = detectPackageManager('/test/project')
    expect(result).toBe('pnpm')
  })

  it('should default to npm when no lock files or package.json packageManager field exist', () => {
    mockExistsSync.mockReturnValue(false)

    const result = detectPackageManager('/test/project')
    expect(result).toBe('npm')
  })

  it('should default to npm when package.json is invalid JSON', () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('pnpm-lock.yaml')) return false
      if (path.includes('yarn.lock')) return false
      if (path.includes('package-lock.json')) return false
      return path.includes('package.json')
    })

    mockReadFileSync.mockReturnValue('invalid json')

    const result = detectPackageManager('/test/project')
    expect(result).toBe('npm')
  })

  it('should default to npm when packageManager field has unsupported value', () => {
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('pnpm-lock.yaml')) return false
      if (path.includes('yarn.lock')) return false
      if (path.includes('package-lock.json')) return false
      return path.includes('package.json')
    })

    mockReadFileSync.mockReturnValue(JSON.stringify({
      packageManager: 'bun@1.0.0'
    }))

    const result = detectPackageManager('/test/project')
    expect(result).toBe('npm')
  })

  it('should prioritize lock files over package.json packageManager field', () => {
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('pnpm-lock.yaml') || path.includes('package.json')
    })

    mockReadFileSync.mockReturnValue(JSON.stringify({
      packageManager: 'yarn@3.0.0'
    }))

    const result = detectPackageManager('/test/project')
    expect(result).toBe('pnpm')
  })
})
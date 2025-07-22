import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI_PATH = path.resolve(__dirname, '../../../dist/cli.js')

describe('init command', () => {
  const testDir = path.join(__dirname, '../../../test-temp')
  const originalCwd = process.cwd()

  beforeEach(() => {
    // テスト用ディレクトリが存在すれば削除
    if (existsSync(testDir)) {
      execSync(`rm -rf "${testDir}"`)
    }
    // テスト用ディレクトリを作成
    execSync(`mkdir -p "${testDir}"`)
    process.chdir(testDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    if (existsSync(testDir)) {
      execSync(`rm -rf "${testDir}"`)
    }
  })

  describe('--help', () => {
    it('should display help message', () => {
      const result = execSync(`node "${CLI_PATH}" init --help`, { encoding: 'utf8' })
      expect(result).toContain('プロジェクトにMaestro設定を初期化')
      expect(result).toContain('--minimal')
      expect(result).toContain('--package-manager')
      expect(result).toContain('--yes')
    })
  })

  describe('--minimal', () => {
    it('should create minimal .maestro.json', () => {
      const result = execSync(`node "${CLI_PATH}" init --minimal`, { encoding: 'utf8' })
      
      expect(result).toContain('Welcome to Maestro Setup!')
      expect(result).toContain('Maestro の設定が完了しました！')
      
      const configPath = path.join(testDir, '.maestro.json')
      expect(existsSync(configPath)).toBe(true)
      
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      expect(config.worktrees.path).toBe('.git/orchestra-members')
      expect(config.development.autoSetup).toBe(true)
      expect(config.development.defaultEditor).toBe('cursor')
    })
  })

  describe('--yes with package.json', () => {
    it('should create default config with npm detection', () => {
      // package.jsonとpackage-lock.jsonを作成（npmプロジェクト）
      writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        dependencies: { react: '^18.0.0' }
      }))
      writeFileSync(path.join(testDir, 'package-lock.json'), '{}')

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8' })
      
      expect(result).toContain('検出されたプロジェクト: React ✅')
      
      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      
      expect(config.worktrees.branchPrefix).toBe('feature/')
      expect(config.postCreate.commands).toContain('npm install')
      expect(config.postCreate.copyFiles).toContain('.env')
    })

    it('should create default config with pnpm detection', () => {
      // package.jsonとpnpm-lock.yamlを作成（pnpmプロジェクト）
      writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        dependencies: { next: '^14.0.0' }
      }))
      writeFileSync(path.join(testDir, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0')

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8' })
      
      expect(result).toContain('検出されたプロジェクト: Next.js ✅')
      
      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      
      expect(config.postCreate.commands).toContain('pnpm install')
      expect(config.postCreate.copyFiles).toContain('.env.local')
    })
  })

  describe('--package-manager option', () => {
    it('should use specified package manager', () => {
      const result = execSync(`node "${CLI_PATH}" init --yes --package-manager yarn`, { encoding: 'utf8' })
      
      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      
      expect(config.postCreate.commands).toContain('yarn install')
    })
  })

  describe('existing .maestro.json', () => {
    it('should create config without prompting when --yes is used', () => {
      // 既存の.maestro.jsonを作成
      const existingConfig = { test: 'existing' }
      writeFileSync(path.join(testDir, '.maestro.json'), JSON.stringify(existingConfig))

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8' })
      
      expect(result).toContain('Maestro の設定が完了しました！')
      
      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      
      // 新しい設定で上書きされている
      expect(config).not.toHaveProperty('test')
      expect(config).toHaveProperty('worktrees')
    })
  })

  describe('project type detection', () => {
    it('should detect Python project', () => {
      writeFileSync(path.join(testDir, 'requirements.txt'), 'flask==2.0.0')

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8' })
      
      expect(result).toContain('検出されたプロジェクト: Python ✅')
      
      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      
      expect(config.postCreate.commands).toContain('pip install -r requirements.txt')
    })

    it('should detect Go project', () => {
      writeFileSync(path.join(testDir, 'go.mod'), 'module test\n\ngo 1.19')

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8' })
      
      expect(result).toContain('検出されたプロジェクト: Go ✅')
      
      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      
      expect(config.postCreate.commands).toContain('go mod download')
    })
  })
})
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { detectProjectType, createMinimalConfig, createDefaultConfig, createInteractiveConfig, type ProjectType, type PackageManager } from '../../commands/init.js'
import inquirer from 'inquirer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI_PATH = path.resolve(__dirname, '../../../dist/cli.js')

// CI環境でのパス確認
if (!existsSync(CLI_PATH)) {
  throw new Error(`CLI not found at ${CLI_PATH}. Run 'pnpm build' first.`)
}

describe('init command', () => {
  const testDir = path.join(__dirname, '../../../test-temp')
  const originalCwd = process.cwd()

  beforeEach(() => {
    // テスト用ディレクトリが存在すれば削除
    if (existsSync(testDir)) {
      execSync(`rm -rf "${testDir}"`, { timeout: 10000 })
    }
    // テスト用ディレクトリを作成
    execSync(`mkdir -p "${testDir}"`, { timeout: 5000 })
    process.chdir(testDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    // CI環境での権限問題を避けるため、try-catch で囲む
    try {
      if (existsSync(testDir)) {
        execSync(`rm -rf "${testDir}"`, { timeout: 10000 })
      }
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error)
    }
  })

  describe('--help', () => {
    it('should display help message', () => {
      const result = execSync(`node "${CLI_PATH}" init --help`, {
        encoding: 'utf8',
        timeout: 30000,
      })
      expect(result).toContain('プロジェクトにMaestro設定を初期化')
      expect(result).toContain('--minimal')
      expect(result).toContain('--package-manager')
      expect(result).toContain('--yes')
    })
  })

  describe('--minimal', () => {
    it('should create minimal .maestro.json', () => {
      const result = execSync(`node "${CLI_PATH}" init --minimal`, {
        encoding: 'utf8',
        timeout: 30000,
      })

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
      writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: { react: '^18.0.0' },
        })
      )
      writeFileSync(path.join(testDir, 'package-lock.json'), '{}')

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8', timeout: 30000 })

      expect(result).toContain('検出されたプロジェクト: React ✅')

      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))

      expect(config.worktrees.branchPrefix).toBe('feature/')
      expect(config.postCreate.commands).toContain('npm install')
      expect(config.postCreate.copyFiles).toContain('.env')
    })

    it('should create default config with pnpm detection', () => {
      // package.jsonとpnpm-lock.yamlを作成（pnpmプロジェクト）
      writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: { next: '^14.0.0' },
        })
      )
      writeFileSync(path.join(testDir, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0')

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8', timeout: 30000 })

      expect(result).toContain('検出されたプロジェクト: Next.js ✅')

      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))

      expect(config.postCreate.commands).toContain('pnpm install')
      expect(config.postCreate.copyFiles).toContain('.env.local')
    })
  })

  describe('--package-manager option', () => {
    it('should use specified package manager', () => {
      const result = execSync(`node "${CLI_PATH}" init --yes --package-manager yarn`, {
        encoding: 'utf8',
        timeout: 30000,
      })

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

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8', timeout: 30000 })

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

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8', timeout: 30000 })

      expect(result).toContain('検出されたプロジェクト: Python ✅')

      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))

      expect(config.postCreate.commands).toContain('pip install -r requirements.txt')
    })

    it('should detect Go project', () => {
      writeFileSync(path.join(testDir, 'go.mod'), 'module test\n\ngo 1.19')

      const result = execSync(`node "${CLI_PATH}" init --yes`, { encoding: 'utf8', timeout: 30000 })

      expect(result).toContain('検出されたプロジェクト: Go ✅')

      const configPath = path.join(testDir, '.maestro.json')
      const config = JSON.parse(readFileSync(configPath, 'utf8'))

      expect(config.postCreate.commands).toContain('go mod download')
    })
  })

  // 関数の直接テスト（カバレッジ向上のため）
  describe('Unit Tests', () => {
    describe('createMinimalConfig', () => {
      it('should create minimal configuration', () => {
        const config = createMinimalConfig()
        
        expect(config).toEqual({
          worktrees: {
            path: '.git/orchestra-members',
          },
          development: {
            autoSetup: true,
            defaultEditor: 'cursor',
          },
        })
      })
    })

    describe('createDefaultConfig', () => {
      it('should create default config with npm project', () => {
        const projectType: ProjectType = {
          name: 'React',
          detected: true,
          packageManager: 'npm',
          setupCommands: ['npm install'],
          syncFiles: ['.env', '.env.local']
        }

        const config = createDefaultConfig(projectType)

        expect(config.worktrees).toEqual({
          path: '.git/orchestra-members',
          branchPrefix: 'feature/',
        })
        expect(config.development).toEqual({
          autoSetup: true,
          defaultEditor: 'cursor',
        })
        expect(config.postCreate).toEqual({
          copyFiles: ['.env', '.env.local'],
          commands: ['npm install'],
        })
      })

      it('should override package manager when explicitly specified', () => {
        const projectType: ProjectType = {
          name: 'React',
          detected: true,
          packageManager: 'npm',
          setupCommands: ['npm install'],
          syncFiles: ['.env']
        }

        const config = createDefaultConfig(projectType, 'yarn')

        expect((config.postCreate as any).commands).toEqual(['yarn install'])
      })

      it('should handle projects without package manager', () => {
        const projectType: ProjectType = {
          name: 'Python',
          detected: true,
          packageManager: 'none',
          setupCommands: ['pip install -r requirements.txt'],
          syncFiles: ['.env']
        }

        const config = createDefaultConfig(projectType)

        expect((config.postCreate as any).commands).toEqual(['pip install -r requirements.txt'])
      })
    })

    describe('detectProjectType', () => {
      const originalCwd = process.cwd()
      
      beforeEach(() => {
        process.chdir(testDir)
      })

      afterEach(() => {
        process.chdir(originalCwd)
      })

      it('should detect React project', () => {
        writeFileSync(
          path.join(testDir, 'package.json'),
          JSON.stringify({
            name: 'test-project',
            dependencies: { react: '^18.0.0' },
          })
        )
        writeFileSync(path.join(testDir, 'package-lock.json'), '{}')

        const result = detectProjectType()

        expect(result.name).toBe('React')
        expect(result.detected).toBe(true)
        expect(result.packageManager).toBe('npm')
        expect(result.setupCommands).toEqual(['npm install'])
        expect(result.syncFiles).toEqual(['.env', '.env.local'])
      })

      it('should detect Next.js project', () => {
        writeFileSync(
          path.join(testDir, 'package.json'),
          JSON.stringify({
            name: 'test-project',
            dependencies: { next: '^14.0.0' },
          })
        )
        writeFileSync(path.join(testDir, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0')

        const result = detectProjectType()

        expect(result.name).toBe('Next.js')
        expect(result.packageManager).toBe('pnpm')
        expect(result.syncFiles).toEqual(['.env', '.env.local', '.env.development.local'])
      })

      it('should detect Vue.js project', () => {
        writeFileSync(
          path.join(testDir, 'package.json'),
          JSON.stringify({
            name: 'test-project',
            dependencies: { vue: '^3.0.0' },
          })
        )
        writeFileSync(path.join(testDir, 'yarn.lock'), '')

        const result = detectProjectType()

        expect(result.name).toBe('Vue.js')
        expect(result.packageManager).toBe('yarn')
      })

      it('should detect Python project', () => {
        writeFileSync(path.join(testDir, 'requirements.txt'), 'flask==2.0.0')

        const result = detectProjectType()

        expect(result.name).toBe('Python')
        expect(result.detected).toBe(true)
        expect(result.packageManager).toBe('none')
        expect(result.setupCommands).toEqual(['pip install -r requirements.txt'])
      })

      it('should detect Go project', () => {
        writeFileSync(path.join(testDir, 'go.mod'), 'module test\n\ngo 1.19')

        const result = detectProjectType()

        expect(result.name).toBe('Go')
        expect(result.detected).toBe(true)
        expect(result.setupCommands).toEqual(['go mod download'])
      })

      it('should default to generic project', () => {
        // No project files

        const result = detectProjectType()

        expect(result.name).toBe('Generic')
        expect(result.detected).toBe(false)
        expect(result.packageManager).toBe('none')
        expect(result.setupCommands).toEqual([])
        expect(result.syncFiles).toEqual(['.env'])
      })

      it('should detect Node.js project without framework', () => {
        writeFileSync(
          path.join(testDir, 'package.json'),
          JSON.stringify({
            name: 'test-project',
            dependencies: { express: '^4.0.0' },
          })
        )

        const result = detectProjectType()

        expect(result.name).toBe('Node.js')
        expect(result.detected).toBe(true)
        expect(result.packageManager).toBe('npm')
      })

      it('should detect pyproject.toml Python project', () => {
        writeFileSync(path.join(testDir, 'pyproject.toml'), '[project]\nname = "test"')

        const result = detectProjectType()

        expect(result.name).toBe('Python')
        expect(result.detected).toBe(true)
      })
    })

    describe('createInteractiveConfig', () => {
      it('should create config based on user inputs', async () => {
        const projectType: ProjectType = {
          name: 'React',
          detected: true,
          packageManager: 'npm',
          setupCommands: ['npm install'],
          syncFiles: ['.env', '.env.local']
        }

        // Mock inquirer prompt
        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
          packageManager: 'pnpm',
          worktreePath: '.git/orchestra-members',
          branchPrefix: 'feature/',
          defaultEditor: 'cursor',
          autoSetup: true,
          copyEnvFiles: true,
          syncFiles: ['.env', '.env.local']
        })

        const config = await createInteractiveConfig(projectType)

        expect(config.worktrees).toEqual({
          path: '.git/orchestra-members',
          branchPrefix: 'feature/',
        })
        expect(config.development).toEqual({
          autoSetup: true,
          defaultEditor: 'cursor',
        })
        expect(config.postCreate).toEqual({
          copyFiles: ['.env', '.env.local'],
          commands: ['pnpm install'],
        })
      })

      it('should handle case without auto setup', async () => {
        const projectType: ProjectType = {
          name: 'React',
          detected: true,
          packageManager: 'npm',
          setupCommands: ['npm install'],
          syncFiles: ['.env']
        }

        vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({
          packageManager: 'none',
          worktreePath: '../worktrees',
          branchPrefix: 'task/',
          defaultEditor: 'vim',
          autoSetup: false
        })

        const config = await createInteractiveConfig(projectType)

        expect(config.worktrees).toEqual({
          path: '../worktrees',
          branchPrefix: 'task/',
        })
        expect(config.development).toEqual({
          autoSetup: false,
          defaultEditor: 'vim',
        })
        expect(config.postCreate).toEqual({
          copyFiles: [],
          commands: [],
        })
      })
    })
  })
})

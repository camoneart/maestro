import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import path from 'path'
import { readFile } from 'fs/promises'

describe('maestro E2E basic tests', () => {
  const mstPath = path.resolve('dist/cli.js')

  it('should execute without errors and show help', async () => {
    // helpコマンドの出力を確認（エラーでも正常）
    const result = await execa('node', [mstPath, '--help'], { reject: false })
    const output = result.stdout + result.stderr
    
    // 基本的なコマンドが表示されることを確認
    expect(output).toContain('create')
    expect(output).toContain('list')
    expect(output).toContain('delete')
    expect(output).toContain('sync')
    expect(output).toContain('watch')
    expect(output).toContain('health')
    expect(output).toContain('snapshot')
  })

  it('should show version', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf-8'))
    const result = await execa('node', [mstPath, '--version'], { reject: false })
    const output = result.stdout + result.stderr
    expect(output).toContain(packageJson.version)
  })

  it('should handle list command in non-git directory with error', async () => {
    const result = await execa('node', [mstPath, 'list'], { 
      reject: false,
      cwd: '/tmp' 
    })
    
    expect(result.exitCode).toBe(1)
    const output = result.stdout + result.stderr
    expect(output).toContain('Gitリポジトリではありません')
  })
})
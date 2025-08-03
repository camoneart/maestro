import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.join(__dirname, '../../dist/cli.js')
const testRepoPath = path.join(__dirname, '../test-repo')

describe('E2E: Directory Check Feature', () => {
  beforeAll(async () => {
    // テスト用のGitリポジトリを作成
    await fs.mkdir(testRepoPath, { recursive: true })
    process.chdir(testRepoPath)
    await execa('git', ['init'])
    await execa('git', ['config', 'user.email', 'test@example.com'])
    await execa('git', ['config', 'user.name', 'Test User'])
    
    // 初期コミットを作成
    await fs.writeFile('README.md', '# Test Repository')
    await execa('git', ['add', '.'])
    await execa('git', ['commit', '-m', 'Initial commit'])
  })

  afterAll(async () => {
    // クリーンアップ
    process.chdir(__dirname)
    await fs.rm(testRepoPath, { recursive: true, force: true })
  })

  it('should handle existing directory during worktree creation', async () => {
    // 1. 最初にworktreeを作成
    const branchName = 'test-existing-dir'
    const worktreePath = path.join(testRepoPath, '..', branchName)
    
    // maestroでworktreeを作成
    const result1 = await execa('node', [cliPath, 'create', branchName])
    expect(result1.exitCode).toBe(0)
    expect(result1.stdout).toContain('演奏者')
    
    // worktreeを削除（ディレクトリは残す）
    await execa('git', ['worktree', 'remove', worktreePath, '--force'])
    
    // ディレクトリが残っていることを確認
    const dirExists = await fs.stat(worktreePath).then(() => true).catch(() => false)
    expect(dirExists).toBe(true)
    
    // 2. 同じ名前でworktreeを再作成しようとする（キャンセルを選択）
    const childProcess = exec(`node ${cliPath} create ${branchName}`)
    
    // プロンプトが表示されるまで待つ
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // キャンセルを選択（Ctrl+C）
    childProcess.kill('SIGINT')
    
    const result2 = await childProcess.catch(error => error)
    expect(result2.code).not.toBe(0)
    
    // ディレクトリを手動で削除
    await fs.rm(worktreePath, { recursive: true, force: true })
  })

  it('should delete existing directory and create worktree when user chooses delete', async () => {
    const branchName = 'test-delete-and-create'
    const worktreePath = path.join(testRepoPath, '..', branchName)
    
    // 既存のディレクトリを作成
    await fs.mkdir(worktreePath, { recursive: true })
    await fs.writeFile(path.join(worktreePath, 'test.txt'), 'test content')
    
    // maestroでworktreeを作成（削除オプションを自動選択）
    // --yesオプションを使用して自動的に削除を選択
    const result = await execa('node', [cliPath, 'create', branchName, '--yes'])
    
    // worktreeが作成されたことを確認
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('演奏者')
    
    // test.txtが削除されていることを確認
    const fileExists = await fs.stat(path.join(worktreePath, 'test.txt')).then(() => true).catch(() => false)
    expect(fileExists).toBe(false)
    
    // クリーンアップ
    await execa('git', ['worktree', 'remove', worktreePath, '--force'])
    await execa('git', ['branch', '-D', branchName])
  })

  it('should handle github issue command with existing directory', async () => {
    const issueNumber = '999'
    const branchName = `issue-${issueNumber}`
    const worktreePath = path.join(testRepoPath, '..', branchName)
    
    // 既存のディレクトリを作成
    await fs.mkdir(worktreePath, { recursive: true })
    
    // GitHub CLIのモックを作成
    const mockGhPath = path.join(testRepoPath, 'gh')
    const mockGhContent = `#!/bin/bash
echo '{"number": ${issueNumber}, "title": "Test Issue", "body": "Test body", "url": "https://github.com/test/repo/issues/${issueNumber}"}'
`
    await fs.writeFile(mockGhPath, mockGhContent)
    await fs.chmod(mockGhPath, '755')
    
    // PATHを変更してモックを使用
    const env = { ...process.env, PATH: `${testRepoPath}:${process.env.PATH}` }
    
    // maestroでissueコマンドを実行（--yesで自動削除）
    const result = await execa('node', [cliPath, 'github', 'issue', issueNumber, '--yes'], { env })
    
    // worktreeが作成されたことを確認
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(branchName)
    
    // クリーンアップ
    await execa('git', ['worktree', 'remove', worktreePath, '--force'])
    await execa('git', ['branch', '-D', branchName])
    await fs.rm(mockGhPath)
  })
})
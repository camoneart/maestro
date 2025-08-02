import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import { join } from 'path'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

const CLI_PATH = join(process.cwd(), 'dist/cli.js')

describe('CLI Error Handling E2E', () => {
  let testDir: string

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await mkdtemp(join(tmpdir(), 'maestro-test-'))
    
    // Initialize git repo
    await execa('git', ['init'], { cwd: testDir })
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: testDir })
    await execa('git', ['config', 'user.name', 'Test User'], { cwd: testDir })
    
    // Create initial commit
    await execa('touch', ['README.md'], { cwd: testDir })
    await execa('git', ['add', '.'], { cwd: testDir })
    await execa('git', ['commit', '-m', 'Initial commit'], { cwd: testDir })
    
    // Mock gh CLI
    const mockGhScript = `#!/bin/bash
if [[ "$1" == "--version" ]]; then
  echo "gh version 2.0.0"
  exit 0
elif [[ "$1" == "auth" && "$2" == "status" ]]; then
  echo "Logged in"
  exit 0
elif [[ "$1" == "issue" && "$2" == "view" && "$3" == "182" ]]; then
  echo '{"number": 182, "title": "Test Issue", "author": {"login": "testuser"}}'
  exit 0
else
  echo "Unknown command"
  exit 1
fi
`
    const mockGhPath = join(testDir, 'gh')
    await execa('bash', ['-c', `echo '${mockGhScript}' > ${mockGhPath} && chmod +x ${mockGhPath}`])
    
    // Add mock gh to PATH
    process.env.PATH = `${testDir}:${process.env.PATH}`
  })

  afterEach(async () => {
    // Clean up
    await rm(testDir, { recursive: true, force: true })
  })

  it('should reject unknown options and not create worktree', async () => {
    try {
      await execa('node', [CLI_PATH, 'github', 'issue', '182', '--unknown-option', '4'], {
        cwd: testDir,
        reject: true,
      })
      
      // Should not reach here
      expect.fail('Command should have failed with unknown option')
    } catch (error: any) {
      // Check error output contains unknown option message
      expect(error.stderr).toContain('unknown option')
      expect(error.stderr).toContain('--unknown-option')
      
      // Verify worktree was not created
      const { stdout } = await execa('git', ['worktree', 'list'], { cwd: testDir })
      const worktrees = stdout.split('\n').filter(line => line.trim())
      expect(worktrees).toHaveLength(1) // Only main worktree
    }
  })

  it('should handle multiple unknown options', async () => {
    try {
      await execa('node', [CLI_PATH, 'github', 'issue', '182', '--invalid-opt', '--another-invalid'], {
        cwd: testDir,
        reject: true,
      })
      
      expect.fail('Command should have failed')
    } catch (error: any) {
      expect(error.stderr).toContain('unknown option')
      expect(error.stderr).toContain('--invalid-opt')
      
      // Verify no worktree was created
      const { stdout } = await execa('git', ['worktree', 'list'], { cwd: testDir })
      expect(stdout.split('\n').filter(line => line.trim())).toHaveLength(1)
    }
  })

  it('should work correctly with valid options', async () => {
    try {
      // This will fail because we're in non-interactive mode, but that's expected
      await execa('node', [CLI_PATH, 'github', 'issue', '182'], {
        cwd: testDir,
        reject: true,
        env: {
          ...process.env,
          CI: 'true', // Force non-interactive mode
        },
      })
    } catch (error: any) {
      // The command will fail because inquirer can't run in non-interactive mode
      // But it should not be due to unknown option
      expect(error.stderr).not.toContain('unknown option')
    }
  })
})
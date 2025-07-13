import { vi } from 'vitest'
import { Worktree } from '../../types'

// モックデータ生成ヘルパー
export const createMockWorktree = (overrides?: Partial<Worktree>): Worktree => ({
  path: '/path/to/worktree',
  head: 'abcdef1234567890',
  branch: 'refs/heads/feature-branch',
  detached: false,
  isCurrentDirectory: false,
  locked: false,
  prunable: false,
  ...overrides,
})

export const createMockWorktrees = (count: number): Worktree[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockWorktree({
      path: `/path/to/worktree-${i}`,
      branch: `refs/heads/feature-${i}`,
      head: `abcdef${i}`.padEnd(16, '0'),
    })
  )
}

// execa モックレスポンス生成
export const createMockExecaResponse = (stdout = '', stderr = '', exitCode = 0) => ({
  stdout,
  stderr,
  exitCode,
  failed: exitCode !== 0,
  timedOut: false,
  isCanceled: false,
  killed: false,
  command: '',
  escapedCommand: '',
  cwd: process.cwd(),
  duration: 0,
})

// Git worktree list出力のモック生成
export const createMockWorktreeOutput = (worktrees: Worktree[]): string => {
  return worktrees
    .map(wt => {
      let output = `worktree ${wt.path}\nHEAD ${wt.head}\n`
      if (wt.branch) {
        output += `branch ${wt.branch}\n`
      }
      if (wt.locked) {
        output += `locked${wt.reason ? ' ' + wt.reason : ''}\n`
      }
      if (wt.prunable) {
        output += `prunable${wt.reason ? ' ' + wt.reason : ''}\n`
      }
      return output
    })
    .join('\n')
}

// GitHub PR型定義
interface MockPullRequest {
  number: number
  title: string
  author: { login: string }
  headRefName: string
  baseRefName: string
  state: string
  url: string
  draft: boolean
}

// GitHub PR/Issueモックデータ
export const createMockPullRequest = (overrides?: Partial<MockPullRequest>): MockPullRequest => ({
  number: 123,
  title: 'Test Pull Request',
  author: { login: 'testuser' },
  headRefName: 'feature-branch',
  baseRefName: 'main',
  state: 'OPEN',
  url: 'https://github.com/owner/repo/pull/123',
  draft: false,
  ...overrides,
})

// GitHub Issue型定義
interface MockIssue {
  number: number
  title: string
  author: { login: string }
  state: string
  url: string
  labels: string[]
}

export const createMockIssue = (overrides?: Partial<MockIssue>): MockIssue => ({
  number: 456,
  title: 'Test Issue',
  author: { login: 'testuser' },
  state: 'OPEN',
  url: 'https://github.com/owner/repo/issues/456',
  labels: [],
  ...overrides,
})

// Spinner モックヘルパー
export const createMockSpinner = () => {
  const spinner = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
    isSpinning: false,
  }

  spinner.start.mockImplementation(function (text?: string) {
    if (text) spinner.text = text
    spinner.isSpinning = true
    return spinner
  })

  spinner.stop.mockImplementation(function () {
    spinner.isSpinning = false
    return spinner
  })

  return spinner
}

// Config モックヘルパー
import { Config } from '../../core/config'

export const createMockConfig = (overrides?: Partial<Config>): Config => ({
  worktrees: {
    path: '.git/shadow-clones',
    branchPrefix: 'feature/',
  },
  development: {
    autoSetup: true,
    syncFiles: ['.env', '.env.local'],
    defaultEditor: 'cursor',
  },
  github: {
    autoFetch: true,
    branchNaming: {
      prTemplate: 'pr-{number}',
      issueTemplate: 'issue-{number}',
    },
  },
  ...overrides,
})

// コマンドエラー型定義
interface CommandError extends Error {
  exitCode: number
  stderr: string
}

// エラーレスポンスヘルパー
export const createCommandError = (message: string, code = 1): CommandError => {
  const error = new Error(message) as CommandError
  error.exitCode = code
  error.stderr = message
  return error
}

import simpleGit, { SimpleGit } from 'simple-git'
import { Worktree } from '../types/index.js'
import path from 'path'

export class GitWorktreeManager {
  private git: SimpleGit

  constructor(baseDir?: string) {
    this.git = simpleGit(baseDir || process.cwd())
  }

  async createWorktree(branchName: string, baseBranch?: string): Promise<string> {
    // ブランチ名の衝突をチェック
    await this.checkBranchNameCollision(branchName)

    // リポジトリルートを取得して絶対パスを生成
    const repoRoot = await this.getRepositoryRoot()
    const worktreePath = path.join(repoRoot, '..', `maestro-${branchName}`)

    // ベースブランチが指定されていない場合は現在のブランチを使用
    if (!baseBranch) {
      const status = await this.git.status()
      baseBranch = status.current || 'main'
    }

    // ワークツリーを作成
    await this.git.raw(['worktree', 'add', '-b', branchName, worktreePath, baseBranch])

    return path.resolve(worktreePath)
  }

  async attachWorktree(existingBranch: string): Promise<string> {
    // リポジトリルートを取得して絶対パスを生成
    const repoRoot = await this.getRepositoryRoot()
    // ワークツリーのパスを生成（ブランチ名からスラッシュを置換）
    const safeBranchName = existingBranch.replace(/\//g, '-')
    const worktreePath = path.join(repoRoot, '..', `maestro-${safeBranchName}`)

    // 既存のブランチでワークツリーを作成
    await this.git.raw(['worktree', 'add', worktreePath, existingBranch])

    return path.resolve(worktreePath)
  }

  async listWorktrees(): Promise<Worktree[]> {
    const output = await this.git.raw(['worktree', 'list', '--porcelain'])
    const worktrees: Worktree[] = []

    const lines = output.split('\n').filter(line => line.trim())
    let currentWorktree: Partial<Worktree> = {}

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree as Worktree)
        }
        currentWorktree = {
          path: line.substring(9),
          detached: false,
          prunable: false,
          locked: false,
        }
      } else if (line.startsWith('HEAD ')) {
        currentWorktree.head = line.substring(5)
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7)
      } else if (line === 'detached') {
        currentWorktree.detached = true
      } else if (line === 'prunable') {
        currentWorktree.prunable = true
      } else if (line.startsWith('locked')) {
        currentWorktree.locked = true
        if (line.includes(' ')) {
          currentWorktree.reason = line.substring(line.indexOf(' ') + 1)
        }
      }
    }

    if (currentWorktree.path) {
      worktrees.push(currentWorktree as Worktree)
    }

    return worktrees
  }

  async deleteWorktree(branchName: string, force: boolean = false): Promise<void> {
    const worktrees = await this.listWorktrees()
    const worktree = worktrees.find(wt => {
      // refs/heads/プレフィックスを除去して比較
      const branch = wt.branch?.replace('refs/heads/', '')
      return branch === branchName
    })

    if (!worktree) {
      throw new Error(`ワークツリー '${branchName}' が見つかりません`)
    }

    // ワークツリーを削除
    const args = ['worktree', 'remove']
    if (force) args.push('--force')
    args.push(worktree.path)

    await this.git.raw(args)
  }

  async getCurrentBranch(): Promise<string | null> {
    const status = await this.git.status()
    return status.current
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status()
      return true
    } catch {
      return false
    }
  }

  async getAllBranches(): Promise<{ local: string[]; remote: string[] }> {
    const localBranches = await this.git.branchLocal()
    const remoteBranches = await this.git.branch(['-r'])

    return {
      local: localBranches.all.filter(b => !b.startsWith('remotes/')),
      remote: remoteBranches.all
        .filter(b => b.startsWith('remotes/'))
        .map(b => b.replace('remotes/', '')),
    }
  }

  async listLocalBranches(): Promise<string[]> {
    const localBranches = await this.git.branchLocal()
    return localBranches.all.filter(b => !b.startsWith('remotes/'))
  }

  async fetchAll(): Promise<void> {
    await this.git.fetch(['--all'])
  }

  async getLastCommit(
    worktreePath: string
  ): Promise<{ date: string; message: string; hash: string } | null> {
    try {
      const gitInWorktree = simpleGit(worktreePath)
      const log = await gitInWorktree.log({ maxCount: 1 })

      if (log.latest) {
        return {
          date: log.latest.date,
          message: log.latest.message,
          hash: log.latest.hash.substring(0, 7),
        }
      }
      return null
    } catch {
      return null
    }
  }

  async getRepositoryRoot(): Promise<string> {
    try {
      const output = await this.git.raw(['rev-parse', '--show-toplevel'])
      return output.trim()
    } catch {
      throw new Error('リポジトリルートの取得に失敗しました')
    }
  }

  async isGitignored(filePath: string): Promise<boolean> {
    try {
      // git check-ignore returns 0 if the file is ignored
      await this.git.raw(['check-ignore', filePath])
      return true
    } catch {
      // Non-zero exit code means the file is not ignored
      return false
    }
  }

  async checkBranchNameCollision(branchName: string): Promise<void> {
    const branches = await this.getAllBranches()
    const allBranches = [...branches.local, ...branches.remote.map(r => r.replace(/^[^/]+\//, ''))]

    // 完全一致のチェック
    if (allBranches.includes(branchName)) {
      throw new Error(`ブランチ '${branchName}' は既に存在します`)
    }

    // プレフィックス衝突のチェック（新しいブランチが既存ブランチのプレフィックスになる場合）
    const conflictingBranches = allBranches.filter(existing =>
      existing.startsWith(branchName + '/')
    )

    if (conflictingBranches.length > 0) {
      const examples = conflictingBranches.slice(0, 3).join(', ')
      throw new Error(
        `ブランチ '${branchName}' を作成できません。以下の既存ブランチと競合します: ${examples}${
          conflictingBranches.length > 3 ? ` など (${conflictingBranches.length}件)` : ''
        }`
      )
    }

    // 逆方向の衝突チェック（既存ブランチが新しいブランチのプレフィックスになる場合）
    const parentConflicts = allBranches.filter(existing => branchName.startsWith(existing + '/'))

    if (parentConflicts.length > 0) {
      const examples = parentConflicts.slice(0, 3).join(', ')
      throw new Error(
        `ブランチ '${branchName}' を作成できません。以下の既存ブランチのサブブランチになります: ${examples}${
          parentConflicts.length > 3 ? ` など (${parentConflicts.length}件)` : ''
        }`
      )
    }
  }

  generateAlternativeBranchName(originalName: string, allBranches: string[]): string {
    let counter = 1
    let alternativeName = `${originalName}-${counter}`

    while (
      allBranches.includes(alternativeName) ||
      allBranches.some(
        b => b.startsWith(alternativeName + '/') || alternativeName.startsWith(b + '/')
      )
    ) {
      counter++
      alternativeName = `${originalName}-${counter}`
    }

    return alternativeName
  }
}

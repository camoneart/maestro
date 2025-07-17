import simpleGit, { SimpleGit } from 'simple-git'
import { Worktree } from '../types/index.js'
import path from 'path'

export class GitWorktreeManager {
  private git: SimpleGit

  constructor(baseDir?: string) {
    this.git = simpleGit(baseDir || process.cwd())
  }

  async createWorktree(branchName: string, baseBranch?: string): Promise<string> {
    // ワークツリーのパスを生成
    const worktreePath = path.join('.git', 'orchestrations', branchName)

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
    // ワークツリーのパスを生成（ブランチ名からスラッシュを置換）
    const safeBranchName = existingBranch.replace(/\//g, '-')
    const worktreePath = path.join('.git', 'orchestrations', safeBranchName)

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
}

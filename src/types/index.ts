export interface Worktree {
  path: string
  branch: string
  head: string
  detached: boolean
  prunable: boolean
  locked: boolean
  reason?: string
  isCurrentDirectory?: boolean
  isLocked?: boolean
  isPrunable?: boolean
}

export interface ScjConfig {
  worktreesPath?: string
  defaultBranchPrefix?: string
  autoSetupEnv?: boolean
  envFilesToSync?: string[]
  defaultEditor?: 'vscode' | 'cursor' | 'none'
}

export interface CreateOptions {
  base?: string
  open?: boolean
  setup?: boolean
}

export interface DeleteOptions {
  force?: boolean
  removeRemote?: boolean
}
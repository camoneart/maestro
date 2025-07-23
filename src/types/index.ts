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

export interface MaestroConfig {
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
  tmux?: boolean
  tmuxH?: boolean
  tmuxV?: boolean
  tmuxVertical?: boolean
  tmuxHorizontal?: boolean
  claude?: boolean
  yes?: boolean
  shell?: boolean
  exec?: string
  copyFile?: string[]
}

export interface DeleteOptions {
  force?: boolean
  removeRemote?: boolean
}

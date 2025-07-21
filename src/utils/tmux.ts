import { execa } from 'execa'
import { spawn } from 'child_process'

/**
 * tmuxのステータスラインを設定
 */
export async function setupTmuxStatusLine(): Promise<void> {
  try {
    // 右側のステータスラインにGitブランチ情報を表示
    await execa('tmux', [
      'set-option',
      '-g',
      'status-right',
      '#[fg=yellow]#{?client_prefix,#[reverse]<Prefix>#[noreverse] ,}#[fg=cyan]#(cd #{pane_current_path} && git branch --show-current 2>/dev/null || echo "no branch") #[fg=white]| %H:%M',
    ])

    // ペインボーダーにタイトルを表示
    await execa('tmux', ['set-option', '-g', 'pane-border-status', 'top'])
    await execa('tmux', ['set-option', '-g', 'pane-border-format', ' #{pane_title} '])
  } catch {
    // tmuxが動作していない場合は無視
  }
}

/**
 * tmuxセッション内かどうかを確認
 */
export async function isInTmuxSession(): Promise<boolean> {
  return process.env.TMUX !== undefined
}

/**
 * tmuxペインタイプ
 */
export type TmuxPaneType = 'new-window' | 'vertical-split' | 'horizontal-split'

/**
 * tmuxセッションまたはペインでコマンドを実行
 */
export async function executeTmuxCommand(
  command: string[],
  options: {
    cwd?: string
    env?: Record<string, string>
    paneType?: TmuxPaneType
    sessionName?: string
  } = {}
): Promise<void> {
  const { cwd, env, paneType = 'new-window', sessionName } = options

  // tmuxセッション内にいることを確認
  if (!(await isInTmuxSession())) {
    throw new Error('tmuxオプションを使用するにはtmuxセッション内にいる必要があります')
  }

  let tmuxArgs: string[]

  switch (paneType) {
    case 'new-window':
      tmuxArgs = ['new-window', '-n', sessionName || 'maestro']
      if (cwd) tmuxArgs.push('-c', cwd)
      tmuxArgs.push(...command)
      break

    case 'vertical-split':
      tmuxArgs = ['split-window', '-v']
      if (cwd) tmuxArgs.push('-c', cwd)
      tmuxArgs.push(...command)
      break

    case 'horizontal-split':
      tmuxArgs = ['split-window', '-h']
      if (cwd) tmuxArgs.push('-c', cwd)
      tmuxArgs.push(...command)
      break

    default:
      throw new Error(`Unknown pane type: ${paneType}`)
  }

  // 環境変数を設定
  const tmuxEnv = { ...process.env, ...env }

  try {
    const tmuxProcess = spawn('tmux', tmuxArgs, {
      stdio: 'inherit',
      env: tmuxEnv,
    })

    return new Promise<void>((resolve, reject) => {
      tmuxProcess.on('exit', code => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`tmux command failed with exit code ${code}`))
        }
      })

      tmuxProcess.on('error', error => {
        reject(error)
      })
    })
  } catch (error) {
    throw new Error(`Failed to execute tmux command: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * tmuxペインでシェルを開始
 */
export async function startTmuxShell(
  options: {
    cwd?: string
    branchName?: string
    paneType?: TmuxPaneType
    sessionName?: string
  } = {}
): Promise<void> {
  const { cwd, branchName, paneType = 'new-window', sessionName } = options

  const env = {
    MAESTRO: '1',
    MAESTRO_NAME: branchName || 'unknown',
    MAESTRO_PATH: cwd || process.cwd(),
  }

  const shell = process.env.SHELL || '/bin/bash'
  
  await executeTmuxCommand([shell], {
    cwd,
    env,
    paneType,
    sessionName: sessionName || branchName,
  })
}

/**
 * tmuxペインでコマンドを実行
 */
export async function executeTmuxCommandInPane(
  command: string,
  options: {
    cwd?: string
    branchName?: string
    paneType?: TmuxPaneType
    sessionName?: string
  } = {}
): Promise<void> {
  const { cwd, branchName, paneType = 'new-window', sessionName } = options

  const env = {
    MAESTRO: '1',
    MAESTRO_BRANCH: branchName || 'unknown',
    MAESTRO_PATH: cwd || process.cwd(),
  }

  await executeTmuxCommand(['sh', '-c', command], {
    cwd,
    env,
    paneType,
    sessionName: sessionName || branchName,
  })
}

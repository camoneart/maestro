import { spawn } from 'child_process'
import { execa } from 'execa'

/**
 * tmuxセッションにアタッチする（適切なTTY制御付き）
 * execを使用してプロセスを完全に置き換える方法を試みる
 */
export async function attachToTmuxWithProperTTY(sessionName: string): Promise<void> {
  // まず、tmuxセッションが存在するか確認
  try {
    await execa('tmux', ['has-session', '-t', sessionName])
  } catch {
    throw new Error(`tmuxセッション '${sessionName}' が存在しません`)
  }

  return new Promise((resolve, reject) => {
    // Node.jsのプロセスをtmuxプロセスで置き換える
    // これにより、TTY制御が完全にtmuxに移譲される
    const tmuxProcess = spawn('tmux', ['attach', '-t', sessionName], {
      stdio: 'inherit',
      detached: false,
    })

    // プロセスのPIDを保存
    const tmuxPid = tmuxProcess.pid

    // SIGINTやSIGTERMをtmuxに転送
    const signals = ['SIGINT', 'SIGTERM', 'SIGTSTP', 'SIGQUIT'] as const
    signals.forEach(signal => {
      process.on(signal, () => {
        if (tmuxPid) {
          process.kill(tmuxPid, signal)
        }
      })
    })

    // ウィンドウリサイズをtmuxに伝える
    process.stdout.on('resize', () => {
      if (tmuxPid) {
        process.kill(tmuxPid, 'SIGWINCH')
      }
    })

    tmuxProcess.on('exit', (code, signal) => {
      // シグナルハンドラーをクリーンアップ
      signals.forEach(sig => process.removeAllListeners(sig))
      process.stdout.removeAllListeners('resize')

      if (code === 0 || (signal && signal === 'SIGTERM')) {
        resolve()
      } else {
        reject(new Error(`tmux attach failed with code ${code} signal ${signal}`))
      }
    })

    tmuxProcess.on('error', error => {
      reject(error)
    })
  })
}

/**
 * tmuxクライアントを切り替える（適切なTTY制御付き）
 */
export async function switchTmuxClientWithProperTTY(sessionName: string): Promise<void> {
  // tmux内部からのみ使用可能
  if (!process.env.TMUX) {
    throw new Error('tmux switch-client はtmuxセッション内でのみ使用できます')
  }

  try {
    // switch-clientは通常のexecaで問題ない（TTY置き換えが不要）
    await execa('tmux', ['switch-client', '-t', sessionName])
  } catch (error) {
    throw new Error(
      `tmux switch-client failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * 新しいtmuxセッションを作成してアタッチする
 */
export async function createAndAttachTmuxSession(
  sessionName: string,
  cwd?: string,
  command?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['new-session', '-s', sessionName]
    if (cwd) {
      args.push('-c', cwd)
    }
    if (command) {
      args.push('--', command)
    }

    const tmuxProcess = spawn('tmux', args, {
      stdio: 'inherit',
      detached: false,
      cwd,
    })

    const tmuxPid = tmuxProcess.pid

    // SIGINTやSIGTERMをtmuxに転送
    const signals = ['SIGINT', 'SIGTERM', 'SIGTSTP', 'SIGQUIT'] as const
    signals.forEach(signal => {
      process.on(signal, () => {
        if (tmuxPid) {
          process.kill(tmuxPid, signal)
        }
      })
    })

    // ウィンドウリサイズをtmuxに伝える
    process.stdout.on('resize', () => {
      if (tmuxPid) {
        process.kill(tmuxPid, 'SIGWINCH')
      }
    })

    tmuxProcess.on('exit', (code, signal) => {
      // シグナルハンドラーをクリーンアップ
      signals.forEach(sig => process.removeAllListeners(sig))
      process.stdout.removeAllListeners('resize')

      if (code === 0 || (signal && signal === 'SIGTERM')) {
        resolve()
      } else {
        reject(new Error(`tmux new-session failed with code ${code} signal ${signal}`))
      }
    })

    tmuxProcess.on('error', error => {
      reject(error)
    })
  })
}

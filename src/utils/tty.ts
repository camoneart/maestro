import { NativeTmuxHelper } from './nativeTmux.js'

/**
 * tmuxセッションにアタッチする（適切なTTY制御付き）
 *
 * This function uses direct tmux commands to solve TTY corruption issues.
 * It uses spawn with stdio: 'inherit' and process.exit() for proper TTY control.
 *
 * Note: This function never returns when successful, as the process exits.
 */
export async function attachToTmuxWithProperTTY(sessionName: string): Promise<void> {
  // Use the improved native helper which directly calls tmux
  // This call never returns on success due to process.exit()
  await NativeTmuxHelper.attachToSession(sessionName)
}


/**
 * tmuxクライアントを切り替える（適切なTTY制御付き）
 *
 * Uses direct tmux switch-client command. This doesn't require process replacement
 * since it's an internal tmux operation.
 */
export async function switchTmuxClientWithProperTTY(sessionName: string): Promise<void> {
  // Use the improved native helper which directly calls tmux
  await NativeTmuxHelper.switchClient(sessionName)
}


/**
 * 新しいtmuxセッションを作成してアタッチする
 *
 * This function uses direct tmux commands to solve TTY corruption issues.
 * It uses spawn with stdio: 'inherit' and process.exit() for proper TTY control.
 *
 * Note: This function never returns when successful, as the process exits.
 */
export async function createAndAttachTmuxSession(
  sessionName: string,
  cwd?: string,
  command?: string
): Promise<void> {
  // Use the improved native helper which directly calls tmux
  // This call never returns on success due to process.exit()
  await NativeTmuxHelper.createAndAttachSession(sessionName, cwd, command)
}


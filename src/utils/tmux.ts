import { execa } from 'execa'

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
      '#[fg=yellow]#{?client_prefix,#[reverse]<Prefix>#[noreverse] ,}#[fg=cyan]#(cd #{pane_current_path} && git branch --show-current 2>/dev/null || echo "no branch") #[fg=white]| %H:%M'
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
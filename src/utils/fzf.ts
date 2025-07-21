import { spawn } from 'child_process'
import chalk from 'chalk'
import { Worktree } from '../types/index.js'

/**
 * fzfでworktreeを選択
 */
export async function selectWorktreeWithFzf(
  orchestraMembers: Worktree[],
  header: string = '演奏者を選択 (Ctrl-C でキャンセル)'
): Promise<string | null> {
  const fzfInput = orchestraMembers
    .map(w => {
      const status = []
      if (w.locked) status.push(chalk.red('ロック'))
      if (w.prunable) status.push(chalk.yellow('削除可能'))

      const statusStr = status.length > 0 ? ` [${status.join(', ')}]` : ''
      const branch = w.branch?.replace('refs/heads/', '') || w.branch
      return `${branch}${statusStr} | ${w.path}`
    })
    .join('\n')

  const fzfProcess = spawn(
    'fzf',
    [
      '--ansi',
      '--header', header,
      '--preview',
      'echo {} | cut -d"|" -f2 | xargs ls -la',
      '--preview-window=right:50%:wrap',
    ],
    {
      stdio: ['pipe', 'pipe', 'inherit'],
    }
  )

  // fzfにデータを送る
  fzfProcess.stdin.write(fzfInput)
  fzfProcess.stdin.end()

  // 選択結果を取得
  let selected = ''
  fzfProcess.stdout.on('data', data => {
    selected += data.toString()
  })

  return new Promise<string | null>(resolve => {
    fzfProcess.on('close', code => {
      if (code !== 0 || !selected.trim()) {
        resolve(null) // キャンセルされた
      } else {
        // ブランチ名を抽出
        const branchName = selected
          .split('|')[0]
          ?.trim()
          .replace(/\[.*\]/, '')
          .trim()
        resolve(branchName || null)
      }
    })
  })
}

/**
 * fzfが利用可能かチェック
 */
export async function isFzfAvailable(): Promise<boolean> {
  try {
    const fzfProcess = spawn('fzf', ['--version'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    })

    return new Promise<boolean>(resolve => {
      fzfProcess.on('close', code => {
        resolve(code === 0)
      })
      fzfProcess.on('error', () => {
        resolve(false)
      })
    })
  } catch {
    return false
  }
}
import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { GitWorktreeManager } from '../core/git.js'
import { Worktree } from '../types/index.js'
import { createServer } from 'http'
import { readFile } from 'fs/promises'
import { execa } from 'execa'
import open from 'open'
import path from 'path'
import { processManager } from '../utils/process.js'

interface DashboardOptions {
  port?: number
  open?: boolean
}

// HTMLテンプレート
const htmlTemplate = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎼 Orchestra Conductor Dashboard</title>
  <style>
    :root {
      --bg-color: #1a1a1a;
      --card-bg: #2a2a2a;
      --text-color: #e0e0e0;
      --accent-color: #4a9eff;
      --success-color: #4ade80;
      --warning-color: #fbbf24;
      --error-color: #f87171;
      --border-color: #3a3a3a;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding: 20px;
      background: linear-gradient(135deg, #4a9eff 0%, #2563eb 100%);
      border-radius: 12px;
    }
    
    .header h1 {
      margin: 0;
      font-size: 2.5em;
      color: white;
    }
    
    .header p {
      margin: 10px 0 0;
      color: rgba(255, 255, 255, 0.9);
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .stat-card {
      background-color: var(--card-bg);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border: 1px solid var(--border-color);
    }
    
    .stat-card h3 {
      margin: 0 0 10px;
      color: var(--accent-color);
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .stat-card .value {
      font-size: 2.5em;
      font-weight: bold;
      margin: 0;
    }
    
    .worktree-grid {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    }
    
    .worktree-card {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 20px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .worktree-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .worktree-card.main {
      border-color: var(--accent-color);
    }
    
    .worktree-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .branch-name {
      font-size: 1.2em;
      font-weight: bold;
      color: var(--accent-color);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: 500;
    }
    
    .badge.issue {
      background-color: rgba(74, 222, 128, 0.2);
      color: var(--success-color);
    }
    
    .badge.pr {
      background-color: rgba(74, 158, 255, 0.2);
      color: var(--accent-color);
    }
    
    .badge.template {
      background-color: rgba(168, 85, 247, 0.2);
      color: #a855f7;
    }
    
    .badge.stale {
      background-color: rgba(251, 191, 36, 0.2);
      color: var(--warning-color);
    }
    
    .badge.uncommitted {
      background-color: rgba(248, 113, 113, 0.2);
      color: var(--error-color);
    }
    
    .worktree-info {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid var(--border-color);
    }
    
    .info-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.9em;
    }
    
    .info-label {
      color: #999;
    }
    
    .path {
      font-family: 'Courier New', monospace;
      font-size: 0.85em;
      color: #666;
      margin-top: 10px;
      word-break: break-all;
    }
    
    .actions {
      margin-top: 15px;
      display: flex;
      gap: 10px;
    }
    
    .action-btn {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      background-color: transparent;
      color: var(--text-color);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
      transition: all 0.2s;
    }
    
    .action-btn:hover {
      background-color: var(--accent-color);
      border-color: var(--accent-color);
      color: white;
    }
    
    .refresh-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      background-color: var(--accent-color);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1em;
      box-shadow: 0 4px 12px rgba(74, 158, 255, 0.3);
      transition: all 0.2s;
    }
    
    .refresh-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(74, 158, 255, 0.4);
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .spinner {
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--accent-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎼 Orchestra Conductor Dashboard</h1>
      <p>全ての演奏者の状態を一覧表示</p>
    </div>
    
    <div id="content">
      <div class="loading">
        <div class="spinner"></div>
        <p>データを読み込み中...</p>
      </div>
    </div>
  </div>
  
  <button class="refresh-btn" onclick="fetchData()">🔄 更新</button>
  
  <script>
    async function fetchData() {
      try {
        const response = await fetch('/api/worktrees');
        const data = await response.json();
        renderDashboard(data);
      } catch (error) {
        console.error('データの取得に失敗しました:', error);
      }
    }
    
    function renderDashboard(data) {
      const content = document.getElementById('content');
      
      // 統計情報
      const stats = \`
        <div class="stats">
          <div class="stat-card">
            <h3>総演奏者数</h3>
            <p class="value">\${data.worktrees.length}</p>
          </div>
          <div class="stat-card">
            <h3>アクティブ</h3>
            <p class="value">\${data.stats.active}</p>
          </div>
          <div class="stat-card">
            <h3>要確認</h3>
            <p class="value">\${data.stats.needsAttention}</p>
          </div>
          <div class="stat-card">
            <h3>GitHub連携</h3>
            <p class="value">\${data.stats.githubLinked}</p>
          </div>
        </div>
      \`;
      
      // Worktreeカード
      const worktreeCards = data.worktrees.map(wt => \`
        <div class="worktree-card \${wt.isMain ? 'main' : ''}">
          <div class="worktree-header">
            <div class="branch-name">
              \${wt.isMain ? '📍' : '🎵'} \${wt.branch}
            </div>
          </div>
          
          <div class="badges">
            \${wt.metadata?.github ? \`
              <span class="badge \${wt.metadata.github.type}">
                \${wt.metadata.github.type.toUpperCase()} #\${wt.metadata.github.issueNumber}
              </span>
            \` : ''}
            \${wt.metadata?.template ? \`
              <span class="badge template">\${wt.metadata.template}</span>
            \` : ''}
            \${wt.health?.includes('stale') ? '<span class="badge stale">古い</span>' : ''}
            \${wt.health?.includes('uncommitted') ? '<span class="badge uncommitted">未コミット</span>' : ''}
          </div>
          
          <div class="worktree-info">
            \${wt.metadata?.github ? \`
              <div class="info-item">
                <span class="info-label">タイトル:</span>
                <span>\${wt.metadata.github.title}</span>
              </div>
            \` : ''}
            \${wt.lastCommit ? \`
              <div class="info-item">
                <span class="info-label">最終更新:</span>
                <span>\${new Date(wt.lastCommit.date).toLocaleDateString()}</span>
              </div>
            \` : ''}
            \${wt.metadata?.createdAt ? \`
              <div class="info-item">
                <span class="info-label">作成日:</span>
                <span>\${new Date(wt.metadata.createdAt).toLocaleDateString()}</span>
              </div>
            \` : ''}
          </div>
          
          <div class="path">\${wt.path}</div>
          
          <div class="actions">
            <button class="action-btn" onclick="openInEditor('\${wt.path}')">エディタで開く</button>
            <button class="action-btn" onclick="openTerminal('\${wt.path}')">ターミナルで開く</button>
          </div>
        </div>
      \`).join('');
      
      content.innerHTML = stats + '<div class="worktree-grid">' + worktreeCards + '</div>';
    }
    
    async function openInEditor(path) {
      await fetch('/api/open-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
    }
    
    async function openTerminal(path) {
      await fetch('/api/open-terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
    }
    
    // 初回読み込み
    fetchData();
    
    // 30秒ごとに自動更新
    setInterval(fetchData, 30000);
  </script>
</body>
</html>
`

// 拡張Worktree型定義
interface EnhancedWorktree extends Worktree {
  isMain: boolean
  metadata: WorktreeMetadata | null
  lastCommit: { date: string; message: string; hash: string } | null
  health: string[]
  uncommittedChanges: boolean
}

// worktreeメタデータ型定義
interface WorktreeMetadata {
  createdAt: string
  branch: string
  worktreePath: string
  github?: {
    type: 'issue' | 'pr'
    title: string
    body: string
    author: string
    labels: string[]
    assignees: string[]
    milestone?: string
    url: string
    issueNumber?: string
  }
  template?: string
}

// APIデータを取得
async function getWorktreeData(): Promise<{
  worktrees: EnhancedWorktree[]
  stats: { active: number; needsAttention: number; githubLinked: number }
}> {
  const gitManager = new GitWorktreeManager()
  const worktrees = await gitManager.listWorktrees()

  const enhancedWorktrees = await Promise.all(
    worktrees.map(async wt => {
      const result: EnhancedWorktree = {
        ...wt,
        isMain: wt.path.endsWith('.'),
        branch: wt.branch?.replace('refs/heads/', '') || wt.branch,
        metadata: null,
        lastCommit: null,
        health: [],
        uncommittedChanges: false,
      }

      // メタデータを取得
      try {
        const metadataPath = path.join(wt.path, '.maestro-metadata.json')
        const metadataContent = await readFile(metadataPath, 'utf-8')
        result.metadata = JSON.parse(metadataContent)
      } catch {
        result.metadata = null
      }

      // 最終コミット情報を取得
      try {
        result.lastCommit = await gitManager.getLastCommit(wt.path)
      } catch {
        result.lastCommit = null
      }

      // 健全性チェック（簡易版）
      result.health = []
      if (result.lastCommit) {
        const daysSinceLastCommit = Math.floor(
          (Date.now() - new Date(result.lastCommit.date).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSinceLastCommit > 30) {
          result.health.push('stale')
        }
      }

      // 未コミットの変更をチェック
      try {
        const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: wt.path })
        if (stdout.trim()) {
          result.health.push('uncommitted')
        }
      } catch {
        // エラーは無視
      }

      return result
    })
  )

  // 統計情報を計算
  const stats = {
    active: enhancedWorktrees.filter(wt => !wt.health.includes('stale')).length,
    needsAttention: enhancedWorktrees.filter(wt => wt.health.length > 0).length,
    githubLinked: enhancedWorktrees.filter(wt => wt.metadata?.github).length,
  }

  return {
    worktrees: enhancedWorktrees,
    stats,
  }
}

export const dashboardCommand = new Command('dashboard')
  .alias('ui')
  .description('Web UIで演奏者の状態を表示')
  .option('-p, --port <number>', 'ポート番号', '8765')
  .option('--no-open', 'ブラウザを自動で開かない')
  .action(async (options: DashboardOptions) => {
    const spinner = ora('ダッシュボードサーバーを起動中...').start()

    try {
      const port = parseInt(options.port?.toString() || '8765')

      // HTTPサーバーを作成
      const server = createServer(async (req, res) => {
        // CORS対応
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.writeHead(200)
          res.end()
          return
        }

        try {
          if (req.url === '/' || req.url === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(htmlTemplate)
          } else if (req.url === '/api/worktrees') {
            const data = await getWorktreeData()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url === '/api/open-editor' && req.method === 'POST') {
            let body = ''
            req.on('data', chunk => {
              body += chunk
            })
            req.on('end', async () => {
              const { path: worktreePath } = JSON.parse(body)
              try {
                await execa('cursor', [worktreePath])
              } catch {
                try {
                  await execa('code', [worktreePath])
                } catch {
                  // エディタが見つからない
                }
              }
              res.writeHead(200)
              res.end()
            })
          } else if (req.url === '/api/open-terminal' && req.method === 'POST') {
            let body = ''
            req.on('data', chunk => {
              body += chunk
            })
            req.on('end', async () => {
              const { path: worktreePath } = JSON.parse(body)
              // macOS用のターミナル起動コマンド
              try {
                await execa('open', ['-a', 'Terminal', worktreePath])
              } catch {
                // 他のOSでは未実装
              }
              res.writeHead(200)
              res.end()
            })
          } else {
            res.writeHead(404)
            res.end('Not Found')
          }
        } catch (error) {
          res.writeHead(500)
          res.end(
            JSON.stringify({ error: error instanceof Error ? error.message : '不明なエラー' })
          )
        }
      })

      // サーバーを起動
      server.listen(port, () => {
        spinner.succeed(`ダッシュボードサーバーが起動しました`)
        console.log(chalk.cyan(`\n🌐 http://localhost:${port}\n`))
        console.log(chalk.gray('Ctrl+C で終了'))

        // ブラウザを自動で開く
        if (options.open !== false) {
          open(`http://localhost:${port}`)
        }
      })

      // サーバーのクリーンアップを登録
      processManager.addCleanupHandler(async () => {
        console.log(chalk.yellow('\nダッシュボードサーバーを停止中...'))
        return new Promise<void>(resolve => {
          server.close(() => {
            console.log(chalk.green('停止しました'))
            resolve()
          })
        })
      })
    } catch (error) {
      spinner.fail('ダッシュボードサーバーの起動に失敗しました')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })

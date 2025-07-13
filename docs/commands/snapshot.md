# scj snapshot

影分身（Git Worktree）の現在の状態をスナップショットとして保存・復元するコマンドです。実験的な変更の前や、重要な作業の節目でバックアップを作成できます。

## 概要

```bash
scj snapshot [options]
scj snap [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# 現在の影分身のスナップショットを作成
scj snapshot

# メッセージ付きでスナップショット作成
scj snapshot -m "機能実装前の状態"

# 変更をスタッシュに保存してスナップショット作成
scj snapshot --stash

# 全ての影分身のスナップショットを作成
scj snapshot --all
```

### スナップショット管理

```bash
# スナップショット一覧を表示
scj snapshot --list

# JSON形式で一覧を表示
scj snapshot --list --json

# スナップショットを復元
scj snapshot --restore snapshot-20240120-103045

# スナップショットを削除
scj snapshot --delete snapshot-20240120-103045
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--message <msg>` | `-m` | スナップショットの説明 | なし |
| `--stash` | `-s` | 未コミット変更をスタッシュ | `false` |
| `--all` | `-a` | 全影分身のスナップショット | `false` |
| `--list` | `-l` | スナップショット一覧を表示 | `false` |
| `--restore <id>` | `-r` | スナップショットを復元 | なし |
| `--delete <id>` | `-d` | スナップショットを削除 | なし |
| `--json` | `-j` | JSON形式で出力 | `false` |
| `--force` | `-f` | 確認なしで実行 | `false` |

## スナップショットの内容

スナップショットには以下の情報が保存されます：

- Git状態（ブランチ、HEAD、トラッキング情報）
- コミット履歴（最新10件）
- ステージング済みファイル
- 変更ファイル
- 未追跡ファイル
- Worktreeメタデータ
- スタッシュ（`--stash` オプション使用時）

### スナップショットファイル形式

```json
{
  "id": "snapshot-20240120-103045",
  "worktree": "feature/auth",
  "timestamp": "2024-01-20T10:30:45Z",
  "message": "機能実装前の状態",
  "git": {
    "branch": "feature/auth",
    "head": "abc123def456",
    "tracking": "origin/feature/auth",
    "ahead": 2,
    "behind": 0
  },
  "changes": {
    "staged": ["src/auth.js", "src/login.js"],
    "modified": ["README.md"],
    "untracked": ["test.log"]
  },
  "commits": [
    {
      "hash": "abc123def456",
      "message": "feat: add login functionality",
      "author": "user@example.com",
      "date": "2024-01-20T09:00:00Z"
    }
  ],
  "stash": {
    "ref": "stash@{0}",
    "message": "WIP on feature/auth: abc123d feat: add login"
  }
}
```

## スナップショット一覧

### 通常の出力

```bash
scj snapshot --list
```

出力例：
```
📸 Snapshots:

feature/auth:
  • snapshot-20240120-103045 - "機能実装前の状態" (2 hours ago)
  • snapshot-20240119-150000 - "バグ修正前" (1 day ago)

bugfix/memory-leak:
  • snapshot-20240120-090000 - "デバッグ開始前" (4 hours ago)

Total: 3 snapshots across 2 worktrees
```

### JSON出力（`--json`）

```json
{
  "snapshots": [
    {
      "id": "snapshot-20240120-103045",
      "worktree": "feature/auth",
      "timestamp": "2024-01-20T10:30:45Z",
      "message": "機能実装前の状態",
      "size": "2.3MB",
      "hasStash": false
    },
    {
      "id": "snapshot-20240119-150000",
      "worktree": "feature/auth",
      "timestamp": "2024-01-19T15:00:00Z",
      "message": "バグ修正前",
      "size": "1.8MB",
      "hasStash": true
    }
  ],
  "summary": {
    "total": 3,
    "worktrees": 2,
    "totalSize": "5.9MB"
  }
}
```

## スナップショットの復元

### 基本的な復元

```bash
# スナップショットIDを指定して復元
scj snapshot --restore snapshot-20240120-103045
```

復元プロセス：
1. 現在の状態を一時保存
2. HEADを指定されたコミットに移動
3. ファイルの変更状態を復元
4. スタッシュがあれば適用

### 復元時の確認

```
🔄 Restoring snapshot: snapshot-20240120-103045
   Worktree: feature/auth
   Created: 2024-01-20 10:30:45
   Message: "機能実装前の状態"

Current state will be backed up as: snapshot-20240120-140000-backup

? Proceed with restoration? (y/N)
```

## 高度な使用例

### 実験的な変更の管理

```bash
# 1. 実験前にスナップショット作成
scj snapshot -m "実験開始前の安定版"

# 2. 実験的な変更を実施
# ... コードの変更 ...

# 3. 実験が失敗した場合、元に戻す
scj snapshot --list  # IDを確認
scj snapshot --restore snapshot-20240120-103045

# 4. 実験が成功した場合、新しいスナップショット作成
scj snapshot -m "実験成功 - 新機能完成"
```

### 定期的なバックアップ

```bash
#!/bin/bash
# daily-snapshot.sh

# アクティブな影分身のスナップショットを作成
scj list --json | jq -r '.worktrees[] | select(.ahead > 0 or .behind > 0) | .branch' | while read branch; do
  echo "Creating snapshot for $branch..."
  scj exec "$branch" scj snapshot -m "Daily backup - $(date +%Y-%m-%d)"
done
```

### デプロイ前のチェックポイント

```bash
# デプロイ前の状態を保存
deploy_with_snapshot() {
  local branch=$1
  
  # スナップショット作成
  scj exec "$branch" scj snapshot -m "Pre-deployment snapshot"
  
  # デプロイ実行
  if ! deploy_script.sh; then
    echo "Deployment failed! Rolling back..."
    LATEST_SNAPSHOT=$(scj snapshot --list --json | jq -r '.snapshots[0].id')
    scj snapshot --restore "$LATEST_SNAPSHOT"
    return 1
  fi
  
  echo "Deployment successful!"
}
```

## スナップショットの管理

### 古いスナップショットの削除

```bash
# 7日以上古いスナップショットを削除
scj snapshot --list --json | jq -r '.snapshots[] | select(.timestamp < (now - 604800 | strftime("%Y-%m-%dT%H:%M:%SZ"))) | .id' | while read snapshot; do
  scj snapshot --delete "$snapshot"
done
```

### スナップショットのエクスポート

```bash
# スナップショットをアーカイブとしてエクスポート
SNAPSHOT_ID="snapshot-20240120-103045"
EXPORT_DIR="./snapshot-exports"

mkdir -p "$EXPORT_DIR"
scj snapshot --export "$SNAPSHOT_ID" --output "$EXPORT_DIR/$SNAPSHOT_ID.tar.gz"
```

### スナップショットの比較

```bash
# 2つのスナップショット間の差分を表示
scj snapshot --diff snapshot-20240120-103045 snapshot-20240120-140000
```

## ストレージ管理

スナップショットは `.git/shadow-clones/.snapshots/` に保存されます：

```bash
# ストレージ使用量を確認
du -sh .git/shadow-clones/.snapshots/

# 大きなスナップショットを検出
find .git/shadow-clones/.snapshots/ -type f -size +10M -exec ls -lh {} \;
```

## 設定

`.scj.json` でスナップショットの動作をカスタマイズ：

```json
{
  "snapshot": {
    "autoCleanupDays": 30,
    "maxSnapshots": 50,
    "compression": true,
    "includeNodeModules": false,
    "excludePatterns": [
      "*.log",
      "*.tmp",
      "dist/*",
      "build/*"
    ]
  }
}
```

## ベストプラクティス

### 1. 命名規則

```bash
# 一貫性のある命名規則を使用
scj snapshot -m "feat: 認証機能実装前"
scj snapshot -m "fix: メモリリーク修正前"
scj snapshot -m "refactor: API構造変更前"
```

### 2. 重要な変更前の習慣化

```bash
# Git フックで自動化
cat > .git/hooks/pre-rebase << 'EOF'
#!/bin/bash
echo "Creating snapshot before rebase..."
scj snapshot -m "Auto-snapshot before rebase"
EOF
chmod +x .git/hooks/pre-rebase
```

### 3. チーム共有

```bash
# スナップショットをチームで共有
scj snapshot --export snapshot-20240120-103045 --share

# 共有されたスナップショットをインポート
scj snapshot --import shared-snapshot-20240120-103045.tar.gz
```

## Tips & Tricks

### スナップショットエイリアス

```bash
# ~/.bashrc または ~/.zshrc に追加
alias scj-backup='scj snapshot -m "Quick backup - $(date +%Y-%m-%d_%H:%M)"'
alias scj-restore-latest='scj snapshot --restore $(scj snapshot --list --json | jq -r ".snapshots[0].id")'

# 使用例
scj-backup          # 素早くバックアップ
scj-restore-latest  # 最新のスナップショットに復元
```

### スナップショット統計

```bash
# スナップショット統計を表示
scj snapshot --list --json | jq '
  {
    total: .summary.total,
    avgSize: (.snapshots | map(.size | gsub("MB"; "") | tonumber) | add / length),
    oldestDays: (
      .snapshots | 
      map(.timestamp | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime) | 
      min | 
      ((now - .) / 86400 | floor)
    )
  }
'
```

## 関連コマンド

- [`scj list`](./list.md) - スナップショットを作成する影分身を確認
- [`scj health`](./health.md) - スナップショット前に健全性をチェック
- [`scj sync`](./sync.md) - スナップショット後に同期
- [`scj history`](./history.md) - Claude Code履歴と併せて管理
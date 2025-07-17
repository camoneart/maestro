# mst history

Claude Code の会話履歴を管理するコマンドです。各演奏者（Git Worktree）での開発履歴を保存、検索、エクスポートできます。

## 概要

```bash
mst history [options]
mst h [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# 全ての履歴を一覧表示
mst history --list

# 特定ブランチの履歴を表示
mst history --show feature-auth

# 履歴をエクスポート
mst history --export all-histories.json
mst history --export all-histories.md

# 全履歴を1ファイルにマージ
mst history --merge merged-history.md
```

### 履歴管理

```bash
# 不要な履歴をクリーンアップ
mst history --cleanup

# 履歴パスを同期
mst history --sync

# 履歴を検索
mst history --search "authentication"

# JSON形式で出力
mst history --list --json
```

## オプション

| オプション         | 短縮形 | 説明                       | デフォルト |
| ------------------ | ------ | -------------------------- | ---------- |
| `--list`           | `-l`   | 履歴一覧を表示             | `false`    |
| `--show <branch>`  | `-s`   | 特定ブランチの履歴を表示   | なし       |
| `--export <file>`  | `-e`   | 履歴をエクスポート         | なし       |
| `--merge <file>`   | `-m`   | 全履歴を1ファイルにマージ  | なし       |
| `--cleanup`        | `-c`   | 不要な履歴をクリーンアップ | `false`    |
| `--sync`           |        | 履歴パスを同期             | `false`    |
| `--search <query>` |        | 履歴を検索                 | なし       |
| `--json`           | `-j`   | JSON形式で出力             | `false`    |
| `--days <n>`       | `-d`   | 指定日数以内の履歴のみ     | なし       |

## 履歴の保存形式

Claude Code の履歴は以下の形式で保存されます：

### ディレクトリ構造

```
~/.claude/history/
├── feature-auth.md
├── bugfix-login.md
├── experiment-ml.md
└── main.md
```

### 履歴ファイルの内容

```markdown
# Claude Code History - feature/auth

## Session: 2025-01-20 10:30:00

### Human

認証機能を実装してください。JWTを使用してください。

### Assistant

認証機能をJWTで実装します。まず必要なパッケージをインストールしましょう...

---

## Session: 2025-01-20 14:00:00

### Human

テストを追加してください。

### Assistant

認証機能のテストを追加します...
```

## 履歴一覧の表示

### 通常の出力

```bash
mst history --list
```

出力例：

```
📚 Claude Code Histories:

feature/auth (3 sessions, last: 2 hours ago)
  - Total messages: 45
  - Total tokens: 12,500
  - Duration: 4.5 hours

bugfix/login (1 session, last: 1 day ago)
  - Total messages: 12
  - Total tokens: 3,200
  - Duration: 1 hour

experiment/ml (5 sessions, last: 3 days ago)
  - Total messages: 89
  - Total tokens: 28,000
  - Duration: 8 hours

Summary:
- Total worktrees with history: 3
- Total sessions: 9
- Total tokens used: 43,700
```

### JSON出力（`--json`）

```json
{
  "histories": [
    {
      "branch": "feature/auth",
      "sessions": 3,
      "lastActivity": "2025-01-20T14:30:00Z",
      "stats": {
        "messages": 45,
        "tokens": 12500,
        "duration": 16200,
        "avgTokensPerSession": 4166
      },
      "path": "/Users/user/.claude/history/feature-auth.md"
    }
  ],
  "summary": {
    "totalWorktrees": 3,
    "totalSessions": 9,
    "totalTokens": 43700,
    "totalDuration": 32400
  }
}
```

## 履歴の検索

### キーワード検索

```bash
# 特定のキーワードを含む履歴を検索
mst history --search "authentication"
```

出力例：

```
🔍 Search results for "authentication":

feature/auth - Session 2025-01-20 10:30:00
  Line 15: "認証機能を実装してください。JWTを使用してください。"
  Line 20: "認証機能をJWTで実装します..."

feature/api - Session 2025-01-19 15:00:00
  Line 45: "APIの認証をOAuth2.0に変更..."

Found 2 matches in 2 worktrees
```

### 高度な検索

```bash
# 正規表現を使用
mst history --search "auth(entication|orization)" --regex

# 期間を指定
mst history --search "bug" --days 7

# 特定のブランチ内で検索
mst history --show feature-auth --search "JWT"
```

## エクスポート機能

### Markdown形式でエクスポート

```bash
mst history --export all-histories.md
```

生成されるファイル：

```markdown
# Maestro - Claude Code History Export

Export date: 2025-01-20 16:00:00

## Table of Contents

1. [feature/auth](#featureauth)
2. [bugfix/login](#bugfixlogin)
3. [experiment/ml](#experimentml)

---

## feature/auth

### Session: 2025-01-20 10:30:00

...
```

### JSON形式でエクスポート

```bash
mst history --export all-histories.json
```

### 特定期間のエクスポート

```bash
# 過去7日間の履歴のみエクスポート
mst history --export recent-history.md --days 7

# 特定のブランチのみエクスポート
mst history --show feature-auth --export feature-auth-history.md
```

## マージ機能

複数の履歴ファイルを時系列で1つにマージ：

```bash
mst history --merge complete-history.md
```

マージオプション：

```bash
# 重複を除外
mst history --merge complete-history.md --dedupe

# タイムスタンプでソート
mst history --merge complete-history.md --sort-by-time

# トークン数でソート（コスト分析用）
mst history --merge complete-history.md --sort-by-tokens
```

## クリーンアップ

### 古い履歴の削除

```bash
# 30日以上古い履歴を削除
mst history --cleanup --days 30

# 削除対象を確認（ドライラン）
mst history --cleanup --days 30 --dry-run
```

### 孤立した履歴の削除

```bash
# Worktreeが存在しない履歴を削除
mst history --cleanup --orphaned
```

## 履歴の同期

### パスの同期

```bash
# 履歴ファイルのパスを現在の設定に同期
mst history --sync
```

これにより、設定ファイルで履歴パスを変更した場合でも、既存の履歴を新しい場所に移動できます。

## 統計とレポート

### コスト分析

```bash
# トークン使用量のレポート
mst history --stats
```

出力例：

```
📊 Token Usage Report

By Worktree:
1. experiment/ml: 28,000 tokens ($0.84)
2. feature/auth: 12,500 tokens ($0.38)
3. bugfix/login: 3,200 tokens ($0.10)

By Time Period:
- Today: 5,000 tokens ($0.15)
- This week: 18,000 tokens ($0.54)
- This month: 43,700 tokens ($1.31)

Model Usage:
- Claude 3 Opus: 30,000 tokens
- Claude 3 Sonnet: 13,700 tokens
```

### 生産性分析

```bash
# セッション時間と頻度の分析
mst history --analyze
```

## 設定

`.mst.json` で履歴管理をカスタマイズ：

```json
{
  "claude": {
    "costOptimization": {
      "historyPath": "~/.claude/history/{branch}.md",
      "maxHistoryDays": 90,
      "autoCleanup": true,
      "compressOldHistories": true
    }
  }
}
```

## 高度な使用例

### 履歴からの学習

```bash
# よく使うコマンドを抽出
mst history --export - | grep -E "^### Human" -A1 | grep -v "^--" | sort | uniq -c | sort -nr | head -20
```

### チーム共有

```bash
# 履歴を匿名化してエクスポート
mst history --export team-history.md --anonymize

# 特定のセッションのみ共有
mst history --show feature-auth --session 2025-01-20 --export session.md
```

### バックアップスクリプト

```bash
#!/bin/bash
# backup-histories.sh

BACKUP_DIR="./history-backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# 全履歴をバックアップ
mst history --export "$BACKUP_DIR/all-histories.json"
mst history --merge "$BACKUP_DIR/merged-history.md"

# 圧縮
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "Backup created: $BACKUP_DIR.tar.gz"
```

## ベストプラクティス

### 1. セッション管理

```bash
# 新しいセッションを開始する前に履歴を確認
before_claude() {
  local branch=$(git branch --show-current)
  echo "📚 Previous sessions for $branch:"
  mst history --show "$branch" --summary
}
```

### 2. コスト最適化

```bash
# 高コストのセッションを特定
mst history --list --json | jq -r '
  .histories[] |
  select(.stats.tokens > 10000) |
  "\(.branch): \(.stats.tokens) tokens ($\(.stats.tokens * 0.00003))"
'
```

### 3. 知識の継承

```bash
# 有用なセッションをドキュメント化
mst history --show feature-auth --export docs/auth-implementation.md
echo "## Key Learnings" >> docs/auth-implementation.md
echo "- JWT implementation details..." >> docs/auth-implementation.md
```

## Tips & Tricks

### 履歴エイリアス

```bash
# ~/.bashrc または ~/.zshrc に追加
alias mst-history='mst history --list'
alias mst-history-search='mst history --search'
alias mst-history-export='mst history --export "histories-$(date +%Y%m%d).md"'

# 使用例
mst-history              # 履歴一覧
mst-history-search bug   # バグ関連の履歴を検索
mst-history-export       # 日付付きでエクスポート
```

### インテグレーション

```bash
# Git フックで自動エクスポート
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
echo "Exporting Claude Code history..."
mst history --export .claude-history.md
git add .claude-history.md
git commit -m "chore: update Claude Code history" --no-verify
EOF
chmod +x .git/hooks/pre-push
```

## 関連コマンド

- [`mst create`](./create.md) - 新しい演奏者と履歴を開始
- [`mst suggest`](./suggest.md) - 履歴を基にした提案
- [`mst snapshot`](./snapshot.md) - 履歴と併せてスナップショット管理
- [`mst health`](./health.md) - 履歴ファイルの健全性チェック

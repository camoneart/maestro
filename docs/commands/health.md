# scj health

影分身（Git Worktree）の健全性をチェックし、問題を検出・修正するコマンドです。古い影分身の検出、未コミット変更の確認、リモートブランチとの同期状態などを総合的に診断します。

## 概要

```bash
scj health [options]
scj check [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# 全ての影分身の健全性をチェック
scj health

# 修正可能な問題を自動修正
scj health --fix

# 古い影分身を削除（デフォルト: 30日以上）
scj health --prune

# 詳細情報を表示
scj health --verbose
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--fix` | `-f` | 修正可能な問題を自動修正 | `false` |
| `--prune` | `-p` | 古い影分身を削除 | `false` |
| `--days <n>` | `-d` | 古いと判定する日数 | `30` |
| `--verbose` | `-v` | 詳細情報を表示 | `false` |
| `--json` | `-j` | JSON形式で出力 | `false` |
| `--dry-run` | `-n` | 実際には修正せず、結果を表示 | `false` |

## 検出される問題

### stale（古い影分身）

長期間更新されていない影分身：

```
⚠️  stale: feature/old-feature
   Last commit: 45 days ago
   Recommendation: Review and delete if no longer needed
```

### orphaned（孤立した影分身）

リモートブランチが存在しない影分身：

```
❌ orphaned: feature/deleted-remote
   Remote branch 'origin/feature/deleted-remote' not found
   Recommendation: Delete worktree or push to remote
```

### diverged（大きく乖離）

メインブランチから大きく乖離した影分身：

```
⚠️  diverged: feature/long-running
   Behind main: 152 commits
   Ahead of main: 23 commits
   Recommendation: Rebase or merge with main branch
```

### uncommitted（未コミット変更）

未コミットの変更がある影分身：

```
⚠️  uncommitted: feature/work-in-progress
   Modified files: 5
   Untracked files: 3
   Recommendation: Commit or stash changes
```

### conflict（マージ競合）

マージ競合が未解決の影分身：

```
❌ conflict: feature/merge-conflict
   Conflicted files: 2
   Recommendation: Resolve conflicts and commit
```

### missing（ディレクトリ不在）

ディレクトリが存在しない影分身：

```
❌ missing: feature/moved-worktree
   Directory not found: /path/to/worktree
   Recommendation: Remove worktree entry
```

## 出力形式

### 通常の出力

```
🏥 Shadow Clone Health Check

Checking 8 worktrees...

✅ main - healthy
⚠️  feature/auth - uncommitted (3 modified files)
❌ feature/old-ui - stale (60 days old)
⚠️  bugfix/memory-leak - diverged (behind: 45, ahead: 12)
✅ feature/api - healthy
❌ experiment/ml - orphaned (remote branch deleted)
⚠️  docs/update - uncommitted (2 untracked files)
✅ feature/dashboard - healthy

Summary:
- Total: 8
- Healthy: 3 (37.5%)
- Warnings: 3 (37.5%)
- Errors: 2 (25.0%)

Run 'scj health --fix' to auto-fix some issues
Run 'scj health --prune' to remove stale worktrees
```

### JSON出力（`--json`）

```json
{
  "timestamp": "2024-01-20T10:30:00Z",
  "worktrees": [
    {
      "branch": "main",
      "path": "/Users/user/project",
      "status": "healthy",
      "issues": []
    },
    {
      "branch": "feature/auth",
      "path": "/Users/user/project/.git/shadow-clones/feature-auth",
      "status": "warning",
      "issues": [
        {
          "type": "uncommitted",
          "severity": "warning",
          "details": {
            "modified": 3,
            "untracked": 0,
            "deleted": 0
          },
          "recommendation": "Commit or stash changes"
        }
      ]
    },
    {
      "branch": "feature/old-ui",
      "path": "/Users/user/project/.git/shadow-clones/feature-old-ui",
      "status": "error",
      "issues": [
        {
          "type": "stale",
          "severity": "error",
          "details": {
            "lastCommitDays": 60,
            "lastCommitDate": "2023-11-21T15:45:00Z"
          },
          "recommendation": "Review and delete if no longer needed"
        }
      ]
    }
  ],
  "summary": {
    "total": 8,
    "healthy": 3,
    "warning": 3,
    "error": 2,
    "fixable": 4
  }
}
```

## 自動修正機能

`--fix` オプションで以下の問題を自動修正できます：

### orphaned（孤立）の修正

```bash
scj health --fix
```

実行内容：
- リモートブランチが削除されている場合、ローカルのトラッキング情報を削除
- 必要に応じて新しいリモートブランチを作成するか確認

### missing（ディレクトリ不在）の修正

自動的にWorktreeエントリを削除：
```bash
git worktree prune
```

### 設定の不整合を修正

Worktree設定の不整合を検出して修正

## プルーニング（古い影分身の削除）

```bash
# 30日以上古い影分身を確認
scj health --prune --dry-run

# 実際に削除
scj health --prune

# 60日以上に変更
scj health --prune --days 60
```

プルーニング時の確認：
```
The following stale worktrees will be deleted:
- feature/old-ui (60 days old)
- experiment/abandoned (45 days old)
- bugfix/fixed-long-ago (90 days old)

? Proceed with deletion? (y/N)
```

## 定期メンテナンス

### Cronジョブの設定

```bash
# 毎日午前9時に健全性チェック
0 9 * * * cd /path/to/project && scj health --json > /tmp/scj-health.json

# 週次で古い影分身をクリーンアップ
0 10 * * 1 cd /path/to/project && scj health --prune --days 30 --yes
```

### CI/CDでの活用

```yaml
# .github/workflows/health-check.yml
name: Worktree Health Check

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日実行

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install scj
        run: npm install -g shadow-clone-jutsu
      - name: Run health check
        run: |
          scj health --json > health-report.json
          if [ $(jq '.summary.error' health-report.json) -gt 0 ]; then
            echo "::error::Worktree health check failed"
            exit 1
          fi
```

## カスタムチェック

### 健全性レポートの生成

```bash
#!/bin/bash
# health-report.sh

echo "# Worktree Health Report - $(date)"
echo

# 基本情報
echo "## Summary"
scj health --json | jq -r '
  "- Total worktrees: \(.summary.total)",
  "- Healthy: \(.summary.healthy) (\(.summary.healthy / .summary.total * 100 | floor)%)",
  "- Issues found: \(.summary.warning + .summary.error)"
'

echo
echo "## Detailed Issues"

# 問題のある影分身の詳細
scj health --json | jq -r '
  .worktrees[] | 
  select(.status != "healthy") | 
  "### \(.branch)",
  "- Status: \(.status)",
  "- Path: \(.path)",
  (.issues[] | "- Issue: \(.type) - \(.recommendation)")
'
```

### 問題別の対処

```bash
# 未コミット変更がある影分身を一括処理
scj health --json | jq -r '.worktrees[] | select(.issues[].type == "uncommitted") | .branch' | while read branch; do
  echo "Processing $branch..."
  scj exec "$branch" git stash push -m "Auto-stash by health check"
done

# 孤立した影分身を削除
scj health --json | jq -r '.worktrees[] | select(.issues[].type == "orphaned") | .branch' | while read branch; do
  scj delete "$branch" --force
done
```

## しきい値の設定

`.scj.json` で健全性チェックのしきい値を設定：

```json
{
  "health": {
    "staleThresholdDays": 30,
    "divergedThresholdCommits": 50,
    "autoFixEnabled": true,
    "checks": {
      "stale": true,
      "orphaned": true,
      "diverged": true,
      "uncommitted": true,
      "conflict": true,
      "missing": true
    }
  }
}
```

## Tips & Tricks

### 健全性スコアの算出

```bash
# 健全性スコアを計算（100点満点）
SCORE=$(scj health --json | jq '
  .summary.healthy / .summary.total * 100 | floor
')

echo "Worktree health score: $SCORE/100"

# 80点未満なら警告
if [ $SCORE -lt 80 ]; then
  echo "⚠️  Health score is low. Run 'scj health --fix' to improve."
fi
```

### 問題の自動通知

```bash
# Slack通知の例
ISSUES=$(scj health --json | jq '.summary.error + .summary.warning')

if [ $ISSUES -gt 0 ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"⚠️ Worktree health check: $ISSUES issues found\"}" \
    YOUR_SLACK_WEBHOOK_URL
fi
```

### インタラクティブ修正

```bash
# 問題を一つずつ確認して修正
scj health --json | jq -r '.worktrees[] | select(.status != "healthy") | .branch' | while read branch; do
  echo "=== $branch ==="
  scj health --verbose | grep -A5 "$branch"
  
  read -p "Fix this issue? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    # ここに修正ロジックを実装
    echo "Fixing $branch..."
  fi
done
```

## 関連コマンド

- [`scj list`](./list.md) - 影分身の一覧と状態を表示
- [`scj delete`](./delete.md) - 問題のある影分身を削除
- [`scj sync`](./sync.md) - 乖離した影分身を同期
- [`scj snapshot`](./snapshot.md) - 修正前にスナップショットを作成
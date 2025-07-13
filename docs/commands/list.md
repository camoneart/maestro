# scj list

作成した影分身（Git Worktree）の一覧を表示するコマンドです。各影分身の状態、メタデータ、GitHubとの連携状況などを確認できます。

## 概要

```bash
scj list [options]
scj ls [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# 影分身の一覧を表示
scj list

# JSON形式で出力
scj list --json

# メタデータを含めて表示
scj list --metadata

# fzfで選択（選択したブランチ名を出力）
scj list --fzf
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--json` | `-j` | JSON形式で出力 | `false` |
| `--metadata` | `-m` | メタデータを含めて表示 | `false` |
| `--fzf` | `-f` | fzfで選択モード | `false` |

## 出力形式

### 通常の出力

```
🥷 Shadow Clones (Worktrees):

* main               /Users/user/project (HEAD)
  feature/auth       /Users/user/project/.git/shadow-clones/feature-auth (ahead 3)
  bugfix/login      /Users/user/project/.git/shadow-clones/bugfix-login (behind 2, ahead 1)
  issue-123         /Users/user/project/.git/shadow-clones/issue-123 (issue: #123)
```

### JSON出力（`--json`）

```json
{
  "worktrees": [
    {
      "branch": "main",
      "path": "/Users/user/project",
      "HEAD": "abc123def",
      "isMain": true,
      "tracking": "origin/main",
      "ahead": 0,
      "behind": 0
    },
    {
      "branch": "feature/auth",
      "path": "/Users/user/project/.git/shadow-clones/feature-auth",
      "HEAD": "def456ghi",
      "isMain": false,
      "tracking": "origin/feature/auth",
      "ahead": 3,
      "behind": 0,
      "metadata": {
        "createdAt": "2024-01-15T10:30:00Z",
        "createdBy": "scj",
        "template": "feature",
        "githubIssue": null
      }
    },
    {
      "branch": "issue-123",
      "path": "/Users/user/project/.git/shadow-clones/issue-123",
      "HEAD": "ghi789jkl",
      "isMain": false,
      "tracking": "origin/issue-123",
      "ahead": 1,
      "behind": 0,
      "metadata": {
        "createdAt": "2024-01-16T14:00:00Z",
        "createdBy": "scj",
        "githubIssue": {
          "number": 123,
          "title": "認証機能の実装",
          "state": "open",
          "labels": ["enhancement", "backend"],
          "assignees": ["user123"],
          "url": "https://github.com/org/repo/issues/123"
        }
      }
    }
  ],
  "summary": {
    "total": 4,
    "active": 3,
    "issues": 1,
    "pullRequests": 0
  }
}
```

### メタデータ付き出力（`--metadata`）

```
🥷 Shadow Clones (Worktrees):

* main               /Users/user/project (HEAD)

  feature/auth       /Users/user/project/.git/shadow-clones/feature-auth
    Status: ahead 3
    Created: 2024-01-15 10:30:00
    Template: feature
    
  issue-123         /Users/user/project/.git/shadow-clones/issue-123
    Status: ahead 1
    Created: 2024-01-16 14:00:00
    Issue: #123 - 認証機能の実装
    Labels: enhancement, backend
    Assignees: user123
```

## fzf統合

`--fzf` オプションを使用すると、インタラクティブに影分身を選択できます：

```bash
# 選択した影分身のブランチ名を出力
BRANCH=$(scj list --fzf)

# 選択した影分身に移動
cd $(scj where $(scj list --fzf))

# 選択した影分身でコマンドを実行
scj exec $(scj list --fzf) npm test
```

## 状態の見方

- **HEAD**: 現在チェックアウトしている影分身
- **ahead X**: リモートブランチよりX個のコミットが進んでいる
- **behind X**: リモートブランチよりX個のコミットが遅れている
- **issue: #X**: GitHub Issue番号Xと関連付けられている
- **pr: #X**: GitHub PR番号Xと関連付けられている

## CI/CD連携

JSON出力を使用することで、CI/CDパイプラインとの連携が容易になります：

```bash
# 全ての影分身でテストを実行
scj list --json | jq -r '.worktrees[].branch' | while read branch; do
  echo "Testing $branch..."
  scj exec "$branch" npm test
done

# アクティブな影分身の数を取得
ACTIVE_COUNT=$(scj list --json | jq '.summary.active')

# Issue関連の影分身のみ取得
scj list --json | jq '.worktrees[] | select(.metadata.githubIssue != null)'
```

## フィルタリング例

jqコマンドと組み合わせて、様々なフィルタリングが可能です：

```bash
# ahead状態の影分身のみ表示
scj list --json | jq '.worktrees[] | select(.ahead > 0)'

# 特定のテンプレートを使用した影分身
scj list --json | jq '.worktrees[] | select(.metadata.template == "feature")'

# 1週間以上古い影分身
scj list --json | jq '.worktrees[] | select(.metadata.createdAt < (now - 604800 | strftime("%Y-%m-%dT%H:%M:%SZ")))'
```

## Tips & Tricks

### 1. エイリアスの活用

```bash
# ~/.bashrc または ~/.zshrc に追加
alias scjl='scj list'
alias scjlj='scj list --json | jq'

# 使用例
scjl                    # 通常の一覧
scjlj '.summary'        # サマリー情報のみ
scjlj '.worktrees[0]'   # 最初の影分身の詳細
```

### 2. ステータス確認スクリプト

```bash
#!/bin/bash
# 全影分身のGitステータスを確認
scj list --json | jq -r '.worktrees[].branch' | while read branch; do
  echo "=== $branch ==="
  scj exec "$branch" git status --short
  echo
done
```

### 3. 定期的なクリーンアップ

```bash
# 30日以上更新されていない影分身を検出
scj list --json | jq -r '
  .worktrees[] | 
  select(.metadata.createdAt < (now - 2592000 | strftime("%Y-%m-%dT%H:%M:%SZ"))) | 
  .branch
' | while read branch; do
  echo "Old worktree: $branch"
  # scj delete "$branch"  # 実際に削除する場合はコメントを外す
done
```

## 関連コマンド

- [`scj create`](./create.md) - 新しい影分身を作成
- [`scj delete`](./delete.md) - 影分身を削除
- [`scj where`](./where.md) - 影分身のパスを表示
- [`scj health`](./health.md) - 影分身の健全性をチェック
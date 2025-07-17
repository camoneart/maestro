# mst list

作成した演奏者（Git Worktree）の一覧を表示するコマンドです。各演奏者の状態、メタデータ、GitHubとの連携状況などを確認できます。

## 概要

```bash
mst list [options]
mst ls [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# 演奏者の一覧を表示
mst list

# JSON形式で出力
mst list --json

# メタデータを含めて表示
mst list --metadata

# fzfで選択（選択したブランチ名を出力）
mst list --fzf
```

## オプション

| オプション   | 短縮形 | 説明                   | デフォルト |
| ------------ | ------ | ---------------------- | ---------- |
| `--json`     | `-j`   | JSON形式で出力         | `false`    |
| `--metadata` | `-m`   | メタデータを含めて表示 | `false`    |
| `--fzf`      | `-f`   | fzfで選択モード        | `false`    |

## 出力形式

### 通常の出力

```
🎼 Orchestra Members (Worktrees):

* main               /Users/user/project (HEAD)
  feature/auth       /Users/user/project/.git/orchestra-members/feature-auth (ahead 3)
  bugfix/login      /Users/user/project/.git/orchestra-members/bugfix-login (behind 2, ahead 1)
  issue-123         /Users/user/project/.git/orchestra-members/issue-123 (issue: #123)
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
      "path": "/Users/user/project/.git/orchestra-members/feature-auth",
      "HEAD": "def456ghi",
      "isMain": false,
      "tracking": "origin/feature/auth",
      "ahead": 3,
      "behind": 0,
      "metadata": {
        "createdAt": "2025-01-15T10:30:00Z",
        "createdBy": "mst",
        "template": "feature",
        "githubIssue": null
      }
    },
    {
      "branch": "issue-123",
      "path": "/Users/user/project/.git/orchestra-members/issue-123",
      "HEAD": "ghi789jkl",
      "isMain": false,
      "tracking": "origin/issue-123",
      "ahead": 1,
      "behind": 0,
      "metadata": {
        "createdAt": "2025-01-16T14:00:00Z",
        "createdBy": "mst",
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
🎼 Orchestra Members (Worktrees):

* main               /Users/user/project (HEAD)

  feature/auth       /Users/user/project/.git/orchestra-members/feature-auth
    Status: ahead 3
    Created: 2025-01-15 10:30:00
    Template: feature

  issue-123         /Users/user/project/.git/orchestra-members/issue-123
    Status: ahead 1
    Created: 2025-01-16 14:00:00
    Issue: #123 - 認証機能の実装
    Labels: enhancement, backend
    Assignees: user123
```

## fzf統合

`--fzf` オプションを使用すると、インタラクティブに演奏者を選択できます：

```bash
# 選択した演奏者のブランチ名を出力
BRANCH=$(mst list --fzf)

# 選択した演奏者に移動
cd $(mst where $(mst list --fzf))

# 選択した演奏者でコマンドを実行
mst exec $(mst list --fzf) npm test
```

## 状態の見方

- **HEAD**: 現在チェックアウトしている演奏者
- **ahead X**: リモートブランチよりX個のコミットが進んでいる
- **behind X**: リモートブランチよりX個のコミットが遅れている
- **issue: #X**: GitHub Issue番号Xと関連付けられている
- **pr: #X**: GitHub PR番号Xと関連付けられている

## CI/CD連携

JSON出力を使用することで、CI/CDパイプラインとの連携が容易になります：

```bash
# 全ての演奏者でテストを実行
mst list --json | jq -r '.worktrees[].branch' | while read branch; do
  echo "Testing $branch..."
  mst exec "$branch" npm test
done

# アクティブな演奏者の数を取得
ACTIVE_COUNT=$(mst list --json | jq '.summary.active')

# Issue関連の演奏者のみ取得
mst list --json | jq '.worktrees[] | select(.metadata.githubIssue != null)'
```

## フィルタリング例

jqコマンドと組み合わせて、様々なフィルタリングが可能です：

```bash
# ahead状態の演奏者のみ表示
mst list --json | jq '.worktrees[] | select(.ahead > 0)'

# 特定のテンプレートを使用した演奏者
mst list --json | jq '.worktrees[] | select(.metadata.template == "feature")'

# 1週間以上古い演奏者
mst list --json | jq '.worktrees[] | select(.metadata.createdAt < (now - 604800 | strftime("%Y-%m-%dT%H:%M:%SZ")))'
```

## Tips & Tricks

### 1. エイリアスの活用

```bash
# ~/.bashrc または ~/.zshrc に追加
alias mstl='mst list'
alias mstlj='mst list --json | jq'

# 使用例
mstl                    # 通常の一覧
mstlj '.summary'        # サマリー情報のみ
mstlj '.worktrees[0]'   # 最初の演奏者の詳細
```

### 2. ステータス確認スクリプト

```bash
#!/bin/bash
# 全演奏者のGitステータスを確認
mst list --json | jq -r '.worktrees[].branch' | while read branch; do
  echo "=== $branch ==="
  mst exec "$branch" git status --short
  echo
done
```

### 3. 定期的なクリーンアップ

```bash
# 30日以上更新されていない演奏者を検出
mst list --json | jq -r '
  .worktrees[] |
  select(.metadata.createdAt < (now - 2592000 | strftime("%Y-%m-%dT%H:%M:%SZ"))) |
  .branch
' | while read branch; do
  echo "Old worktree: $branch"
  # mst delete "$branch"  # 実際に削除する場合はコメントを外す
done
```

## 関連コマンド

- [`mst create`](./create.md) - 新しい演奏者を作成
- [`mst delete`](./delete.md) - 演奏者を削除
- [`mst where`](./where.md) - 演奏者のパスを表示
- [`mst health`](./health.md) - 演奏者の健全性をチェック

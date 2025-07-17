# mst batch

複数の演奏者（Git Worktree）を一括で作成・管理するコマンドです。GitHub Issues、ファイル入力、対話形式など、様々な方法で効率的に複数のWorktreeを作成できます。

## 概要

```bash
mst batch [options]
mst b [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# GitHub Issuesから複数選択して一括作成
mst batch

# ファイルから一括作成
mst batch --from-file worktrees.txt

# インタラクティブに複数入力
mst batch --interactive

# オプションを付けて一括作成
mst batch -o -s -b develop  # 作成後に開く、セットアップ実行、ベースはdevelop
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--from-file <file>` | `-f` | バッチファイルから読み込み | なし |
| `--interactive` | `-i` | インタラクティブ入力モード | `false` |
| `--open` | `-o` | 作成後にエディタで開く | `false` |
| `--setup` | `-s` | 環境セットアップを実行 | `false` |
| `--base <branch>` | `-b` | ベースブランチを指定 | `main` |
| `--template <name>` | `-t` | 使用するテンプレート | なし |
| `--parallel <n>` | `-p` | 並列実行数 | `4` |
| `--dry-run` | `-n` | 実際には作成せず、計画を表示 | `false` |

## GitHub Issuesモード（デフォルト）

引数なしで実行すると、GitHub Issuesから複数選択できます：

```bash
mst batch
```

選択画面：
```
? Select issues to create worktrees from: (Press <space> to select, <a> to toggle all)
 ◉ #125 feat: Add authentication system (enhancement)
 ◯ #124 fix: Memory leak in worker (bug, critical)
 ◉ #123 docs: Update API documentation (documentation)
 ◯ #122 refactor: Database optimization (performance)
 ◉ #121 feat: Dark mode support (ui, enhancement)
```

実行結果：
```
Creating 3 worktrees...

✓ Created issue-125 (feat: Add authentication system)
✓ Created issue-123 (docs: Update API documentation)
✓ Created issue-121 (feat: Dark mode support)

Summary: 3 successful, 0 failed
```

## ファイル入力モード

### バッチファイルフォーマット

```bash
# worktrees.txt
# フォーマット: branch-name | description | issue/pr番号（オプション）

feature-auth | 認証機能の実装 | #125
bugfix-login | ログインバグの修正 | pr-45
refactor-api | APIのリファクタリング
docs-update | ドキュメントの更新 | issue-123

# コメント行は無視されます
# 空行も無視されます
```

### 実行

```bash
mst batch --from-file worktrees.txt
```

### CSVフォーマットもサポート

```csv
branch,description,issue
feature-auth,"認証機能の実装",125
bugfix-login,"ログインバグの修正",pr-45
refactor-api,"APIのリファクタリング",
docs-update,"ドキュメントの更新",issue-123
```

## インタラクティブモード

```bash
mst batch --interactive
```

プロンプト表示：
```
Enter worktree details (branch-name | description | issue/pr)
Press Enter twice to finish

> feature-auth | 認証機能の実装 | #125
> bugfix-login | ログインバグの修正
> refactor-api | APIのリファクタリング
> 

Creating 3 worktrees...
```

## 並列実行

デフォルトでは4つまで並列で作成されます：

```bash
# 並列数を変更
mst batch --parallel 8

# 逐次実行（デバッグ用）
mst batch --parallel 1
```

## 実行計画の確認

```bash
# ドライランで計画を確認
mst batch --from-file worktrees.txt --dry-run
```

出力例：
```
Batch execution plan:
1. feature-auth (base: main, template: none)
   - Description: 認証機能の実装
   - GitHub Issue: #125
2. bugfix-login (base: main, template: none)
   - Description: ログインバグの修正
   - GitHub PR: #45
3. refactor-api (base: main, template: none)
   - Description: APIのリファクタリング

Total: 3 worktrees to create
Options: --open --setup
```

## テンプレートの使用

```bash
# 全てにfeatureテンプレートを適用
mst batch --template feature

# ファイルで個別指定
# worktrees-with-template.txt
feature-auth | 認証機能 | #125 | template:feature
bugfix-login | バグ修正 | | template:bugfix
experiment-ml | 機械学習実験 | | template:experiment
```

## エラーハンドリング

### 部分的な失敗

一部の作成が失敗しても、他は継続されます：

```
Creating 5 worktrees...

✓ Created feature-auth
✗ Failed bugfix-login: Branch already exists
✓ Created refactor-api
✓ Created docs-update
✗ Failed feature-ui: Invalid branch name

Summary: 3 successful, 2 failed

Failed worktrees:
- bugfix-login: Branch already exists
- feature-ui: Invalid branch name
```

### リトライ機能

```bash
# 失敗したものだけ再実行
mst batch --retry-failed

# または失敗リストをファイルに保存
mst batch --save-failed failed.txt
```

## 高度な使用例

### プロジェクト初期設定

```bash
# setup-project.txt
feature-auth | 認証システム | #10
feature-api | REST API実装 | #11
feature-ui | フロントエンドUI | #12
docs-api | APIドキュメント | #13
test-integration | 統合テスト | #14

# 一括作成してセットアップ
mst batch --from-file setup-project.txt --setup --open
```

### チーム開発での利用

```bash
# チームメンバーごとにIssueを割り当て
ASSIGNED_ISSUES=$(gh issue list --assignee @me --json number -q '.[].number')

# 自分の担当分だけ演奏者を作成
echo "$ASSIGNED_ISSUES" | while read issue; do
  echo "issue-$issue | Issue #$issue | #$issue"
done | mst batch --from-file -
```

### CI/CDでの自動化

```bash
#!/bin/bash
# auto-create-worktrees.sh

# ラベルが"ready-for-dev"のIssueを取得
gh issue list --label ready-for-dev --json number,title | \
  jq -r '.[] | "issue-\(.number) | \(.title) | #\(.number)"' | \
  mst batch --from-file - --setup

# 作成完了後、ラベルを更新
gh issue list --label ready-for-dev --json number -q '.[].number' | \
  while read issue; do
    gh issue edit "$issue" --remove-label ready-for-dev --add-label in-progress
  done
```

## バッチ操作のベストプラクティス

### 1. 命名規則の統一

```bash
# naming-convention.txt
feature/auth-system | 認証システム | #125
feature/user-profile | ユーザープロフィール | #126
bugfix/auth-timeout | 認証タイムアウト修正 | #127
docs/auth-api | 認証APIドキュメント | #128
```

### 2. 段階的な作成

```bash
# Phase 1: Core features
mst batch --from-file phase1-core.txt --setup

# Phase 2: Additional features
mst batch --from-file phase2-features.txt

# Phase 3: Documentation
mst batch --from-file phase3-docs.txt --template docs
```

### 3. 進捗管理

```bash
# バッチ実行結果をログに保存
mst batch --from-file worktrees.txt | tee batch-$(date +%Y%m%d-%H%M%S).log

# 作成済みの演奏者を確認
mst list --json | jq '.summary'
```

## 設定ファイルとの連携

`.mst.json` でバッチ処理のデフォルトを設定：

```json
{
  "batch": {
    "defaultParallel": 6,
    "autoSetup": true,
    "defaultTemplate": "feature",
    "hooks": {
      "beforeBatch": "echo 'Starting batch creation...'",
      "afterEach": "echo 'Created: $ORCHESTRA_MEMBER'",
      "afterBatch": "mst list"
    }
  }
}
```

## Tips & Tricks

### スクリプト化

```bash
#!/bin/bash
# create-sprint-worktrees.sh

SPRINT="sprint-23"
ISSUES=$(gh issue list --label "$SPRINT" --json number,title)

echo "$ISSUES" | jq -r '.[] | "sprint23-\(.number) | \(.title) | #\(.number)"' > sprint23.txt

mst batch --from-file sprint23.txt --base develop --setup --parallel 8
```

### 進捗バー付き実行

```bash
# バッチファイルの行数を取得
TOTAL=$(wc -l < worktrees.txt)
CURRENT=0

# 進捗を表示しながら実行
while IFS='|' read -r branch desc issue; do
  ((CURRENT++))
  echo "[$CURRENT/$TOTAL] Creating $branch..."
  mst create "$branch" ${issue:+--from-issue "$issue"}
done < worktrees.txt
```

## 関連コマンド

- [`mst create`](./create.md) - 単一の演奏者を作成
- [`mst github`](./github.md) - GitHub連携での作成
- [`mst list`](./list.md) - 作成した演奏者の確認
- [`mst health`](./health.md) - 大量作成後の健全性チェック
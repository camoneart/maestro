# scj github

GitHub のIssueやPull Requestから直接影分身（Git Worktree）を作成するコマンドです。GitHub CLIと連携して、開発フローをシームレスに統合します。

## 概要

```bash
scj github [pr|issue] [number] [options]
scj gh [pr|issue] [number] [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# Pull Requestから影分身を作成
scj github pr 123

# Issueから影分身を作成
scj github issue 456

# インタラクティブに選択
scj github
```

### 高度な使用方法

```bash
# PR作成と同時にClaude Codeを起動
scj github pr 123 --tmux --claude

# 複数選択して一括作成
scj github --multiple

# フィルタリングして選択
scj github issue --filter "label:bug"

# 自分にアサインされたものだけ表示
scj github --assignee @me
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--tmux` | `-t` | tmuxセッション/ウィンドウを作成 | `false` |
| `--claude` | `-c` | Claude Codeを自動起動 | `false` |
| `--multiple` | `-m` | 複数選択モード | `false` |
| `--filter <query>` | `-f` | GitHub CLIのフィルタクエリ | なし |
| `--assignee <user>` | `-a` | 担当者でフィルタ（@meで自分） | なし |
| `--limit <n>` | `-l` | 表示件数の上限 | `30` |

## Pull Requestからの作成

### 基本フロー

```bash
# 1. PR一覧を確認
gh pr list

# 2. PRから影分身を作成
scj github pr 123

# 3. 作成された影分身で作業
scj shell pr-123
```

### 自動取得される情報

- PRタイトル
- PR説明文
- 作成者情報
- レビュアー
- ラベル
- マイルストーン
- 関連Issue
- ベースブランチ
- マージ可能状態

### メタデータの保存

```json
{
  "githubPR": {
    "number": 123,
    "title": "Add authentication feature",
    "state": "open",
    "draft": false,
    "author": "username",
    "baseRef": "main",
    "headRef": "feature/auth",
    "labels": ["enhancement", "backend"],
    "reviewers": ["reviewer1", "reviewer2"],
    "url": "https://github.com/org/repo/pull/123"
  }
}
```

## Issueからの作成

### 基本フロー

```bash
# 1. Issue一覧を確認
gh issue list

# 2. Issueから影分身を作成
scj github issue 456

# 3. ブランチ名は自動生成
# issue-456 として作成される
```

### Issue番号の形式

以下のいずれの形式でも同じ結果になります：

```bash
scj github issue 456
scj github issue #456
scj github issue issue-456
```

### 自動取得される情報

- Issueタイトル
- Issue本文
- 作成者
- 担当者
- ラベル
- マイルストーン
- プロジェクト
- 関連PR

## インタラクティブモード

```bash
# メニューから選択
scj github
```

表示されるメニュー：
```
? What would you like to create a worktree from?
❯ Pull Request
  Issue
  Cancel
```

その後、一覧から選択：
```
? Select a Pull Request:
❯ #125 feat: Add dark mode support (enhancement, ui)
  #124 fix: Memory leak in background worker (bug, critical)
  #123 docs: Update API documentation (documentation)
  #122 refactor: Improve database queries (performance)
```

## フィルタリング

GitHub CLIのフィルタ構文を使用できます：

### Pull Requestのフィルタ

```bash
# ラベルでフィルタ
scj github pr --filter "label:bug"

# 状態でフィルタ
scj github pr --filter "state:open draft:false"

# 作成者でフィルタ
scj github pr --filter "author:username"

# 複合条件
scj github pr --filter "label:bug,critical state:open"
```

### Issueのフィルタ

```bash
# 自分にアサインされたIssue
scj github issue --assignee @me

# 特定のマイルストーン
scj github issue --filter "milestone:v2.0"

# 最近更新されたもの
scj github issue --filter "sort:updated-desc"
```

## 複数選択モード

```bash
# 複数のPRを選択して一括作成
scj github pr --multiple
```

選択画面：
```
? Select Pull Requests: (Press <space> to select, <a> to toggle all)
 ◉ #125 feat: Add dark mode support
 ◯ #124 fix: Memory leak in background worker
 ◉ #123 docs: Update API documentation
```

## 統合ワークフロー

### レビューフロー

```bash
# 1. レビュー待ちのPRを確認
scj github pr --filter "review:required"

# 2. PRから影分身を作成してレビュー
scj github pr 125 --tmux --claude

# 3. AI差分レビューを実行
scj suggest --review

# 4. レビューコメントを投稿
gh pr review 125 --comment -b "LGTM with minor suggestions"
```

### Issue駆動開発

```bash
# 1. 優先度の高いIssueを選択
scj github issue --filter "label:priority:high"

# 2. 影分身を作成して開発開始
scj github issue 456 --tmux --claude

# 3. 開発完了後、PRを作成
gh pr create --title "Fix #456: Authentication bug" --body "Closes #456"
```

## CI/CD連携

```bash
# CIが失敗しているPRをローカルで検証
FAILED_PRS=$(gh pr list --json number,statusCheckRollup -q '.[] | select(.statusCheckRollup | length > 0) | select(.statusCheckRollup[0].state == "FAILURE") | .number')

for pr in $FAILED_PRS; do
  echo "Checking PR #$pr..."
  scj github pr "$pr"
  scj exec "pr-$pr" npm test
done
```

## エラーハンドリング

### よくあるエラー

1. **GitHub認証エラー**
   ```
   Error: GitHub authentication failed
   ```
   解決方法: `gh auth login` でGitHub CLIの認証を行う

2. **PR/Issueが見つからない**
   ```
   Error: Pull request #999 not found
   ```
   解決方法: 正しい番号を確認するか、リポジトリが正しいか確認

3. **既に影分身が存在する**
   ```
   Error: Worktree for PR #123 already exists
   ```
   解決方法: 既存の影分身を使用するか、削除してから再作成

## ベストプラクティス

### 1. PR/Issue テンプレートの活用

```bash
# PRテンプレートに基づいて自動的に開発環境を構築
if [[ $(gh pr view 123 --json body -q '.body' | grep -c "Requires: tmux") -gt 0 ]]; then
  scj github pr 123 --tmux --claude
else
  scj github pr 123
fi
```

### 2. ラベルベースの自動化

```bash
# ラベルに基づいて適切なテンプレートを使用
PR_LABELS=$(gh pr view 123 --json labels -q '.labels[].name' | paste -sd,)

if [[ $PR_LABELS == *"bug"* ]]; then
  scj github pr 123 --template bugfix
elif [[ $PR_LABELS == *"feature"* ]]; then
  scj github pr 123 --template feature
else
  scj github pr 123
fi
```

### 3. 定期的な同期

```bash
# 開いているPR/Issueの影分身を最新状態に保つ
scj list --json | jq -r '.worktrees[] | select(.metadata.githubPR != null) | .branch' | while read branch; do
  PR_NUM=$(echo $branch | grep -oE '[0-9]+')
  if [[ $(gh pr view $PR_NUM --json state -q '.state') == "OPEN" ]]; then
    scj sync "$branch" --rebase
  fi
done
```

## Tips & Tricks

### GitHub CLIエイリアス

```bash
# ~/.config/gh/config.yml に追加
aliases:
  pr-worktree: "!scj github pr"
  issue-worktree: "!scj github issue"

# 使用例
gh pr-worktree 123
gh issue-worktree 456
```

### 自動ラベリング

```bash
# Issueから作成した影分身にラベルを反映
create_issue_worktree() {
  local issue=$1
  
  # 影分身を作成
  scj github issue "$issue"
  
  # Issueのラベルを取得してコミットメッセージに反映
  LABELS=$(gh issue view "$issue" --json labels -q '.labels[].name' | paste -sd,)
  scj exec "issue-$issue" git commit --allow-empty -m "chore: start work on issue #$issue [$LABELS]"
}
```

## 関連コマンド

- [`scj create`](./create.md) - 手動で影分身を作成
- [`scj batch`](./batch.md) - 複数のIssue/PRから一括作成
- [`scj suggest`](./suggest.md) - PR作成時のメッセージ提案
- [`scj review`](./review.md) - PRレビューフロー
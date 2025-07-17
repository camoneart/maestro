# mst delete

演奏者（Git Worktree）を削除するコマンドです。不要になった演奏者をクリーンアップし、ディスク容量を解放します。

## 概要

```bash
mst delete <branch-name> [options]
mst rm <branch-name> [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# 演奏者を削除
mst delete feature/old-feature

# 強制削除（未コミットの変更があっても削除）
mst delete feature/old-feature --force

# fzfで選択して削除
mst delete --fzf
```

### 一括削除

```bash
# マージ済みの演奏者を一括削除
mst delete --merged

# 30日以上古い演奏者を削除
mst delete --older-than 30

# ドライラン（実際には削除しない）
mst delete --merged --dry-run
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--force` | `-f` | 強制削除（未コミットの変更を無視） | `false` |
| `--fzf` | | fzfで選択して削除 | `false` |
| `--merged` | `-m` | マージ済みの演奏者を削除 | `false` |
| `--older-than <days>` | `-o` | 指定日数以上古い演奏者を削除 | なし |
| `--dry-run` | `-n` | 実際には削除せず、削除対象を表示 | `false` |
| `--yes` | `-y` | 確認プロンプトをスキップ | `false` |

## 削除時の確認

通常、削除前に確認プロンプトが表示されます：

```
🗑️  Are you sure you want to delete worktree 'feature/old-feature'?
   Branch: feature/old-feature
   Path: /Users/user/project/.git/orchestra-members/feature-old-feature
   Status: 3 uncommitted changes
   
   This action cannot be undone.
   
? Delete worktree? (y/N)
```

## 安全な削除

### 未コミットの変更がある場合

```bash
# 通常の削除は失敗する
mst delete feature/work-in-progress
# Error: Worktree has uncommitted changes. Use --force to delete anyway.

# 変更を確認
mst exec feature/work-in-progress git status

# 変更を保存してから削除
mst exec feature/work-in-progress git stash
mst delete feature/work-in-progress

# または強制削除
mst delete feature/work-in-progress --force
```

### マージ済みブランチの確認

```bash
# マージ済みの演奏者を確認
mst delete --merged --dry-run

# 出力例：
# Would delete the following merged worktrees:
# - feature/completed-feature (merged to main)
# - bugfix/fixed-bug (merged to main)
# - feature/old-feature (merged to develop)

# 実際に削除
mst delete --merged --yes
```

## 一括削除の活用

### 古い演奏者のクリーンアップ

```bash
# 60日以上更新されていない演奏者を確認
mst delete --older-than 60 --dry-run

# 確認して削除
mst delete --older-than 60
```

### カスタム条件での削除

```bash
# 特定のプレフィックスを持つ演奏者を削除
mst list --json | jq -r '.worktrees[] | select(.branch | startswith("experiment/")) | .branch' | while read branch; do
  mst delete "$branch" --yes
done

# PR関連の演奏者でクローズ済みのものを削除
mst list --json | jq -r '.worktrees[] | select(.metadata.githubPR.state == "closed") | .branch' | while read branch; do
  mst delete "$branch"
done
```

## フック機能

`.mst.json` で削除前後のフックを設定できます：

```json
{
  "hooks": {
    "beforeDelete": "echo \"Deleting worktree: $ORCHESTRA_MEMBER\"",
    "afterDelete": "echo \"Worktree deleted: $ORCHESTRA_MEMBER\""
  }
}
```

## エラーハンドリング

### よくあるエラー

1. **演奏者が見つからない場合**
   ```
   Error: Worktree 'feature/non-existent' not found
   ```
   解決方法: `mst list` で正しいブランチ名を確認してください

2. **現在の演奏者を削除しようとした場合**
   ```
   Error: Cannot delete the current worktree
   ```
   解決方法: 別の演奏者に移動してから削除してください

3. **リモートブランチが残っている場合**
   ```
   Warning: Remote branch 'origin/feature/old-feature' still exists
   ```
   対処方法: `git push origin --delete feature/old-feature` でリモートブランチも削除

## ベストプラクティス

### 1. 定期的なクリーンアップ

```bash
#!/bin/bash
# cleanup-worktrees.sh

echo "🧹 Cleaning up worktrees..."

# マージ済みを削除
mst delete --merged --yes

# 90日以上古いものを削除
mst delete --older-than 90 --yes

# 統計を表示
echo "Remaining worktrees:"
mst list | grep -c "^  "
```

### 2. 削除前の確認フロー

```bash
# 削除対象の確認
BRANCH="feature/to-delete"

# 1. 状態を確認
mst exec "$BRANCH" git status

# 2. 最新のコミットを確認
mst exec "$BRANCH" git log --oneline -5

# 3. リモートとの差分を確認
mst exec "$BRANCH" git log origin/main..HEAD --oneline

# 4. 問題なければ削除
mst delete "$BRANCH"
```

### 3. 安全な削除エイリアス

```bash
# ~/.bashrc または ~/.zshrc に追加
alias mst-safe-delete='mst delete --dry-run'
alias mst-cleanup='mst delete --merged --older-than 30'

# 使用例
mst-safe-delete feature/old  # 削除対象を確認
mst-cleanup --yes            # 古い演奏者をクリーンアップ
```

## Tips & Tricks

### リモートブランチも同時に削除

```bash
# ローカルとリモートの両方を削除する関数
delete_worktree_and_remote() {
  local branch=$1
  
  # ローカルの演奏者を削除
  mst delete "$branch" --yes
  
  # リモートブランチも削除
  git push origin --delete "$branch" 2>/dev/null || echo "Remote branch not found"
}

# 使用例
delete_worktree_and_remote feature/old-feature
```

### 削除履歴の記録

```bash
# 削除前に情報を記録
mst list --json > worktrees-backup-$(date +%Y%m%d).json

# 削除実行
mst delete feature/old-feature

# 必要に応じて復元用の情報を参照
cat worktrees-backup-*.json | jq '.worktrees[] | select(.branch == "feature/old-feature")'
```

## 関連コマンド

- [`mst list`](./list.md) - 演奏者の一覧を表示
- [`mst create`](./create.md) - 新しい演奏者を作成
- [`mst health`](./health.md) - 演奏者の健全性をチェック
- [`mst snapshot`](./snapshot.md) - 削除前にスナップショットを作成
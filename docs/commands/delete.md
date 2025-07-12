# scj delete

影分身（Git Worktree）を削除するコマンドです。不要になった影分身をクリーンアップし、ディスク容量を解放します。

## 概要

```bash
scj delete <branch-name> [options]
scj rm <branch-name> [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# 影分身を削除
scj delete feature/old-feature

# 強制削除（未コミットの変更があっても削除）
scj delete feature/old-feature --force

# fzfで選択して削除
scj delete --fzf
```

### 一括削除

```bash
# マージ済みの影分身を一括削除
scj delete --merged

# 30日以上古い影分身を削除
scj delete --older-than 30

# ドライラン（実際には削除しない）
scj delete --merged --dry-run
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--force` | `-f` | 強制削除（未コミットの変更を無視） | `false` |
| `--fzf` | | fzfで選択して削除 | `false` |
| `--merged` | `-m` | マージ済みの影分身を削除 | `false` |
| `--older-than <days>` | `-o` | 指定日数以上古い影分身を削除 | なし |
| `--dry-run` | `-n` | 実際には削除せず、削除対象を表示 | `false` |
| `--yes` | `-y` | 確認プロンプトをスキップ | `false` |

## 削除時の確認

通常、削除前に確認プロンプトが表示されます：

```
🗑️  Are you sure you want to delete worktree 'feature/old-feature'?
   Branch: feature/old-feature
   Path: /Users/user/project/.git/shadow-clones/feature-old-feature
   Status: 3 uncommitted changes
   
   This action cannot be undone.
   
? Delete worktree? (y/N)
```

## 安全な削除

### 未コミットの変更がある場合

```bash
# 通常の削除は失敗する
scj delete feature/work-in-progress
# Error: Worktree has uncommitted changes. Use --force to delete anyway.

# 変更を確認
scj exec feature/work-in-progress git status

# 変更を保存してから削除
scj exec feature/work-in-progress git stash
scj delete feature/work-in-progress

# または強制削除
scj delete feature/work-in-progress --force
```

### マージ済みブランチの確認

```bash
# マージ済みの影分身を確認
scj delete --merged --dry-run

# 出力例：
# Would delete the following merged worktrees:
# - feature/completed-feature (merged to main)
# - bugfix/fixed-bug (merged to main)
# - feature/old-feature (merged to develop)

# 実際に削除
scj delete --merged --yes
```

## 一括削除の活用

### 古い影分身のクリーンアップ

```bash
# 60日以上更新されていない影分身を確認
scj delete --older-than 60 --dry-run

# 確認して削除
scj delete --older-than 60
```

### カスタム条件での削除

```bash
# 特定のプレフィックスを持つ影分身を削除
scj list --json | jq -r '.worktrees[] | select(.branch | startswith("experiment/")) | .branch' | while read branch; do
  scj delete "$branch" --yes
done

# PR関連の影分身でクローズ済みのものを削除
scj list --json | jq -r '.worktrees[] | select(.metadata.githubPR.state == "closed") | .branch' | while read branch; do
  scj delete "$branch"
done
```

## フック機能

`.scj.json` で削除前後のフックを設定できます：

```json
{
  "hooks": {
    "beforeDelete": "echo \"Deleting worktree: $SHADOW_CLONE\"",
    "afterDelete": "echo \"Worktree deleted: $SHADOW_CLONE\""
  }
}
```

## エラーハンドリング

### よくあるエラー

1. **影分身が見つからない場合**
   ```
   Error: Worktree 'feature/non-existent' not found
   ```
   解決方法: `scj list` で正しいブランチ名を確認してください

2. **現在の影分身を削除しようとした場合**
   ```
   Error: Cannot delete the current worktree
   ```
   解決方法: 別の影分身に移動してから削除してください

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
scj delete --merged --yes

# 90日以上古いものを削除
scj delete --older-than 90 --yes

# 統計を表示
echo "Remaining worktrees:"
scj list | grep -c "^  "
```

### 2. 削除前の確認フロー

```bash
# 削除対象の確認
BRANCH="feature/to-delete"

# 1. 状態を確認
scj exec "$BRANCH" git status

# 2. 最新のコミットを確認
scj exec "$BRANCH" git log --oneline -5

# 3. リモートとの差分を確認
scj exec "$BRANCH" git log origin/main..HEAD --oneline

# 4. 問題なければ削除
scj delete "$BRANCH"
```

### 3. 安全な削除エイリアス

```bash
# ~/.bashrc または ~/.zshrc に追加
alias scj-safe-delete='scj delete --dry-run'
alias scj-cleanup='scj delete --merged --older-than 30'

# 使用例
scj-safe-delete feature/old  # 削除対象を確認
scj-cleanup --yes            # 古い影分身をクリーンアップ
```

## Tips & Tricks

### リモートブランチも同時に削除

```bash
# ローカルとリモートの両方を削除する関数
delete_worktree_and_remote() {
  local branch=$1
  
  # ローカルの影分身を削除
  scj delete "$branch" --yes
  
  # リモートブランチも削除
  git push origin --delete "$branch" 2>/dev/null || echo "Remote branch not found"
}

# 使用例
delete_worktree_and_remote feature/old-feature
```

### 削除履歴の記録

```bash
# 削除前に情報を記録
scj list --json > worktrees-backup-$(date +%Y%m%d).json

# 削除実行
scj delete feature/old-feature

# 必要に応じて復元用の情報を参照
cat worktrees-backup-*.json | jq '.worktrees[] | select(.branch == "feature/old-feature")'
```

## 関連コマンド

- [`scj list`](./list.md) - 影分身の一覧を表示
- [`scj create`](./create.md) - 新しい影分身を作成
- [`scj health`](./health.md) - 影分身の健全性をチェック
- [`scj snapshot`](./snapshot.md) - 削除前にスナップショットを作成
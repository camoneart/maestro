# mst sync

演奏者（Git Worktree）間でコードや設定ファイルを同期するコマンドです。メインブランチの変更を他の演奏者に反映したり、環境設定ファイルを共有したりできます。

## 概要

```bash
mst sync [branch-name] [options]
mst s [branch-name] [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# メインブランチの変更を特定の演奏者に同期
mst sync feature-branch

# 全ての演奏者に同期
mst sync --all

# インタラクティブに選択
mst sync

# rebaseで同期（デフォルトはmerge）
mst sync --rebase
```

### ファイル同期

```bash
# 環境変数・設定ファイルを同期
mst sync --files

# プリセットを使用してファイル同期
mst sync --preset env     # .env系ファイルのみ
mst sync --preset config  # 設定ファイルのみ
mst sync --preset all     # 全ての設定ファイル

# カスタムファイルを指定して同期
mst sync --files --custom .env.local,config/app.json

# インタラクティブにファイルを選択
mst sync --interactive
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--all` | `-a` | 全ての演奏者に同期 | `false` |
| `--rebase` | `-r` | rebaseで同期（デフォルトはmerge） | `false` |
| `--files` | `-f` | ファイル同期モード | `false` |
| `--preset <name>` | `-p` | プリセットを使用 | なし |
| `--custom <files>` | `-c` | カスタムファイルリスト（カンマ区切り） | なし |
| `--interactive` | `-i` | インタラクティブモード | `false` |
| `--force` | | 競合を無視して強制同期 | `false` |
| `--dry-run` | `-n` | 実際には同期せず、変更内容を表示 | `false` |

## 同期モード

### コード同期（デフォルト）

メインブランチ（または指定したベースブランチ）の最新の変更を演奏者に取り込みます：

```bash
# merge方式（デフォルト）
mst sync feature-branch
# 実行内容: git merge origin/main

# rebase方式
mst sync feature-branch --rebase
# 実行内容: git rebase origin/main

# 全演奏者に適用
mst sync --all --rebase
```

### ファイル同期

設定ファイルや環境変数ファイルを演奏者間で共有します：

```bash
# 基本的なファイル同期
mst sync --files

# 同期されるファイル（デフォルト）:
# - .env
# - .env.local
# - .env.development
# - .env.production
# - config/*.json
# - config/*.yml
```

## プリセット

### env プリセット

環境変数ファイルのみを同期：

```bash
mst sync --preset env
```

同期対象:
- `.env`
- `.env.*`
- `config/.env`
- `config/.env.*`

### config プリセット

設定ファイルのみを同期：

```bash
mst sync --preset config
```

同期対象:
- `config/*.json`
- `config/*.yml`
- `config/*.yaml`
- `.eslintrc*`
- `.prettierrc*`
- `tsconfig*.json`

### all プリセット

全ての設定ファイルを同期：

```bash
mst sync --preset all
```

同期対象:
- envプリセットの全ファイル
- configプリセットの全ファイル
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`

## インタラクティブモード

ファイルを個別に選択して同期：

```bash
mst sync --interactive
```

表示例：
```
? Select files to sync: (Press <space> to select, <a> to toggle all)
 ◉ .env
 ◯ .env.local
 ◉ config/database.json
 ◯ config/app.yml
 ◉ tsconfig.json
```

## 同期の流れ

### コード同期の詳細

1. **事前確認**
   ```bash
   # ドライランで確認
   mst sync feature-branch --dry-run
   ```

2. **同期実行**
   ```bash
   # 実際に同期
   mst sync feature-branch
   ```

3. **競合解決**
   ```bash
   # 競合が発生した場合
   # 1. 手動で解決
   mst shell feature-branch
   # エディタで競合を解決
   
   # 2. 解決をコミット
   git add .
   git commit -m "resolve: merge conflicts"
   ```

### ファイル同期の詳細

1. **差分確認**
   ```bash
   # どのファイルが同期されるか確認
   mst sync --files --dry-run
   ```

2. **同期実行**
   ```bash
   # メインブランチから全演奏者へ
   mst sync --all --files
   ```

3. **カスタム同期**
   ```bash
   # 特定のファイルのみ
   mst sync --files --custom .env.production,config/secrets.json
   ```

## 高度な使用例

### CI/CD設定の同期

```bash
# CI設定を全演奏者に反映
mst sync --all --files --custom .github/workflows/ci.yml,.gitlab-ci.yml

# または専用スクリプト
cat > sync-ci.sh << 'EOF'
#!/bin/bash
CI_FILES=".github/workflows/*.yml,.gitlab-ci.yml,Jenkinsfile"
mst sync --all --files --custom "$CI_FILES"
EOF
chmod +x sync-ci.sh
```

### 選択的同期

```bash
# 特定のパターンに一致する演奏者のみ同期
mst list --json | jq -r '.worktrees[] | select(.branch | startswith("feature/")) | .branch' | while read branch; do
  echo "Syncing $branch..."
  mst sync "$branch" --rebase
done
```

### 同期状態の確認

```bash
# 各演奏者の同期状態を確認
mst list --json | jq -r '.worktrees[] | "\(.branch): \(.behind) commits behind"' | grep -v ": 0 commits"
```

## エラーハンドリング

### よくあるエラー

1. **マージ競合**
   ```
   Error: Merge conflict in files: src/index.js, src/utils.js
   ```
   解決方法: 演奏者に移動して手動で競合を解決

2. **未コミットの変更**
   ```
   Error: Worktree has uncommitted changes
   ```
   解決方法: 変更をコミットまたはスタッシュしてから再実行

3. **ファイルが見つからない**
   ```
   Warning: File '.env.local' not found in source worktree
   ```
   対処方法: ファイルが存在することを確認するか、別のファイルを指定

## ベストプラクティス

### 1. 定期的な同期

```bash
#!/bin/bash
# daily-sync.sh

echo "🔄 Daily sync starting..."

# 1. 最新のmainを取得
git fetch origin main

# 2. 全演奏者をrebaseで同期
mst sync --all --rebase

# 3. 環境ファイルも同期
mst sync --all --preset env

echo "✅ Sync completed"
```

### 2. 同期前のバックアップ

```bash
# スナップショットを作成してから同期
mst snapshot --all -m "Before sync"
mst sync --all --rebase
```

### 3. プロジェクト固有の設定

`.maestro.json` で同期設定をカスタマイズ：

```json
{
  "sync": {
    "defaultMode": "rebase",
    "files": {
      "defaults": [".env", ".env.local"],
      "ignore": ["*.tmp", "*.log"]
    },
    "hooks": {
      "beforeSync": "npm test",
      "afterSync": "npm install"
    }
  }
}
```

## Tips & Tricks

### 同期エイリアス

```bash
# ~/.bashrc または ~/.zshrc に追加
alias mst-sync-all='mst sync --all --rebase'
alias mst-sync-env='mst sync --all --preset env'
alias mst-sync-safe='mst sync --dry-run'

# 使用例
mst-sync-all    # 全演奏者をrebase同期
mst-sync-env    # 環境ファイルを同期
```

### 条件付き同期

```bash
# テストが通った場合のみ同期
sync_if_tests_pass() {
  local branch=$1
  
  if mst exec "$branch" npm test; then
    mst sync "$branch" --rebase
  else
    echo "Tests failed for $branch, skipping sync"
  fi
}

# 使用例
sync_if_tests_pass feature-branch
```

## 関連コマンド

- [`mst list`](./list.md) - 同期が必要な演奏者を確認
- [`mst health`](./health.md) - 同期状態の健全性をチェック
- [`mst snapshot`](./snapshot.md) - 同期前にスナップショットを作成
- [`mst watch`](./watch.md) - ファイル変更を自動同期
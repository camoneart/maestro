# scj sync

影分身（Git Worktree）間でコードや設定ファイルを同期するコマンドです。メインブランチの変更を他の影分身に反映したり、環境設定ファイルを共有したりできます。

## 概要

```bash
scj sync [branch-name] [options]
scj s [branch-name] [options]  # エイリアス
```

## 使用例

### 基本的な使用方法

```bash
# メインブランチの変更を特定の影分身に同期
scj sync feature-branch

# 全ての影分身に同期
scj sync --all

# インタラクティブに選択
scj sync

# rebaseで同期（デフォルトはmerge）
scj sync --rebase
```

### ファイル同期

```bash
# 環境変数・設定ファイルを同期
scj sync --files

# プリセットを使用してファイル同期
scj sync --preset env     # .env系ファイルのみ
scj sync --preset config  # 設定ファイルのみ
scj sync --preset all     # 全ての設定ファイル

# カスタムファイルを指定して同期
scj sync --files --custom .env.local,config/app.json

# インタラクティブにファイルを選択
scj sync --interactive
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--all` | `-a` | 全ての影分身に同期 | `false` |
| `--rebase` | `-r` | rebaseで同期（デフォルトはmerge） | `false` |
| `--files` | `-f` | ファイル同期モード | `false` |
| `--preset <name>` | `-p` | プリセットを使用 | なし |
| `--custom <files>` | `-c` | カスタムファイルリスト（カンマ区切り） | なし |
| `--interactive` | `-i` | インタラクティブモード | `false` |
| `--force` | | 競合を無視して強制同期 | `false` |
| `--dry-run` | `-n` | 実際には同期せず、変更内容を表示 | `false` |

## 同期モード

### コード同期（デフォルト）

メインブランチ（または指定したベースブランチ）の最新の変更を影分身に取り込みます：

```bash
# merge方式（デフォルト）
scj sync feature-branch
# 実行内容: git merge origin/main

# rebase方式
scj sync feature-branch --rebase
# 実行内容: git rebase origin/main

# 全影分身に適用
scj sync --all --rebase
```

### ファイル同期

設定ファイルや環境変数ファイルを影分身間で共有します：

```bash
# 基本的なファイル同期
scj sync --files

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
scj sync --preset env
```

同期対象:
- `.env`
- `.env.*`
- `config/.env`
- `config/.env.*`

### config プリセット

設定ファイルのみを同期：

```bash
scj sync --preset config
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
scj sync --preset all
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
scj sync --interactive
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
   scj sync feature-branch --dry-run
   ```

2. **同期実行**
   ```bash
   # 実際に同期
   scj sync feature-branch
   ```

3. **競合解決**
   ```bash
   # 競合が発生した場合
   # 1. 手動で解決
   scj shell feature-branch
   # エディタで競合を解決
   
   # 2. 解決をコミット
   git add .
   git commit -m "resolve: merge conflicts"
   ```

### ファイル同期の詳細

1. **差分確認**
   ```bash
   # どのファイルが同期されるか確認
   scj sync --files --dry-run
   ```

2. **同期実行**
   ```bash
   # メインブランチから全影分身へ
   scj sync --all --files
   ```

3. **カスタム同期**
   ```bash
   # 特定のファイルのみ
   scj sync --files --custom .env.production,config/secrets.json
   ```

## 高度な使用例

### CI/CD設定の同期

```bash
# CI設定を全影分身に反映
scj sync --all --files --custom .github/workflows/ci.yml,.gitlab-ci.yml

# または専用スクリプト
cat > sync-ci.sh << 'EOF'
#!/bin/bash
CI_FILES=".github/workflows/*.yml,.gitlab-ci.yml,Jenkinsfile"
scj sync --all --files --custom "$CI_FILES"
EOF
chmod +x sync-ci.sh
```

### 選択的同期

```bash
# 特定のパターンに一致する影分身のみ同期
scj list --json | jq -r '.worktrees[] | select(.branch | startswith("feature/")) | .branch' | while read branch; do
  echo "Syncing $branch..."
  scj sync "$branch" --rebase
done
```

### 同期状態の確認

```bash
# 各影分身の同期状態を確認
scj list --json | jq -r '.worktrees[] | "\(.branch): \(.behind) commits behind"' | grep -v ": 0 commits"
```

## エラーハンドリング

### よくあるエラー

1. **マージ競合**
   ```
   Error: Merge conflict in files: src/index.js, src/utils.js
   ```
   解決方法: 影分身に移動して手動で競合を解決

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

# 2. 全影分身をrebaseで同期
scj sync --all --rebase

# 3. 環境ファイルも同期
scj sync --all --preset env

echo "✅ Sync completed"
```

### 2. 同期前のバックアップ

```bash
# スナップショットを作成してから同期
scj snapshot --all -m "Before sync"
scj sync --all --rebase
```

### 3. プロジェクト固有の設定

`.scj.json` で同期設定をカスタマイズ：

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
alias scj-sync-all='scj sync --all --rebase'
alias scj-sync-env='scj sync --all --preset env'
alias scj-sync-safe='scj sync --dry-run'

# 使用例
scj-sync-all    # 全影分身をrebase同期
scj-sync-env    # 環境ファイルを同期
```

### 条件付き同期

```bash
# テストが通った場合のみ同期
sync_if_tests_pass() {
  local branch=$1
  
  if scj exec "$branch" npm test; then
    scj sync "$branch" --rebase
  else
    echo "Tests failed for $branch, skipping sync"
  fi
}

# 使用例
sync_if_tests_pass feature-branch
```

## 関連コマンド

- [`scj list`](./list.md) - 同期が必要な影分身を確認
- [`scj health`](./health.md) - 同期状態の健全性をチェック
- [`scj snapshot`](./snapshot.md) - 同期前にスナップショットを作成
- [`scj watch`](./watch.md) - ファイル変更を自動同期
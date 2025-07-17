# 📚 コマンドリファレンス

maestro (mst) の全コマンドの詳細な使用方法を説明します。

## 基本コマンド

### 🎼 create - 演奏者の作成

新しい演奏者（worktree）を作成します。

```bash
mst create <branch-name> [options]
```

#### オプション
- `--base <branch>` - ベースとなるブランチを指定（デフォルト: main）
- `--open` - エディタで自動的に開く
- `--setup` - 開発環境の自動セットアップ
- `--tmux` - tmuxセッションを作成
- `--claude` - Claude Code用のCLAUDE.mdを作成
- `--template <name>` - テンプレートを使用
- `--draft-pr` - Draft PRを自動作成
- `-y, --yes` - 確認をスキップ

#### 例
```bash
# 基本的な使用
mst create feature/awesome-feature

# 完全セットアップ
mst create feature/full-setup --tmux --claude --open --setup

# GitHub Issueから作成
mst create 123  # Issue #123 から自動でブランチ名を生成
```

### 📋 list - 演奏者の一覧表示

すべての演奏者を一覧表示します。

```bash
mst list [options]
```

#### オプション
- `--json` - JSON形式で出力
- `--sort <field>` - ソート基準（branch, path, size）
- `--filter <pattern>` - フィルタリング
- `--details` - 詳細情報を表示

#### 例
```bash
# 基本的な一覧表示
mst list

# 詳細情報付き
mst list --details

# サイズ順でソート
mst list --sort size
```

### 🗑️ delete - 演奏者の削除

演奏者を削除します。

```bash
mst delete [branch-name] [options]
```

#### オプション
- `--force` - 強制削除
- `--remove-remote` - リモートブランチも削除
- `--fzf` - fzfで選択（複数選択可）
- `--current` - 現在のworktreeを削除

#### 例
```bash
# 基本的な削除
mst delete feature/old-feature

# 強制削除（未コミット変更があっても削除）
mst delete feature/broken --force

# fzfで複数選択削除
mst delete --fzf
```

### 🔄 sync - 演奏者の同期

演奏者間でファイルを同期します。

```bash
mst sync [options]
```

#### オプション
- `--files <pattern>` - 同期するファイルパターン
- `--from <branch>` - 同期元のブランチ
- `--to <branch>` - 同期先のブランチ
- `--dry-run` - 実際には同期せずに確認のみ
- `--auto` - 自動同期モード

#### 例
```bash
# 基本的な同期
mst sync

# 特定のファイルのみ同期
mst sync --files "*.env"

# ドライランモード
mst sync --dry-run
```

## 統合コマンド

### 🤖 suggest - AI提案

Claude Codeを使用して各種提案を行います。

```bash
mst suggest [options]
```

#### オプション
- `--branch` - ブランチ名の提案
- `--commit` - コミットメッセージの提案
- `--issue` - Issueタイトルの提案
- `--pr` - PRタイトル/説明の提案
- `--review` - レビューコメントの提案
- `--description <text>` - 説明文を指定
- `--diff` - 差分を含める

#### 例
```bash
# ブランチ名の提案
mst suggest --branch --description "ユーザー認証機能の追加"

# コミットメッセージの提案
mst suggest --commit --diff

# PR説明の提案
mst suggest --pr --description "ログイン機能の実装"
```

### 🔗 github - GitHub統合

GitHubとの統合機能を提供します。

```bash
mst github [options]
```

#### オプション
- `--issue <number>` - Issue番号から影分身を作成
- `--pr <number>` - PR番号から影分身を作成
- `--create-pr` - PRを作成
- `--draft` - Draft PRとして作成
- `--branch <name>` - ブランチ名を指定

#### 例
```bash
# Issue #123 から演奏者を作成
mst github --issue 123

# PR #456 から演奏者を作成
mst github --pr 456

# 現在のブランチからPRを作成
mst github --create-pr
```

### 🖥️ tmux - tmux統合

tmuxセッションで演奏者を管理します。

```bash
mst tmux [branch-name] [options]
```

#### オプション
- `--detach` - デタッチモードで起動
- `--kill` - セッションを終了
- `--list` - アクティブなセッションを一覧表示
- `--editor` - エディタを起動

#### 例
```bash
# 演奏者をtmuxで開く
mst tmux feature/awesome

# fzfで選択
mst tmux

# デタッチモードで起動
mst tmux feature/background --detach
```

## 高度な機能

### 📊 dashboard - ダッシュボード

Web UIダッシュボードを起動します。

```bash
mst dashboard [options]
```

#### オプション
- `--port <number>` - ポート番号を指定（デフォルト: 3000）
- `--open` - ブラウザで自動的に開く
- `--host <address>` - ホストアドレスを指定

#### 例
```bash
# ダッシュボードを起動
mst dashboard

# ポート8080で起動
mst dashboard --port 8080 --open
```

### 🩺 health - ヘルスチェック

演奏者の健康状態をチェックします。

```bash
mst health [options]
```

#### オプション
- `--fix` - 問題を自動修正
- `--json` - JSON形式で出力
- `--verbose` - 詳細な診断情報

#### 例
```bash
# 基本的なヘルスチェック
mst health

# 問題を自動修正
mst health --fix

# 詳細な診断
mst health --verbose
```

### 📸 snapshot - スナップショット

作業状態のスナップショットを管理します。

```bash
mst snapshot <command> [options]
```

#### サブコマンド
- `create <name>` - スナップショットを作成
- `list` - スナップショット一覧
- `restore <name>` - スナップショットを復元
- `delete <name>` - スナップショットを削除

#### 例
```bash
# スナップショットを作成
mst snapshot create before-refactor

# スナップショット一覧
mst snapshot list

# スナップショットを復元
mst snapshot restore before-refactor
```

### 👁️ watch - ファイル監視

ファイル変更を監視して自動同期します。

```bash
mst watch [options]
```

#### オプション
- `--files <pattern>` - 監視するファイルパターン
- `--ignore <pattern>` - 除外するファイルパターン
- `--auto` - 確認なしで自動同期
- `--dry` - ドライランモード

#### 例
```bash
# 基本的な監視
mst watch

# 特定のファイルのみ監視
mst watch --files "src/**/*.ts"

# 自動同期モード
mst watch --auto
```

## ユーティリティコマンド

### 🔧 config - 設定管理

設定を管理します。

```bash
mst config <command> [options]
```

#### サブコマンド
- `get <key>` - 設定値を取得
- `set <key> <value>` - 設定値を設定
- `list` - 全設定を一覧表示
- `reset` - 設定をリセット

#### 例
```bash
# 設定を確認
mst config list

# エディタを設定
mst config set development.defaultEditor cursor

# 設定を取得
mst config get worktrees.root
```

### 📍 where - 現在位置確認

現在のworktreeの位置を確認します。

```bash
mst where [options]
```

#### オプション
- `--json` - JSON形式で出力
- `--verbose` - 詳細情報を表示

#### 例
```bash
# 現在位置を確認
mst where

# 詳細情報付き
mst where --verbose
```

### 🔗 exec - コマンド実行

全ての演奏者で同じコマンドを実行します。

```bash
mst exec <command> [options]
```

#### オプション
- `--parallel` - 並列実行
- `--continue-on-error` - エラー時も継続
- `--dry-run` - 実際には実行せずに確認のみ

#### 例
```bash
# 全ての演奏者でテストを実行
mst exec "npm test"

# 並列実行
mst exec "npm run lint" --parallel
```

### 🔄 batch - バッチ処理

複数の演奏者を一括処理します。

```bash
mst batch <command> [options]
```

#### サブコマンド
- `create <pattern>` - パターンに基づいて複数作成
- `delete <pattern>` - パターンに基づいて複数削除
- `sync` - 全ての演奏者を同期

#### 例
```bash
# 複数の演奏者を作成
mst batch create feature/task-{1..5}

# パターンに基づいて削除
mst batch delete "feature/old-*"
```

### 📋 template - テンプレート管理

プロジェクトテンプレートを管理します。

```bash
mst template <command> [options]
```

#### サブコマンド
- `list` - テンプレート一覧
- `create <name>` - テンプレートを作成
- `apply <name>` - テンプレートを適用
- `delete <name>` - テンプレートを削除

#### 例
```bash
# テンプレート一覧
mst template list

# テンプレートを作成
mst template create react-component

# テンプレートを適用
mst template apply react-component
```

### 🔍 mcp - MCP サーバー

MCPサーバーを管理します。

```bash
mst mcp <command> [options]
```

#### サブコマンド
- `start` - MCPサーバーを起動
- `stop` - MCPサーバーを停止
- `status` - MCPサーバーの状態を確認
- `restart` - MCPサーバーを再起動

#### 例
```bash
# MCPサーバーを起動
mst mcp start

# サーバーの状態を確認
mst mcp status
```

### 🎯 attach - セッション接続

既存のtmuxセッションに接続します。

```bash
mst attach [session-name] [options]
```

#### オプション
- `--create` - セッションが存在しない場合は作成
- `--detach-others` - 他のクライアントをデタッチ

#### 例
```bash
# セッションに接続
mst attach feature-awesome

# セッションを作成して接続
mst attach new-session --create
```

### 📈 graph - 関係図表示

演奏者の関係図を表示します。

```bash
mst graph [options]
```

#### オプション
- `--format <type>` - 出力形式（text, json, mermaid）
- `--depth <number>` - 表示する階層の深さ

#### 例
```bash
# 関係図を表示
mst graph

# Mermaid形式で出力
mst graph --format mermaid
```

### 📚 history - 履歴表示

演奏者の操作履歴を表示します。

```bash
mst history [options]
```

#### オプション
- `--limit <number>` - 表示する履歴の数
- `--json` - JSON形式で出力
- `--filter <pattern>` - フィルタリング

#### 例
```bash
# 履歴を表示
mst history

# 最新10件のみ表示
mst history --limit 10
```

### 🔍 issue - Issue管理

GitHub Issueと連携します。

```bash
mst issue <command> [options]
```

#### サブコマンド
- `create` - Issueを作成
- `list` - Issue一覧を表示
- `view <number>` - Issueを表示
- `close <number>` - Issueを閉じる

#### 例
```bash
# Issueを作成
mst issue create

# Issue一覧を表示
mst issue list

# Issue #123 を表示
mst issue view 123
```

### 🔍 review - レビュー管理

Pull Requestのレビューを管理します。

```bash
mst review <command> [options]
```

#### サブコマンド
- `create` - レビューを作成
- `list` - レビュー一覧を表示
- `approve <number>` - PRを承認
- `request-changes <number>` - 変更を要求

#### 例
```bash
# レビューを作成
mst review create

# PRを承認
mst review approve 123

# 変更を要求
mst review request-changes 123
```

### 🔄 completion - 自動補完

シェルの自動補完を設定します。

```bash
mst completion <shell>
```

#### 対応シェル
- `bash` - Bash用補完
- `zsh` - Zsh用補完
- `fish` - Fish用補完

#### 例
```bash
# Zsh用補完を設定
mst completion zsh > ~/.zsh/completions/_mst

# Bash用補完を設定
mst completion bash > /etc/bash_completion.d/mst
```

## グローバルオプション

すべてのコマンドで使用可能なオプション：

- `--help, -h` - ヘルプを表示
- `--version, -V` - バージョンを表示
- `--verbose, -v` - 詳細な出力
- `--quiet, -q` - 静寂モード
- `--config <path>` - 設定ファイルのパスを指定
- `--no-color` - 色を無効化

## 設定ファイル

`mst.config.json` で設定をカスタマイズできます：

```json
{
  "worktrees": {
    "root": "../worktrees",
    "branchPrefix": "feature/",
    "autoCleanup": true
  },
  "development": {
    "defaultEditor": "cursor",
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"],
    "hooks": {
      "preCreate": ["npm install"],
      "postCreate": ["npm run setup"]
    }
  },
  "integrations": {
    "claude": {
      "enabled": true,
      "autoGenerate": true
    },
    "tmux": {
      "enabled": true,
      "autoAttach": true
    },
    "github": {
      "enabled": true,
      "autoLink": true
    }
  },
  "ui": {
    "theme": "orchestra",
    "colors": true,
    "animations": true
  }
}
```

## 環境変数

- `MST_CONFIG_PATH` - 設定ファイルのパス
- `MST_WORKTREES_ROOT` - Worktreeのルートディレクトリ
- `MST_DEFAULT_EDITOR` - デフォルトエディタ
- `MST_GITHUB_TOKEN` - GitHub API トークン
- `MST_CLAUDE_ENABLED` - Claude Code統合の有効/無効
- `DEBUG` - デバッグモード (`DEBUG=mst:*`)

## エラーハンドリング

maestroは以下のエラーを適切に処理します：

- Git関連エラー
- ファイルシステムエラー
- ネットワークエラー
- 権限エラー
- 設定エラー

エラーが発生した場合は、`--verbose` オプションを使用して詳細な情報を確認してください。

## より詳細な情報

各コマンドの詳細な使用方法については、以下のドキュメントを参照してください：

- [作成コマンド詳細](./commands/create.md)
- [削除コマンド詳細](./commands/delete.md)
- [同期コマンド詳細](./commands/sync.md)
- [GitHub統合詳細](./commands/github.md)
- [ヘルスチェック詳細](./commands/health.md)
- [スナップショット詳細](./commands/snapshot.md)
- [バッチ処理詳細](./commands/batch.md)
- [履歴管理詳細](./commands/history.md)
- [一覧表示詳細](./commands/list.md)
# 🥷 shadow-clone-jutsu

[![CI](https://github.com/hashiramaendure/shadow-clone-jutsu/actions/workflows/ci.yml/badge.svg)](https://github.com/hashiramaendure/shadow-clone-jutsu/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/hashiramaendure/shadow-clone-jutsu/branch/main/graph/badge.svg)](https://codecov.io/gh/hashiramaendure/shadow-clone-jutsu)
[![npm version](https://badge.fury.io/js/shadow-clone-jutsu.svg)](https://www.npmjs.com/package/shadow-clone-jutsu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**影分身の術（Git Worktree）で、Claude Codeとパラレル開発を実現するCLIツール**

![Demo Animation](https://via.placeholder.com/800x400/1a1a1a/00ff00?text=shadow-clone-jutsu+demo)

## 📋 目次

- [概要](#概要)
- [主な特徴](#主な特徴)
- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [コマンドリファレンス](#コマンドリファレンス)
- [高度な機能](#高度な機能)
- [設定](#設定)
- [トラブルシューティング](#トラブルシューティング)
- [貢献](#貢献)

## 概要

shadow-clone-jutsuは、Git Worktreeをより直感的に管理できるCLIツールです。複数のブランチで並行作業を行う際に、ディレクトリを切り替えることなく、各ブランチを独立した「影分身」として扱うことができます。

### なぜ shadow-clone-jutsu？

- **🚀 並行開発の効率化**: 複数の機能開発やバグ修正を同時進行
- **🤖 AI駆動開発**: Claude Codeと完全統合し、AIペアプログラミングを実現
- **🎯 直感的な操作**: 忍者テーマで楽しく、覚えやすいコマンド体系
- **🔗 エコシステム統合**: GitHub、tmux、fzfとシームレスに連携

## 主な特徴

| 機能 | 説明 |
|------|------|
| 🥷 **忍者テーマ** | Worktreeを「影分身」として扱う直感的なインターフェース |
| 🤖 **Claude Code統合** | MCP (Model Context Protocol) によるAI開発支援 |
| 🔗 **GitHub統合** | PR/Issueから直接影分身を作成 |
| 🎯 **tmux/fzf統合** | 効率的なワークフロー |
| 🎨 **インタラクティブUI** | 美しく使いやすいCLI体験 |
| 📊 **ダッシュボード** | Web UIで全体を可視化 |
| 🔄 **自動同期** | ファイル変更を検知して自動同期 |
| 📸 **スナップショット** | 作業状態の保存と復元 |

## インストール

### 前提条件

- **Node.js** >= 20.0.0
- **Git** >= 2.22.0
- **npm** または **pnpm** (推奨)

### インストール方法

#### 📦 npm / pnpm / yarn

```bash
# npm
npm install -g shadow-clone-jutsu

# pnpm (推奨)
pnpm add -g shadow-clone-jutsu

# yarn
yarn global add shadow-clone-jutsu

# または直接実行
npx shadow-clone-jutsu
```

#### 🍺 Homebrew (macOS/Linux)

```bash
brew tap hashiramaendure/tap
brew install shadow-clone-jutsu
```

#### 🪟 Scoop (Windows)

```powershell
scoop bucket add hashiramaendure https://github.com/hashiramaendure/scoop-bucket
scoop install shadow-clone-jutsu
```

#### 📂 ソースからインストール

```bash
git clone https://github.com/hashiramaendure/shadow-clone-jutsu.git
cd shadow-clone-jutsu
pnpm install
pnpm run build
pnpm link
```

## クイックスタート

### 🚀 3ステップで始める

```bash
# 1. プロジェクトディレクトリに移動
cd your-git-project

# 2. 新しい影分身（worktree）を作成
scj create feature/awesome-feature

# 3. 作成した影分身で作業を開始
scj shell feature/awesome-feature
```

### 📚 基本的な使用例

#### 複数の機能を並行開発

```bash
# 認証機能の開発（Claude Code連携）
scj create feature/auth --tmux --claude

# バグ修正を並行で実施
scj create bugfix/login-issue

# 影分身の一覧を確認
scj list

# 影分身間を素早く切り替え
scj tmux
```

#### GitHub連携

```bash
# IssueからWorktreeを作成
scj create 123  # issue-123として作成される

# PRから影分身を作成
scj github pr 456

# Draft PRを自動作成
scj create feature/new-ui --draft-pr
```

#### Claude Code統合

```bash
# Claude Codeと一緒に開発を開始
scj create feature/ai-integration --tmux --claude

# AI差分レビューを実行
scj suggest --review

# 自動レビュー&マージフロー
scj review --auto-flow
```

## コマンドリファレンス

### 📊 主要コマンド一覧

| コマンド | エイリアス | 説明 | 使用例 |
|---------|-----------|------|-------|
| `create` | `c` | 新しい影分身を作成 | `scj create feature/new` |
| `list` | `ls`, `l` | 影分身の一覧表示 | `scj list --json` |
| `delete` | `rm`, `d` | 影分身を削除 | `scj delete feature/old` |
| `shell` | `sh` | 影分身のシェルに入る | `scj shell feature/new` |
| `exec` | `e` | 影分身でコマンド実行 | `scj exec feature/new npm test` |
| `where` | `w` | 影分身のパスを表示 | `scj where feature/new` |
| `sync` | `s` | コード・ファイル同期 | `scj sync --all --files` |
| `tmux` | `t` | tmux統合 | `scj tmux --new-window` |
| `github` | `gh` | GitHub統合 | `scj github pr 123` |
| `suggest` | `sg` | AI提案機能 | `scj suggest --review` |
| `review` | `r` | PRレビュー支援 | `scj review --auto-flow` |
| `batch` | `b` | 一括作成 | `scj batch` |
| `health` | `check` | 健全性チェック | `scj health --fix` |
| `snapshot` | `snap` | スナップショット | `scj snapshot -m "before refactor"` |
| `dashboard` | `ui` | Web UI | `scj dashboard` |

### 🎯 よく使うコマンドの詳細

#### 📦 create - 影分身を作り出す

```bash
# 基本的な使い方
scj create feature/new-feature

# Issue番号から作成
scj create 123           # issue-123として作成
scj create #123          # issue-123として作成
scj create issue-123     # issue-123として作成

# オプション付き
scj create feature/new-feature \
  --base develop \        # ベースブランチ指定
  --open \               # エディタで開く
  --setup \              # 環境セットアップ実行
  --tmux \               # tmuxセッション作成
  --claude \             # Claude Code起動
  --draft-pr            # Draft PR作成
```

**オプション一覧:**

| オプション | 短縮形 | 説明 |
|-----------|--------|------|
| `--base` | `-b` | ベースブランチを指定 |
| `--open` | `-o` | 作成後にエディタで開く |
| `--setup` | `-s` | npm install等を自動実行 |
| `--tmux` | | tmuxセッション/ウィンドウを作成 |
| `--claude` | | Claude Codeを自動起動 |
| `--draft-pr` | | GitHub Draft PRを作成 |

#### 📋 list - 影分身の一覧を表示

```bash
# 基本的な一覧表示
scj list

# JSON形式で出力（CI/CD連携用）
scj list --json

# fzfで選択
scj list --fzf

# メタデータ付きで表示
scj list --metadata
```

**出力例:**
```
🥷 影分身一覧:

  main (current)
  ├─ /Users/ninja/project
  └─ 2 days ago

  feature/auth 
  ├─ /Users/ninja/project/.git/shadow-clones/feature-auth
  └─ 5 hours ago

  bugfix/login-issue [GitHub #123]
  ├─ /Users/ninja/project/.git/shadow-clones/bugfix-login-issue
  └─ 1 hour ago
```

#### 🔄 sync - worktree間でコード・ファイル同期

```bash
# 特定の影分身に同期
scj sync feature-branch

# 全ての影分身に同期
scj sync --all

# 環境変数・設定ファイルを同期
scj sync --files

# プリセットを使用
scj sync --preset env     # .env系ファイルのみ
scj sync --preset config  # 設定ファイルのみ
scj sync --preset all     # 全ての設定ファイル

# インタラクティブにファイル選択
scj sync --interactive
```

#### 🤖 suggest - Claude Codeによる提案

```bash
# ブランチ名を提案
scj suggest --branch -d "認証機能の実装"

# コミットメッセージを提案
scj suggest --commit --diff

# AI差分レビュー
scj suggest --review

# Issue/PRから情報を取得して提案
scj suggest -b --issue 123
scj suggest -b --pr 456
```

## 高度な機能

### 🚀 自動レビュー&マージフロー

```bash
# 自動フローを実行
scj review --auto-flow
```

**実行される処理:**
1. ✅ `git fetch origin main && git rebase origin/main`
2. 🔧 競合発生時は`claude /resolve-conflict`でClaude Code起動
3. 📝 `claude /review --diff origin/main`でコードレビュー実行
4. 💬 Conventional Commitメッセージを自動生成
5. 🚀 GitHub PR作成

### 📊 統合ダッシュボード

```bash
# ダッシュボードを起動
scj dashboard

# カスタムポートで起動
scj dashboard --port 3000
```

**ダッシュボード機能:**
- 全worktreeの状態を一覧表示
- GitHub連携状況の可視化
- 健全性ステータス表示
- リアルタイム更新（30秒ごと）

### 📸 スナップショット機能

```bash
# スナップショットを作成
scj snapshot -m "リファクタリング前の状態"

# 全worktreeのスナップショット
scj snapshot --all

# スナップショットから復元
scj snapshot --restore snapshot-xxxxx
```

### 🏥 worktree健全性チェック

```bash
# 健全性をチェック
scj health

# 自動修正
scj health --fix

# 古いworktreeを削除（30日以上）
scj health --prune --days 30
```

**検出される問題:**
- 🕰️ `stale`: 長期間更新されていない
- 👻 `orphaned`: リモートブランチが存在しない
- 🌊 `diverged`: メインブランチから大きく乖離
- 📝 `uncommitted`: 未コミットの変更
- ⚔️ `conflict`: マージ競合が未解決
- ❌ `missing`: ディレクトリが存在しない

## 設定

### 📁 プロジェクト設定 (.scj.json)

```json
{
  "worktrees": {
    "path": ".git/shadow-clones",
    "branchPrefix": "feature/"
  },
  "development": {
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"],
    "defaultEditor": "cursor"
  },
  "hooks": {
    "afterCreate": "npm install",
    "beforeDelete": "echo \"影分身を削除します: $SHADOW_CLONE\""
  },
  "claude": {
    "autoStart": true,
    "markdownMode": "shared",
    "initialCommands": ["/model sonnet-3.5"]
  }
}
```

### 🤖 MCP統合設定

Claude Codeの設定（`.claude/mcp_settings.json`）に追加:

```json
{
  "mcpServers": {
    "shadow-clone-jutsu": {
      "command": "scj",
      "args": ["mcp", "serve"]
    }
  }
}
```

### 🐚 シェル補完

#### Bash

```bash
scj completion bash >> ~/.bashrc
source ~/.bashrc
```

#### Zsh

```bash
mkdir -p ~/.zsh/completions
scj completion zsh > ~/.zsh/completions/_scj
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc
source ~/.zshrc
```

#### Fish

```bash
scj completion fish > ~/.config/fish/completions/scj.fish
```

## トラブルシューティング

### ❓ よくある問題と解決方法

| 問題 | 解決方法 |
|------|----------|
| Git バージョンエラー | Git 2.22.0以上にアップデート: `brew install git` |
| fzf が見つからない | fzfをインストール: `brew install fzf` |
| tmux が見つからない | tmuxをインストール: `brew install tmux` |
| Claude Codeが起動しない | MCPサーバー設定を確認 |

### 🔍 デバッグモード

```bash
# デバッグ情報を表示
DEBUG=scj:* scj create feature/debug

# 詳細なログを出力
scj --verbose create feature/test
```

## 貢献

### 🤝 コントリビューション

バグ報告や機能リクエストは[GitHub Issues](https://github.com/hashiramaendure/shadow-clone-jutsu/issues)へお願いします。

プルリクエストも歓迎します！

### 📚 関連ドキュメント

- [貢献ガイドライン](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [変更履歴](./CHANGELOG.md)
- [ライセンス](./LICENSE)

### 🛠️ 開発

```bash
# リポジトリをクローン
git clone https://github.com/hashiramaendure/shadow-clone-jutsu.git
cd shadow-clone-jutsu

# 依存関係をインストール
pnpm install

# 開発モードで実行
pnpm dev

# テストを実行
pnpm test

# ビルド
pnpm build
```

## ライセンス

[MIT License](./LICENSE) © 2024 hashiramaendure

---

<div align="center">

**🥷 Happy parallel development with shadow-clone-jutsu!**

[GitHub](https://github.com/hashiramaendure/shadow-clone-jutsu) • 
[npm](https://www.npmjs.com/package/shadow-clone-jutsu) • 
[Issues](https://github.com/hashiramaendure/shadow-clone-jutsu/issues) • 
[Discussions](https://github.com/hashiramaendure/shadow-clone-jutsu/discussions)

</div>

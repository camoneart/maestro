# 🎼 Maestro

**[English](/README.en.md)** | **日本語**

[![npm version](https://badge.fury.io/js/maestro.svg)](https://www.npmjs.com/package/maestro)
[![CI](https://github.com/hashiramaendure/maestro/actions/workflows/ci.yml/badge.svg)](https://github.com/hashiramaendure/maestro/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/hashiramaendure/maestro/branch/main/graph/badge.svg)](https://codecov.io/gh/hashiramaendure/maestro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Git Worktreeオーケストレーションで、Claude Codeとパラレル開発を実現するCLIツール**

![maestro](public/image/logo/maestro-logo.png)

![Demo Animation](https://via.placeholder.com/800x400/1a1a1a/00ff00?text=maestro+demo)

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

Maestroは、Git Worktreeをより直感的に管理できるCLIツールです。複数のブランチで並行作業を行う際に、ディレクトリを切り替えることなく、各ブランチを独立した「オーケストラメンバー」として扱うことができます。

### なぜ Maestro？

**Pain**: 従来のGitワークフローでは複数機能の並行開発時に頻繁なブランチ切り替え、stash、コンテキストスイッチが発生し、開発効率が著しく低下します。

**Solution**: MaestroはGit Worktreeを活用して各ブランチを独立した「演奏者」として作成し、完全並行開発とAI統合を実現します。

**Benefit**: 開発者は複数機能を同時進行し、Claude Codeによる AI駆動開発、tmux/fzf統合による完璧なワークフロー効率を手に入れることができます。

## 主な特徴

| 機能 | 説明 |
|------|------|
| 🎼 **指揮者テーマ** | Worktreeを「オーケストラメンバー」として扱う直感的なインターフェース |
| 🤖 **Claude Code統合** | MCP (Model Context Protocol) によるAI開発支援 |
| 🔗 **GitHub統合** | PR/Issueから直接演奏者を作成 |
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

#### 🌟 グローバルインストール（推奨）

```bash
# pnpm (推奨)
pnpm add -g maestro

# npm
npm install -g maestro

# yarn
yarn global add maestro
```

#### ⚡ ワンショット実行

```bash
# 試してみる場合
npx maestro create feature/my-feature

# また pnpm dlx も使用可能
pnpm dlx maestro create feature/my-feature --tmux --claude --open
```

#### 🍺 Homebrew (macOS/Linux)

```bash
brew tap hashiramaendure/tap
brew install maestro
```

#### 🪟 Scoop (Windows)

```powershell
scoop bucket add hashiramaendure https://github.com/hashiramaendure/scoop-bucket
scoop install maestro
```

#### 📂 ソースからインストール

```bash
git clone https://github.com/hashiramaendure/maestro.git
cd maestro
pnpm install
pnpm run build
pnpm link
```

## クイックスタート

### 🚀 3ステップで始める

```bash
# 1. プロジェクトディレクトリに移動
cd your-git-project

# 2. 新しい演奏者（worktree）を作成
mst create feature/awesome-feature

# 3. 作成した演奏者で作業を開始
mst shell feature/awesome-feature
```

### 📚 基本的な使用例

#### 複数の機能を並行開発

```bash
# 認証機能の開発（Claude Code連携）
mst create feature/auth --tmux --claude

# バグ修正を並行で実施
mst create bugfix/login-issue

# 演奏者の一覧を確認
mst list

# 演奏者間を素早く切り替え
mst tmux
```

#### GitHub連携

```bash
# IssueからWorktreeを作成
mst create 123  # issue-123として作成される

# PRから演奏者を作成
mst github pr 456

# Draft PRを自動作成
mst create feature/new-ui --draft-pr
```

#### Claude Code統合

```bash
# Claude Codeと一緒に開発を開始
mst create feature/ai-integration --tmux --claude

# AI差分レビューを実行
mst suggest --review

# 自動レビュー&マージフロー
mst review --auto-flow
```

## コマンドリファレンス

詳細なコマンドドキュメントは[docs/COMMANDS.md](./docs/COMMANDS.md)を参照してください。

### 📊 主要コマンド（10選）

| コマンド | 説明 | 使用例 |
|---------|------|-------|
| `create` | 新しい演奏者を作成 | `mst create feature/new --tmux --claude --open` |
| `list` | 演奏者の一覧表示 | `mst list --details` |
| `delete` | 演奏者を削除 | `mst delete feature/old --fzf` |
| `tmux` | tmuxセッションで開く | `mst tmux feature/new` |
| `sync` | ファイル同期 | `mst sync --auto` |
| `suggest` | AI提案機能 | `mst suggest --branch --description "新機能"` |
| `github` | GitHub統合 | `mst github --issue 123` |
| `dashboard` | Web UI起動 | `mst dashboard --open` |
| `health` | 健全性チェック | `mst health --fix` |
| `where` | 現在位置確認 | `mst where --verbose` |

### 🎯 クイックリファレンス

```bash
# 基本的な使い方
mst create feature/awesome-feature
mst list
mst tmux feature/awesome-feature

# 完全セットアップ
mst create feature/full-setup --tmux --claude --open --setup

# AI提案
mst suggest --branch --description "ユーザー認証機能"
mst suggest --commit --diff

# GitHub統合
mst github --issue 123
mst github --create-pr
```

## 高度な機能

### 🚀 自動レビュー&マージフロー

```bash
# 自動フローを実行
mst review --auto-flow
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
mst dashboard

# カスタムポートで起動
mst dashboard --port 3000
```

**ダッシュボード機能:**
- 全worktreeの状態を一覧表示
- GitHub連携状況の可視化
- 健全性ステータス表示
- リアルタイム更新（30秒ごと）

### 📸 スナップショット機能

```bash
# スナップショットを作成
mst snapshot -m "リファクタリング前の状態"

# 全worktreeのスナップショット
mst snapshot --all

# スナップショットから復元
mst snapshot --restore snapshot-xxxxx
```

### 🏥 worktree健全性チェック

```bash
# 健全性をチェック
mst health

# 自動修正
mst health --fix

# 古いworktreeを削除（30日以上）
mst health --prune --days 30
```

**検出される問題:**
- 🕰️ `stale`: 長期間更新されていない
- 👻 `orphaned`: リモートブランチが存在しない
- 🌊 `diverged`: メインブランチから大きく乖離
- 📝 `uncommitted`: 未コミットの変更
- ⚔️ `conflict`: マージ競合が未解決
- ❌ `missing`: ディレクトリが存在しない

## 設定

### 📁 プロジェクト設定 (.maestro.json)

```json
{
  "worktrees": {
    "path": ".git/orchestra-members",
    "branchPrefix": "feature/"
  },
  "development": {
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"],
    "defaultEditor": "cursor"
  },
  "hooks": {
    "afterCreate": "npm install",
    "beforeDelete": "echo \"演奏者を削除します: $ORCHESTRA_MEMBER\""
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
    "maestro": {
      "command": "mst",
      "args": ["mcp", "serve"]
    }
  }
}
```

### 🐚 シェル補完

#### Bash

```bash
mst completion bash >> ~/.bashrc
source ~/.bashrc
```

#### Zsh

```bash
mkdir -p ~/.zsh/completions
mst completion zsh > ~/.zsh/completions/_mst
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc
source ~/.zshrc
```

#### Fish

```bash
mst completion fish > ~/.config/fish/completions/mst.fish
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
DEBUG=mst:* mst create feature/debug

# 詳細なログを出力
mst --verbose create feature/test
```

## 貢献

### 🤝 コントリビューション

バグ報告や機能リクエストは[GitHub Issues](https://github.com/hashiramaendure/maestro/issues)へお願いします。

プルリクエストも歓迎します！

### 📚 関連ドキュメント

- [貢献ガイドライン](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [変更履歴](./CHANGELOG.md)
- [ライセンス](./LICENSE)

### 🛠️ 開発

```bash
# リポジトリをクローン
git clone https://github.com/hashiramaendure/maestro.git
cd maestro

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

Licensed under the [MIT License](./LICENSE).

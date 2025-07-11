# 🥷 shadow-clone-jutsu

[![CI](https://github.com/hashiramaendure/shadow-clone-jutsu/actions/workflows/ci.yml/badge.svg)](https://github.com/hashiramaendure/shadow-clone-jutsu/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/hashiramaendure/shadow-clone-jutsu/branch/main/graph/badge.svg)](https://codecov.io/gh/hashiramaendure/shadow-clone-jutsu)
[![npm version](https://badge.fury.io/js/shadow-clone-jutsu.svg)](https://badge.fury.io/js/shadow-clone-jutsu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

影分身の術（Git Worktree）で、Claude Codeとパラレル開発を実現するCLIツール

## 概要

shadow-clone-jutsuは、Git Worktreeをより直感的に管理できるCLIツールです。複数のブランチで並行作業を行う際に、ディレクトリを切り替えることなく、各ブランチを独立した「影分身」として扱うことができます。

### 主な特徴

- 🥷 **忍者テーマ**: Worktreeを「影分身」として扱う直感的なインターフェース
- 🤖 **Claude Code統合**: MCP (Model Context Protocol) によるAI開発支援
- 🔗 **GitHub統合**: PR/Issueから直接影分身を作成
- 🎯 **tmux/fzf統合**: 効率的なワークフロー
- 🎨 **インタラクティブUI**: 美しく使いやすいCLI体験

## インストール

### 前提条件

- Node.js >= 20.0.0
- Git >= 2.22.0
- npm または yarn

### グローバルインストール

```bash
npm install -g shadow-clone-jutsu
```

または

```bash
git clone https://github.com/hashiramaendure/shadow-clone-jutsu.git
cd shadow-clone-jutsu
npm install
npm run build
npm link
```

## 使い方

### 基本コマンド

#### 影分身を作り出す

```bash
# 新しい影分身を作成
scj create feature/new-feature

# Issue番号から影分身を作成
scj create 123           # issue-123として作成
scj create #123          # issue-123として作成
scj create issue-123     # issue-123として作成

# tmuxセッション付きで作成（Claude Code自動起動）
scj create feature/new-feature --tmux --claude

# 設定可能なオプション
scj create feature/new-feature --base main --open --setup --tmux --claude

# ベースブランチを指定して作成
scj create feature/new-feature --base develop

# 作成後に自動でエディタを開く
scj create feature/new-feature --open
```

#### 影分身の一覧を表示

```bash
# 一覧表示
scj list
scj ls  # エイリアス

# JSON形式で出力
scj list --json

# fzfで選択（選択したブランチ名を出力）
scj list --fzf
```

#### 影分身のパスを表示

```bash
# 特定の影分身のパスを表示
scj where feature/new-feature

# 現在のworktreeのパスを表示
scj where --current

# fzfで選択してパスを表示
scj where --fzf
```

#### 影分身のシェルに入る

```bash
# 特定の影分身のシェルに入る
scj shell feature/new-feature

# fzfで選択してシェルに入る
scj shell --fzf

# エイリアス
scj sh feature/new-feature
```

#### 影分身でコマンドを実行

```bash
# 特定の影分身でコマンドを実行
scj exec feature/new-feature npm test

# 全ての影分身でコマンドを実行
scj exec --all npm install

# エイリアス
scj e feature/new-feature npm test
```

#### 影分身を削除

```bash
# 影分身を削除
scj delete feature/old-feature

# 強制削除
scj delete feature/old-feature --force

# エイリアス
scj rm feature/old-feature
```

### 高度な機能

#### 自動レビュー&マージフロー

```bash
# 自動レビュー&マージフロー実行
scj review --auto-flow

# または特定のPRに対して
scj review 123 --auto-flow

# インタラクティブメニューから選択
scj review 123  # メニューから「🚀 自動レビュー&マージフロー」を選択
```

**自動レビューフローの内容:**
1. `git fetch origin main && git rebase origin/main`
2. 競合発生時は`claude /resolve-conflict`でClaude Code起動
3. `claude /review --diff origin/main`でコードレビュー実行
4. Conventional Commitメッセージを自動生成
5. GitHub PR作成

#### GitHub統合

```bash
# PR から影分身を作成
scj github pr 123

# Issue から影分身を作成
scj github issue 456

# インタラクティブに選択
scj github

# エイリアス
scj gh pr 123
```

#### 既存のブランチから影分身を作成

```bash
# リモートブランチから影分身を作成
scj attach origin/feature/existing

# インタラクティブに選択
scj attach

# エイリアス
scj a
```

#### tmux統合

```bash
# fzfで選択してtmuxセッション/ウィンドウ/ペインで開く
scj tmux

# 新しいウィンドウで開く
scj tmux --new-window

# ペインを分割して開く
scj tmux --split-pane

# エイリアス
scj t
```

#### 複数の影分身を一括作成（バッチ処理）

```bash
# GitHub Issuesから複数選択して一括作成
scj batch

# ファイルから一括作成
scj batch --from-file worktrees.txt

# インタラクティブに複数入力
scj batch --interactive

# オプション
scj batch -o              # 作成後にエディタで開く
scj batch -s              # 環境セットアップを実行
scj batch -b main         # ベースブランチを指定

# エイリアス
scj b
```

**バッチファイルフォーマット:**
```
# コメント行
branch-name | description | issue/pr番号
feature-auth | 認証機能の実装 | #123
bugfix-login | ログインバグの修正 | pr-45
refactor-api | APIのリファクタリング
```

#### Claude Code会話履歴の管理

```bash
# 全ての履歴を一覧表示
scj history --list

# 特定ブランチの履歴を表示
scj history --show feature-auth

# 履歴をエクスポート
scj history --export all-histories.json
scj history --export all-histories.md

# 全履歴を1ファイルにマージ
scj history --merge merged-history.md

# 不要な履歴をクリーンアップ
scj history --cleanup

# 履歴パスを同期
scj history --sync

# エイリアス
scj h
```

#### Claude Codeによるブランチ名・コミットメッセージ提案

```bash
# ブランチ名を提案
scj suggest --branch
scj suggest -b -d "認証機能の実装"
scj suggest -b --issue 123

# コミットメッセージを提案
scj suggest --commit
scj suggest -c --diff

# 両方を提案
scj suggest

# Issueから情報を取得して提案
scj suggest -b -i 123

# PRから情報を取得して提案
scj suggest -b -p 45

# エイリアス
scj sg
```

#### worktree間でのコード・ファイル同期

```bash
# メインブランチの変更を特定の影分身に同期
scj sync feature-branch

# 全ての影分身に同期
scj sync --all

# インタラクティブに選択
scj sync

# rebaseで同期（デフォルトはmerge）
scj sync --rebase

# 環境変数・設定ファイルを同期
scj sync --files

# インタラクティブにファイルを選択して同期
scj sync --interactive

# プリセットを使用してファイル同期
scj sync --preset env     # .env系ファイルのみ
scj sync --preset config  # 設定ファイルのみ
scj sync --preset all     # 全ての設定ファイル

# コード同期とファイル同期を同時に実行
scj sync --all --files

# エイリアス
scj s
```

#### worktree依存関係グラフの可視化

```bash
# テキスト形式で表示（デフォルト）
scj graph

# 最新コミットと日付を表示
scj graph --show-commits --show-dates

# Mermaid形式で出力
scj graph --format mermaid

# Graphviz DOT形式で出力して画像生成
scj graph --format dot --output graph.dot

# エイリアス
scj g
```

#### worktreeテンプレート機能

```bash
# 利用可能なテンプレートを表示
scj template --list

# 現在の設定をテンプレートとして保存
scj template --save my-template

# グローバルテンプレートとして保存
scj template --save my-template --global

# テンプレートを適用して影分身を作成
scj create feature-new --template feature
scj create bug-fix --template bugfix

# テンプレートを削除
scj template --delete my-template

# エイリアス
scj tpl
```

**デフォルトテンプレート:**
- `feature`: 新機能開発用（Claude Code自動起動）
- `bugfix`: バグ修正用
- `experiment`: 実験的開発用（tmux統合）
- `docs`: ドキュメント作成用（カスタムファイル付き）

#### GitHub Issues/PR連携とメタデータ管理

```bash
# Issue番号から影分身を作成（自動的にGitHub情報を取得）
scj create 123
scj create #123
scj create issue-123

# 作成された影分身のメタデータを確認
scj list --metadata

# JSON形式でメタデータを含む一覧を取得
scj list --json
```

**自動取得される情報:**
- Issue/PRのタイトル、本文、作成者
- ラベル、担当者、マイルストーン
- 作成日時、worktree情報
- 使用したテンプレート

**メタデータの保存場所:**
各worktreeの `.scj-metadata.json` ファイルに保存されます

#### 自動コード同期機能（ファイル監視）

```bash
# 現在のworktreeでファイル変更を監視
scj watch

# 全てのworktreeに自動同期
scj watch --all

# 特定のパターンのみ監視
scj watch --patterns "*.ts" "*.js" "*.json"

# 除外パターンを指定
scj watch --exclude "node_modules/**" "dist/**"

# ドライラン（実際の同期は行わない）
scj watch --dry

# 確認なしで自動同期
scj watch --auto
```

#### 統合ダッシュボード（Web UI）

```bash
# ダッシュボードサーバーを起動（デフォルト: http://localhost:8765）
scj dashboard

# カスタムポートで起動
scj dashboard --port 3000

# ブラウザを自動で開かない
scj dashboard --no-open

# エイリアス
scj ui
```

**ダッシュボードの機能:**
- 全worktreeの状態を一覧表示
- GitHub Issues/PR連携状況の表示
- 健全性ステータスの可視化
- 統計情報（総数、アクティブ数、要確認数）
- エディタ・ターミナルで直接開く機能
- 30秒ごとの自動更新
- ダークテーマ対応

#### worktreeスナップショット機能

```bash
# 現在のworktreeのスナップショットを作成
scj snapshot
scj snapshot -m "機能実装前の状態"

# 変更をスタッシュに保存してスナップショット作成
scj snapshot --stash

# 全てのworktreeのスナップショットを作成
scj snapshot --all

# スナップショット一覧を表示
scj snapshot --list

# スナップショットを復元
scj snapshot --restore snapshot-xxxxx

# スナップショットを削除
scj snapshot --delete snapshot-xxxxx

# エイリアス
scj snap
```

**スナップショットに保存される情報:**
- Git状態（ブランチ、トラッキング、ahead/behind）
- ステージング済み・変更・未追跡ファイル
- 最終コミット情報
- worktreeメタデータ
- オプションでスタッシュ

#### worktree健全性チェック

```bash
# 全てのworktreeの健全性をチェック
scj health

# 修正可能な問題を自動修正
scj health --fix

# 古いworktreeを削除（デフォルト: 30日以上）
scj health --prune

# 古いと判定する日数を指定
scj health --days 60

# 詳細情報を表示
scj health --verbose

# エイリアス
scj check
```

**検出される問題:**
- `stale`: 長期間更新されていないworktree
- `orphaned`: リモートブランチが存在しないworktree
- `diverged`: メインブランチから大きく乖離したworktree
- `uncommitted`: 未コミットの変更があるworktree
- `conflict`: マージ競合が未解決のworktree
- `missing`: ディレクトリが存在しないworktree

### 設定管理

#### プロジェクト設定の初期化

```bash
# .scj.json を作成
scj config init
```

#### 設定の表示

```bash
# プロジェクト設定を表示
scj config show

# グローバル設定を表示
scj config show --global
```

#### Claude Code統合設定

プロジェクトまたはグローバル設定（`~/.scjrc`）で以下を設定可能:

```json
{
  "claude": {
    "autoStart": true,
    "markdownMode": "shared",
    "initialCommands": ["/model sonnet-3.5"],
    "costOptimization": {
      "stopHooks": ["/compact", "/clear"],
      "maxOutputTokens": 5000,
      "historyPath": "~/.claude/history/{branch}.md"
    }
  },
  "tmux": {
    "enabled": true,
    "openIn": "window",
    "sessionNaming": "{branch}"
  }
}
```

**CLAUDE.md処理モード:**
- `shared`: ルートのCLAUDE.mdをシンボリックリンクで共有
- `split`: 各worktreeに専用のCLAUDE.mdを作成

**コスト最適化機能:**
- `stopHooks`: Claude Code停止時の自動実行コマンド
- `maxOutputTokens`: 最大出力トークン数制限
- `historyPath`: ブランチ別セッション履歴保存先

### MCP統合（Claude Code連携）

```bash
# MCPサーバーを起動
scj mcp serve
```

Claude Codeの設定ファイル（`.claude/mcp_settings.json`）に以下を追加：

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

## 設定ファイル

### プロジェクト設定 (.scj.json)

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
  }
}
```

### 設定オプション

- **worktrees.path**: 影分身を作成するディレクトリ
- **worktrees.branchPrefix**: ブランチ名に自動付与するプレフィックス
- **development.autoSetup**: 作成時に環境セットアップを自動実行
- **development.syncFiles**: 同期するファイルのリスト
- **development.defaultEditor**: デフォルトのエディタ（vscode/cursor/none）
- **hooks.afterCreate**: 影分身作成後に実行するコマンド
- **hooks.beforeDelete**: 影分身削除前に実行するコマンド

## シェル補完

### Bash

```bash
scj completion bash >> ~/.bashrc
source ~/.bashrc
```

### Zsh

```bash
mkdir -p ~/.zsh/completions
scj completion zsh > ~/.zsh/completions/_scj
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc
source ~/.zshrc
```

### Fish

```bash
scj completion fish > ~/.config/fish/completions/scj.fish
```

## トラブルシューティング

### Git バージョンエラー

shadow-clone-jutsuはGit 2.22.0以上が必要です。以下のコマンドでGitをアップデートしてください：

```bash
# macOS
brew install git

# Ubuntu/Debian
sudo add-apt-repository ppa:git-core/ppa
sudo apt update
sudo apt install git
```

### fzf が見つからない

tmuxコマンドや--fzfオプションを使用するにはfzfが必要です：

```bash
# macOS
brew install fzf

# Linux
git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf
~/.fzf/install
```

## ライセンス

MIT

## 貢献

バグ報告や機能リクエストは[GitHub Issues](https://github.com/hashiramaendure/shadow-clone-jutsu/issues)へお願いします。

プルリクエストも歓迎します！

---

🥷 Happy parallel development with shadow-clone-jutsu!
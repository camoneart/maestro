# 🥷 shadow-clone-jutsu

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

- Node.js >= 18.0.0
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
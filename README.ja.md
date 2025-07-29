# Maestro

[![Node.js >=20.0.0](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-45CC11?labelColor=555555&style=flat&logoColor=FFFFFF)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/@camoneart/maestro?color=007EC5&labelColor=555555&style=flat&logoColor=FFFFFF)](https://www.npmjs.com/package/@camoneart/maestro)
[![License MIT](https://img.shields.io/badge/License-MIT-yellow?labelColor=555555&style=flat)](https://opensource.org/licenses/MIT)

![maestro](public/image/logo/maestro-logo.png)
**Git worktreeを“オーケストラ”のように操り、Claude Codeとの並列開発を加速するCLIツール。**

![Demo Animation](https://via.placeholder.com/800x400/2D3748/FFFFFF?text=Demo+Animation+Coming+Soon)

**[English](/README.md)** | **日本語**

## 目次

- [概要](#概要)
- [主な特徴](#主な特徴)
- [インストール](#インストール)
- [アップデート](#アップデート)
- [要件](#要件)
- [クイックスタート](#クイックスタート)
- [コマンドリファレンス](#コマンドリファレンス)
- [高度な機能](#高度な機能)
- [設定](#設定)
- [トラブルシューティング](#トラブルシューティング)
- [貢献](#貢献)
- [ライセンス](#ライセンス)

## 概要

Maestroは、Git worktreeをより直感的に管理できるCLIツールです。複数のブランチで並行作業を行う際に、ディレクトリを切り替えることなく、各ブランチを独立した「オーケストラメンバー」として扱うことができます。

### なぜ Maestro？

| 課題                                                                         | Maestro のアプローチ                                               | 得られるメリット                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| **並列開発の非効率**<br/>ブランチ切り替え・stash・コンテキストスイッチが多発 | **Worktree を自動管理**<br/>各機能を独立したディレクトリで同時開発 | ブランチ移動ゼロでマルチタスクが快適 |
| **タスク管理が煩雑**<br/>複数機能の状態把握が難しい                          | **CLI 一覧 & ステータス**<br/>演奏者（worktree）の状態を可視化    | 迷わず現在地と進捗を把握             |
| **レビュー・マージ作業の負荷**                                               | **Claude Code 連携**<br/>AI による差分レビューと自動 PR フロー     | レビュー時間を大幅短縮               |

## 特徴

| 機能                    | 説明                               |
| ----------------------- | ---------------------------------- |
| 🎼 **オーケストラUI**   | Worktree を演奏者として直感操作    |
| 🤖 **Claude AI 連携**   | AI による差分レビュー & コード提案 |
| 🔗 **GitHub 連携**      | Issue / PR からワークツリーを生成  |
| 🎯 **tmux / fzf**       | キーボードだけで高速セッション切替 |
| 📊 **ステータス**       | リアルタイムの worktree 状態監視   |
| 🔄 **自動同期**         | 変更をリアルタイムで全演奏者へ反映 |
| 📸 **スナップショット** | 任意の状態を保存・ワンクリック復元 |
| 🏥 **ヘルスチェック**   | 孤立ブランチや競合を検出・自動修復 |

## インストール

### Homebrew を使用 (推奨)

```bash
brew install camoneart/tap/maestro
```

※ Homebrew でインストールすると、zsh / fish / Bash すべての補完スクリプトが自動で配置されます。<br>
※ Bash で利用する場合は `brew install bash-completion@2` が必要です。詳細は [シェル補完](#シェル補完) セクションを参照してください。

### npm を使用

```bash
npm install -g @camoneart/maestro
```

### pnpm を使用

```bash
# pnpm が入っていない場合は最初に: npm install -g pnpm
pnpm add -g @camoneart/maestro
```

## アップデート

### Homebrew を使用

```bash
brew upgrade camoneart/tap/maestro
```

### npm を使用

```bash
npm update -g @camoneart/maestro
```

### pnpm を使用

```bash
pnpm update -g @camoneart/maestro
```

## 要件

| 要件 | バージョン | 用途 | インストールコマンド |
|------|-----------|------|--------------------|
| **Node.js** | >=20.0.0 | JavaScript ランタイム | [nodejs.org](https://nodejs.org/) |
| **Git** | >=2.22 | Worktree サポート | `brew install git` |
| **tmux** (オプション) | Any | セッション管理 | `brew install tmux` |
| **fzf** (オプション) | Any | ファジーファインディング | `brew install fzf` |
| **GitHub CLI** (オプション) | Any | GitHub 連携 | `brew install gh` |

## クイックスタート

```bash
# 1. インストール  ※Homebrew 例
brew install camoneart/tap/maestro

# 2. Git プロジェクトに移動
cd ~/path/to/your-repo

# 2.5. プロジェクトで maestro を初期化（新機能！）
mst init                                      # 対話的セットアップ
# または: mst init --yes                      # デフォルト設定で素早くセットアップ

# 3. 新しい worktree (演奏者) を作成
mst create feature/awesome-feature            # まず作成だけ

# 4. その演奏者のシェルに入る
mst shell feature/awesome-feature             # シェルへ入室

# ── ワンライナー (tmux + Claude) ──
# 作成と同時に tmux セッションを作成してアタッチを確認 & Claude Code ワークスペースファイルを設定
mst create feature/awesome-feature --tmux --claude-md
```

#### ポイント

- `mst shell <ブランチ名>` でいつでも演奏者に入れます（省略すると fzf で選択）。
- `--tmux` を付けると専用 tmux セッションを作成してアタッチを確認し（非TTY環境では自動アタッチ）、`--claude-md` を併用すると Claude Code ワークスペースファイルを設定します。
- `--tmux-h`/`--tmux-v` は現在の tmux ペインを水平/垂直分割し、新しいペインに自動フォーカスして即座に開発開始できます。
- `--tmux-h-panes <数>`/`--tmux-v-panes <数>` は指定数の水平/垂直ペインを作成します。
- `--tmux-layout <種類>` は特定の tmux レイアウト（even-horizontal、even-vertical、main-horizontal、main-vertical、tiled）を適用します。

### 基本的な使用例

| 目的                                    | コマンド例                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| **並列開発** 新機能とバグ修正を同時進行 | `mst create feature/auth --tmux --claude-md`<br>`mst create bugfix/login-issue` |
| **状態確認** 演奏者一覧を表示           | `mst list`                                                                   |
| **高速切替** tmux セッションへ          | `mst tmux`                                                                   |
| **GitHub Issue から作成**               | `mst create 123`                                                             |
| **GitHub PR から作成**                  | `mst github checkout 456`                                                    |
| **GitHub issues/PRs一覧表示**           | `mst github list`                                                            |
| **Push with PR**                      | `mst push --pr`                                                              |
| **Push with draft PR**                | `mst push --draft-pr`                                                        |
| **自動レビュー & マージ**               | `mst review --auto-flow`                                                     |

## コマンドリファレンス

詳細は [コマンドリファレンス](./docs/COMMANDS.md) を参照してください。

### 主要コマンド

| コマンド    | 説明                       | ショート例                     |
| ----------- | -------------------------- | ------------------------------ |
| `init`      | プロジェクト設定を初期化    | `mst init --yes`               |
| `create`    | 新しい worktree を作成     | `mst create feature/login`     |
| `list`      | worktree を一覧表示        | `mst list`                     |
| `delete`    | worktree・ブランチ・tmuxセッションを削除 | `mst delete feature/old --keep-session` |
| `tmux`      | tmux セッションで開く      | `mst tmux`                     |
| `sync`      | ファイルをリアルタイム同期 | `mst sync --auto`              |
| `push`      | Push してPR作成            | `mst push --pr`                |
| `github`    | Issue / PR 連携            | `mst github checkout 123`      |
| `health`    | worktree 健全性チェック    | `mst health --fix`             |
| `where`     | 現在位置確認               | `mst where`                    |

すべてのサブコマンドと詳細オプションは [コマンドリファレンス](./docs/COMMANDS.md) を参照してください。

#### ワンラインチートシート

```bash
# 代表的な操作
mst create feature/my-ui --tmux --claude-md   # 作成 + AI + tmux
mst create feature/api --tmux-h-panes 3       # 作成 + 3つの水平ペイン
mst list                                       # 一覧
mst tmux                                       # fzf で切替
mst push --pr                                  # push with PR
mst review --auto-flow                         # 自動レビュー〜マージ
```

## 高度な機能

Maestro が提供する “もう一歩進んだ” 機能を一覧で把握できます。<br>
各コマンドは **1 行** で実行でき、煩雑な作業をまるごと自動化します。

| 機能                         | コマンド例                                                     | やってくれること                                                                 |
| ---------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **自動レビュー & マージ 🚀** | `mst review --auto-flow`                                       | fetch → rebase → AI レビュー → Conventional Commit → PR 作成をワンコマンドで実行 |
| **GitHub連携 🔗**           | `mst github list` <br>`mst github checkout 123`                | GitHub issue/PR一覧表示・チェックアウト、リポジトリワークフロー自動化          |
| **スナップショット 📸**      | `mst snapshot -m "前の状態"` <br>`mst snapshot --restore <id>` | 任意時点の状態を保存し、いつでも復元                                             |
| **健全性チェック 🏥**        | `mst health` <br>`mst health --fix`                            | stale / orphaned / conflict などを検出し、自動修復                               |

さらに詳しいオプションは `mst <command> --help` で確認できます。

## 設定

### 📁 プロジェクト設定 `.maestro.json`

Maestro は **リポジトリ直下の `.maestro.json`** を読み取り、動作をカスタマイズできます。<br>
よく使うキーを以下の表にまとめ、完全なサンプルは表に続くコードブロックで確認できます。

### ⚙️ 設定管理

Maestroはドット記法を使って設定を管理するコマンドを提供します:

```bash
# 設定値を取得
mst config get ui.pathDisplay                      # パス表示設定を取得
mst config get development.autoSetup               # 自動セットアップ設定を取得

# 設定値を設定  
mst config set ui.pathDisplay relative             # 自動的にユーザー設定として保存
mst config set --user ui.pathDisplay relative     # 明示的にユーザー設定に保存
mst config set --project worktrees.path "../"     # 明示的にプロジェクト設定に保存
mst config set development.defaultEditor cursor    # デフォルトエディタを設定（ユーザー設定）

# デフォルト値にリセット
mst config reset ui.pathDisplay                    # パス表示をデフォルトにリセット
mst config reset development.autoSetup             # 自動セットアップをデフォルトにリセット

# 設定ファイルの表示と管理
mst config show                                    # 現在の有効な設定を表示
mst config path                                    # 設定ファイルの場所を表示
mst config init                                    # プロジェクト設定を作成
```

**Claude設定:**
- `markdownMode: "shared"` - メインリポジトリのCLAUDE.mdへのシンボリックリンクを作成（デフォルト）
- `markdownMode: "split"` - 各worktreeに独立したCLAUDE.mdファイルを作成

| カテゴリ    | 主なキー       | 役割                                    | 例 / デフォルト                     |
| ----------- | -------------- | --------------------------------------- | ----------------------------------- |
| worktrees   | `path`         | worktree（演奏者）の格納先              | `../maestro-{branch}`               |
|             | `directoryPrefix` | worktreeディレクトリのプレフィックス | `""` (空文字列)                     |
|             | `branchPrefix` | 作成時のブランチ接頭辞                  | `feature/`                          |
| development | `autoSetup`    | 作成直後に `npm install` などを自動実行 | `true`                              |
|             | `syncFiles`    | 共有したいファイルの配列                | `[".env", ".env.local"]`            |
|             | `defaultEditor`| デフォルトのエディタ                    | `cursor`                            |
| tmux        | `enabled`      | tmux統合を有効化                        | `false`                             |
|             | `openIn`       | ウィンドウかペインで開く                | `window` (`window` または `pane`)   |
|             | `sessionNaming`| セッション名のパターン                  | `{branch}`                          |
| claude      | `markdownMode` | CLAUDE.md ファイル管理モード            | `shared` (`shared` または `split`)  |
| github      | `autoFetch`    | 操作前に自動でfetch                     | `true`                              |
|             | `branchNaming.prTemplate` | PRブランチ名テンプレート      | `pr-{number}`                       |
|             | `branchNaming.issueTemplate` | Issueブランチ名テンプレート | `issue-{number}`                    |
| ui          | `pathDisplay`  | 全コマンドでのパス表示形式              | `absolute` (`absolute` または `relative`) |
| hooks       | `afterCreate`  | 作成後に実行する任意コマンド            | `npm install`                       |
|             | `beforeDelete` | 削除前フック                            | `echo "Deleting $ORCHESTRA_MEMBER"` |

#### デフォルト値付き完全なサンプル

```json
{
  "worktrees": {
    "path": "../maestro-{branch}",     // デフォルト: "../maestro-{branch}"
    "directoryPrefix": "",              // デフォルト: "" (空文字列)
    "branchPrefix": "feature/"          // カスタムブランチプレフィックス
  },
  "development": {
    "autoSetup": true,                  // デフォルト: true
    "syncFiles": [".env", ".env.local"], // デフォルト: [".env", ".env.local"]
    "defaultEditor": "cursor"           // デフォルト: "cursor"
  },
  "tmux": {
    "enabled": false,                   // デフォルト: false
    "openIn": "window",                 // デフォルト: "window" (オプション: "window" | "pane")
    "sessionNaming": "{branch}"         // デフォルト: "{branch}"
  },
  "claude": {
    "markdownMode": "shared"            // デフォルト: "shared" (オプション: "shared" | "split")
  },
  "github": {
    "autoFetch": true,                  // デフォルト: true
    "branchNaming": {
      "prTemplate": "pr-{number}",       // デフォルト: "pr-{number}"
      "issueTemplate": "issue-{number}"  // デフォルト: "issue-{number}"
    }
  },
  "ui": {
    "pathDisplay": "absolute"           // デフォルト: "absolute" (オプション: "absolute" | "relative")
  },
  "hooks": {
    "afterCreate": "npm install",
    "beforeDelete": "echo \"演奏者を削除します: $ORCHESTRA_MEMBER\""
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

### シェル補完

Maestro は **Bash / zsh / fish** の補完スクリプトを提供します。

| インストール方法 | Bash                                    | Zsh / Fish  |
| ---------------- | --------------------------------------- | ----------- |
| Homebrew         | 自動 (※ bash は bash-completion@2 必須) | 自動        |
| npm / pnpm       | 手動 (下記)                             | 手動 (下記) |

#### Bash で手動設定 (npm 版など)

```bash
# 前提: bash-completion v2 をインストール済み
brew install bash-completion@2   # macOS の例

# .bashrc または .bash_profile に追記
eval "$(mst completion bash)"
```

#### zsh で手動設定

```bash
mkdir -p ~/.zsh/completions
mst completion zsh > ~/.zsh/completions/_mst
autoload -U compinit && compinit  # 設定済みであれば不要
```

#### fish で手動設定

```bash
mst completion fish > ~/.config/fish/completions/mst.fish
```

## トラブルシューティング

### ❓ よくあるエラーと対処法

| エラー内容                                | 主な原因                         | ワンライン解決策                  |
| ----------------------------------------- | -------------------------------- | --------------------------------- |
| **Git が古い**<br>`fatal: unknown option` | Git バージョン < 2.22            | `brew install git`                |
| **fzf が見つからない**                    | fzf 未インストール               | `brew install fzf`                |
| **tmux が見つからない**                   | tmux 未インストール              | `brew install tmux`               |
| **Claude Code が起動しない**              | MCP サーバー未起動 or ポート競合 | `mst mcp status` → `mst mcp stop` |

### その他のエラーコード例

| エラーコード | 原因                           | 解決策                              |
| ------------ | ------------------------------ | ----------------------------------- |
| `EADDRINUSE` | MCP サーバーのポート競合       | `mst mcp stop` で既存プロセスを停止 |
| `ENOENT`     | Git 実行ファイルが見つからない | Git の PATH を確認、再インストール  |

上記で解決しない場合は [Issues](https://github.com/camoneart/maestro/issues) で検索または新規 Issue を作成してください。

### 🔍 デバッグモード

```bash
# すべての内部ログを表示
DEBUG=mst:* mst create feature/debug

# 詳細なログをファイルに保存
DEBUG=mst:* mst review --auto-flow &> maestro-debug.log
```

## 貢献

### 🤝 コントリビューションの流れ

1. [**Issue**](https://github.com/camoneart/maestro/issues) でバグ報告・機能提案を送る
2. このリポジトリを **Fork** し、`feat/your-topic` などのブランチを作成
3. 開発後 `pnpm lint && pnpm test` でスタイルとテストを通過させる
4. **Conventional Commits** 形式でコミット
5. Pull Request を作成し、レビューテンプレに沿って概要を記入

詳細は [Contributing Guide](/CONTRIBUTING.md) と [Code of Conduct](/CODE_OF_CONDUCT.md) を参照してください。

## ライセンス

Licensed under the [MIT License](./LICENSE).

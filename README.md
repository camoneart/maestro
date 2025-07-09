# 🍃 shadow-clone-jutsu

**影分身の術（Git Worktree）** で、Claude Codeとパラレル開発を実現するツール

## 📝 概要

shadow-clone-jutsuは、Git Worktreeを活用してClaude Codeによる並列開発を効率化する個人向けCLIツールです。複数のブランチで同時に作業を進め、AIアシスタントと連携した高速な開発を実現します。

## 🎯 コンセプト

- **影分身の術**: 一つのリポジトリから複数の作業環境（worktree）を生成
- **Claude Code連携**: MCPサーバー経由でAIが直接worktreeを操作
- **シンプルな操作**: 複雑なGitコマンドを覚える必要なし

## 🚀 主な機能（予定）

### コア機能
- ✅️ Worktreeの作成・削除・切り替え
- ✅️ 現在のWorktree一覧表示
- ✅️ ブランチ名の自動生成

### Claude Code連携
- ✅️ MCPサーバーの実装
- ✅️ 各worktreeごとのCLAUDE.md自動生成
- ✅️ 作業コンテキストの自動記録

### 開発効率化
- ✅️ 環境セットアップの自動化（npm install等）
- ✅️ .envファイルの同期
- ✅️ ポート番号の自動割り当て
- ✅️ VSCode/Cursorの自動起動

### 個人向け最適化
- ✅️ 作業時間のトラッキング
- ✅️ よく使うブランチ名のテンプレート
- ✅️ 個人用設定ファイルのサポート

## 🛠️ 技術スタック（予定）

- 言語: TypeScript/Node.js or Go
- CLI: Commander.js or Cobra
- MCP: Model Context Protocol Server

## 📦 インストール（開発中）

```bash
# 将来的な予定
npm install -g shadow-clone-jutsu
# または
brew install shadow-clone-jutsu
```

## 🎮 使い方（予定）

```bash
# 新しい影分身を作り出す
scj create feature/new-auth

# 影分身の一覧
scj list

# 影分身に切り替え
scj switch feature/new-auth

# 影分身を削除
scj delete feature/new-auth

# Claude Code用のMCPサーバー起動
scj mcp serve
```

## 🔮 今後の展望

- Git Worktreeのベストプラクティスを組み込んだワークフロー
- より高度なAI統合機能
- チーム開発への拡張（将来的に）

## 📝 メモ

このツールは個人利用を前提として開発しています。

---

*影分身の術で、開発速度を爆速に！* 🍥
EOF < /dev/null
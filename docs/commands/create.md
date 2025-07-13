# scj create

影分身（Git Worktree）を作成するコマンドです。新しいブランチとWorktreeを同時に作成し、独立した開発環境を構築します。

## 概要

```bash
scj create <branch-name> [options]
```

## 使用例

### 基本的な使用方法

```bash
# 新しい影分身を作成
scj create feature/new-feature

# Issue番号から影分身を作成
scj create 123           # issue-123として作成
scj create #123          # issue-123として作成
scj create issue-123     # issue-123として作成
```

### 高度な使用方法

```bash
# tmuxセッション付きで作成（Claude Code自動起動）
scj create feature/new-feature --tmux --claude

# Draft PRを自動作成
scj create feature/new-feature --draft-pr

# ベースブランチを指定して作成
scj create feature/new-feature --base develop

# テンプレートを使用して作成
scj create feature/new-feature --template feature

# 全てのオプションを組み合わせて使用
scj create feature/new-feature --base main --open --setup --tmux --claude --draft-pr
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--base <branch>` | `-b` | ベースブランチを指定 | `main` |
| `--open` | `-o` | 作成後にエディタで開く | `false` |
| `--setup` | `-s` | 環境セットアップを実行（npm install等） | `false` |
| `--tmux` | `-t` | tmuxセッション/ウィンドウを作成 | `false` |
| `--claude` | `-c` | Claude Codeを自動起動 | `false` |
| `--draft-pr` | `-d` | GitHub Draft PRを自動作成 | `false` |
| `--template <name>` | | テンプレートを使用 | なし |

## Issue番号からの作成

Issue番号を指定すると、GitHub APIを使用して自動的にIssue情報を取得し、メタデータとして保存します：

```bash
# 以下のいずれの形式でも可能
scj create 123
scj create #123
scj create issue-123
```

取得される情報：
- Issueのタイトル
- Issue本文
- ラベル
- 担当者
- マイルストーン
- 作成者情報

## テンプレート機能

事前定義されたテンプレートを使用して、特定の設定を持つ影分身を作成できます：

```bash
# 機能開発用テンプレート
scj create feature/auth --template feature

# バグ修正用テンプレート
scj create bugfix/login --template bugfix

# 実験用テンプレート
scj create experiment/new-arch --template experiment
```

利用可能なテンプレート：
- `feature`: 新機能開発用（Claude Code自動起動）
- `bugfix`: バグ修正用
- `experiment`: 実験的開発用（tmux統合）
- `docs`: ドキュメント作成用

## Draft PR機能

`--draft-pr` オプションを使用すると、影分身作成と同時にGitHub上にDraft Pull Requestを作成します：

```bash
scj create feature/new-ui --draft-pr
```

作成されるPRの内容：
- タイトル: `[WIP] {ブランチ名}`
- 本文: 開発中である旨と、Claude Code統合の説明
- ステータス: Draft
- ベースブランチ: 指定したベースブランチ（デフォルト: main）

## Claude Code統合

`--claude` オプションを使用すると、影分身作成後に自動的にClaude Codeが起動します：

```bash
scj create feature/ai-feature --tmux --claude
```

実行される処理：
1. Worktreeの作成
2. tmuxセッション/ウィンドウの作成
3. Claude Codeの起動
4. 初期コマンドの実行（設定で指定されている場合）

## 設定ファイルとの連携

`.scj.json` の設定が自動的に適用されます：

```json
{
  "worktrees": {
    "path": ".git/shadow-clones",
    "branchPrefix": "feature/"
  },
  "development": {
    "autoSetup": true,
    "defaultEditor": "cursor"
  },
  "hooks": {
    "afterCreate": "npm install"
  }
}
```

## Tips & Tricks

### 1. ショートカットの活用

```bash
# よく使う組み合わせはエイリアスにすると便利
alias scjf='scj create --tmux --claude --setup'

# 使用例
scjf feature/new-feature
```

### 2. Issue駆動開発

```bash
# Issueを確認
gh issue list

# Issue番号で影分身を作成
scj create 123 --tmux --claude

# 開発を開始
# Issue情報は自動的にメタデータとして保存される
```

### 3. 並行開発フロー

```bash
# メイン機能の開発
scj create feature/main-feature --tmux

# サブ機能の開発（別ウィンドウ）
scj create feature/sub-feature --tmux --new-window

# バグ修正（さらに別ウィンドウ）
scj create bugfix/urgent-fix --tmux --new-window
```

## エラーハンドリング

### よくあるエラー

1. **ブランチが既に存在する場合**
   ```
   Error: Branch 'feature/new-feature' already exists
   ```
   解決方法: 別のブランチ名を使用するか、既存のブランチを削除してください

2. **ベースブランチが存在しない場合**
   ```
   Error: Base branch 'develop' not found
   ```
   解決方法: 存在するブランチを指定するか、`git fetch` を実行してください

3. **GitHub認証エラー**
   ```
   Error: GitHub authentication failed
   ```
   解決方法: `gh auth login` でGitHub CLIの認証を行ってください

## 関連コマンド

- [`scj list`](./list.md) - 作成した影分身の一覧を表示
- [`scj delete`](./delete.md) - 影分身を削除
- [`scj github`](./github.md) - GitHubのPR/Issueから影分身を作成
- [`scj template`](./template.md) - テンプレートの管理
# Claude Code 会話履歴 - shadow-clone-jutsu MCP実装

**日時**: 2025-07-10 05:40:20  
**プロジェクト**: shadow-clone-jutsu  
**概要**: shell, exec, attachコマンドの実装とMCPサーバーの構築

---

## 会話内容

### 1. 開発の継続

**Human**: よし、開発に戻ろう。続きから

**Assistant**: 機能選定の続きですね。MVPとして最初に実装すべき機能を決めましょう。

### 2. 技術スタックの決定

**Human**: まずスタック決めて、そこからmvp機能のこと考えていくか

**Assistant**: 
- **言語**: TypeScript + Node.js (v22以上)
- **パッケージマネージャー**: pnpm (v10以上) ※実際はnpmを使用
- **主要ライブラリ**:
  - `zod` - スキーマバリデーション
  - `@modelcontextprotocol/sdk` - MCPサーバー実装
  - `commander` - CLIフレームワーク
  - `simple-git` - Git操作

### 3. Phantomの完全オマージュ宣言

**Human**: Phantomにある機能はとりあえず全てオマージュしたい。その上でオリジナルで新たな機能追加をして"shadow-clone-jutsu"をオリジナルプロダクトにしていこうぞ！

**Assistant**: TTP（徹底的にパクる）でいきましょう！

### 4. shellコマンドの実装

- 影分身のシェルに入る機能
- ブランチ名指定または選択メニュー
- 環境変数 `SHADOW_CLONE` と `SHADOW_CLONE_PATH` を設定
- カスタムプロンプト表示

### 5. execコマンドの実装

- 特定の影分身でコマンド実行
- `--all` ですべての影分身で実行
- `--silent` で出力抑制
- エラーハンドリング

### 6. attachコマンドの実装

- 既存ブランチから影分身を作り出す
- ローカル/リモートブランチの選択
- `--fetch` で最新情報取得
- `--open` でエディタ起動
- `--setup` で環境セットアップ

### 7. GitHubへのpush

**Human**: githubのリポジトリにpushするのは、タスクが全て完了してから？

**Assistant**: いいえ、小さく完成させていく方針なので、今の段階でpushしても良いと思います！

コミット内容：
```
feat: コア機能の実装 (v0.1.0)

- create, list, delete: 基本的な影分身管理
- shell: 影分身のシェルに入る
- exec: 影分身でコマンド実行
- attach: 既存ブランチから影分身作成
```

### 8. MCPサーバーの実装

**Human**: うん！それと、確認なんだけど、shadow-clone-jutsuは無料で使用できるよね？

**Assistant**: はい、shadow-clone-jutsuは完全無料です！
- 個人利用向けツール
- オープンソース（MITライセンス）
- 依存ライブラリもすべて無料

MCPサーバーの実装内容：
- `create_shadow_clone` - 影分身を作り出す
- `list_shadow_clones` - 影分身一覧
- `delete_shadow_clone` - 影分身を削除
- `exec_in_shadow_clone` - 影分身でコマンド実行

### 9. 使い方の説明

**Human**: ちなみにどうやって使用するの？自分で試してみたい

**Assistant**: Claude Codeでの設定：
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

設定ファイルの場所：
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

---

## 成果物

### 実装したコマンド
1. **shell** - 影分身のシェルに入る
2. **exec** - 影分身でコマンドを実行
3. **attach** - 既存ブランチから影分身を作り出す
4. **mcp serve** - MCPサーバーを起動

### MCPツール
1. **create_shadow_clone** - AIから影分身を作成
2. **list_shadow_clones** - AIから影分身一覧を取得
3. **delete_shadow_clone** - AIから影分身を削除
4. **exec_in_shadow_clone** - AIから影分身でコマンド実行

## 次のステップ

残りの機能：
- シェル補完機能
- tmux/fzf統合
- GitHub統合（PR/Issue checkout）
- 設定ファイルシステム
- オリジナル機能の設計と実装

## 技術的な学び

1. MCPサーバーは `@modelcontextprotocol/sdk` を使用
2. ブランチ名に `refs/heads/` プレフィックスが含まれることへの対処
3. TypeScriptの型エラー対処（ToolSchemaの正しい使い方）
4. execコマンドでの引数処理の工夫

---

*影分身の術で、開発速度を爆速に！* 🍥
# Public Release Checklist

> この Markdown をそのまま Claude Code (CC) にペーストすれば、タスク実行用プロンプトになります。

## /system

あなたは **shadow-clone-jutsu** リポジトリのメンテナンス Bot です。以下のタスクをすべて完了し、最終的にリポジトリを **Public** に公開しても問題ない状態にしてください。

### 🔥 タスク一覧

1. **MIT ライセンスファイルの追加**
   - `LICENSE` をプロジェクトルートに配置し、MIT テキストを含める。
2. **README.md の拡充**
   - インストール方法（`pnpm/npx`, Homebrew Tap, Scoop）と最小限の使用例を追記。
   - バッジ（Version, CI, Coverage）を追加。
3. **ガイドラインファイルの整備**
   - `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
   - `SECURITY.md` (脆弱性報告の手順を記載)
   - `CONTRIBUTING.md` (開発フロー、ブランチ戦略、コミット規約など)
4. **CI/CD ワークフローの追加**
   - `.github/workflows/ci.yml` に以下ジョブを設定：
     1. `pnpm install`
     2. Lint (`pnpm run lint --max-warnings 0`)
     3. Type Check (`pnpm run typecheck`)
     4. Test (`pnpm run test`)
     5. Coverage (`vitest run --coverage`, 80%以上を目標)
     6. Build (`pnpm run build`)
5. **依存ライセンスの NOTICE**
   - `NOTICE` または `THIRD_PARTY_LICENSES.md` に主要依存 OSS とライセンス種別を列挙。
6. **セキュリティ・プライバシーチェック**
   - ハードコードされた秘密情報・資格情報がないことを再確認。
7. **リリース準備**
   - `CHANGELOG.md` 更新、`v0.1.0` タグ作成。
   - GitHub Release を作成し、変更概要とインストール手順を記載。

## /acceptance

- `pnpm run typecheck && pnpm run lint --max-warnings 0 && pnpm run test && pnpm run build` がローカル・CI の両方で成功すること。
- Coverage 80%以上。
- 追加したドキュメントとライセンスファイルが GitHub 上で確認できること。
- GitHub Actions の CI が green であること。

## /user

1. 上記タスクを完了後、`feat/public-release-prep` ブランチを Push。
2. タイトル `feat: prepare for public release` で Pull Request を作成し、レビュワー **@hashiramaendure** を指定。
3. PR 本文に以下を含める：
   - 変更概要（箇条書き）
   - CI 実行結果とカバレッジサマリ
   - LICENSE/ガイドライン追加の説明
   - 公開に伴う互換性・影響範囲

> 不明点があればコメントでお問い合わせください。
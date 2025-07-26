# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maestro is a CLI tool for managing Git worktrees with a conductor/orchestra theme. It helps developers work on multiple branches in parallel by creating "orchestra members" (worktrees) with integration for Claude Code, tmux, GitHub, and more.

## Development Commands

**IMPORTANT**: This project uses pnpm exclusively. All commands must use `pnpm` instead of `npm`.

### Build & Test

- `pnpm build` - Build the TypeScript project using tsup
- `pnpm dev` - Watch mode development using tsx
- `pnpm test` - Run tests with vitest
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm test:coverage` - Run tests with coverage report (80% minimum threshold)
- `pnpm typecheck` - Type checking without emitting files

### Code Quality

- `pnpm lint` - ESLint checking on TypeScript files
- `pnpm lint:ci` - CI-specific linting with max 26 warnings threshold
- `pnpm format` - Format code with Prettier
- `pnpm prettier:check` - Check code formatting

### Single Test Execution

- `pnpm test -- path/to/test.test.ts` - Run a specific test file
- `pnpm test -- --reporter=verbose` - Run tests with detailed output

### Publishing

- `pnpm changeset` - Create a changeset for releases
- `pnpm version` - Version bump using changesets
- `pnpm release` - Build and publish to npm
- `pnpm prepublishOnly` - Pre-publish hook (auto-build and generate completions)

## Core Architecture

### Main Components

- **CLI Entry Point**: `src/cli.ts` - Main CLI interface using Commander.js
- **Commands**: `src/commands/` - Individual command implementations
- **Core Logic**: `src/core/` - Core Git and configuration management
- **Types**: `src/types/index.ts` - TypeScript type definitions
- **Utils**: `src/utils/` - Utility functions and helpers

### Key Classes

- `GitWorktreeManager` (src/core/git.ts) - Git worktree operations using simple-git
- Configuration management in `src/core/config.ts`
- Individual command handlers in `src/commands/`

### Technology Stack

- **Language**: TypeScript with ES2022 target
- **CLI Framework**: Commander.js for command structure
- **Git Operations**: simple-git library
- **UI Libraries**: chalk (colors), inquirer (prompts), ora (spinners)
- **File Watching**: chokidar
- **Testing**: Vitest for unit and e2e tests
- **Build**: tsup for bundling

## Command Structure

The CLI follows a modular command structure where each command (create, delete, list, etc.) has its own file in `src/commands/`. Commands support:

- Interactive prompts using inquirer
- fzf integration for selection
- JSON output for scripting
- tmux integration with auto-attach functionality
- Claude Code integration via MCP
- GitHub Issue/PR integration with automatic metadata extraction
- CLAUDE.md file management in shared/split modes

## Testing Approach

### Test Structure

- **Unit tests**: `src/__tests__/commands/` and `src/__tests__/core/`
- **E2E tests**: `e2e/tests/`
- **Test utilities**: `src/__tests__/utils/`
- **Coverage Requirements**: statements: 80%, branches: 75%, functions: 75%, lines: 80% (configured in vitest.config.ts)

### Test-Driven Development (TDD)

This project follows TDD methodology:

1. Create failing test first (Red)
2. Write minimal code to pass (Green)
3. Refactor while keeping tests green
4. Always run `pnpm lint && pnpm typecheck` after changes

### Running Tests

- `pnpm test -- path/to/test.test.ts` - Run specific test file
- `pnpm test:coverage` - Generate coverage report
- `pnpm test:e2e` - Run end-to-end tests

## Implementation Logs

This project maintains implementation logs in `_docs/templates/` with format `yyyy-mm-dd_feature-name.md`. When working on features, check existing logs for context on design decisions and previous implementations.

## MCP Integration

The project includes MCP (Model Context Protocol) server functionality in `src/mcp/server.ts` for Claude Code integration. The MCP server exposes orchestral-themed tools:

- `create_orchestra_member` - Create new worktrees with optional base branch
- `delete_orchestra_member` - Remove worktrees with force option
- `exec_in_orchestra_member` - Execute commands within specific worktrees
- `list_orchestra_members` - List all active worktrees with status

All MCP tools use Zod schemas for validation and follow the orchestra/conductor theme throughout.

## Package Configuration

- **Package Manager**: pnpm (specified in package.json)
- **Node Version**: >=20.0.0
- **Module Type**: ESM with .js extensions in imports
- **Binaries**: `maestro` and `mst` commands

## Key Dependencies

- @modelcontextprotocol/sdk - MCP integration
- simple-git - Git operations
- commander - CLI framework
- inquirer - Interactive prompts
- chalk - Terminal colors
- chokidar - File watching
- conf - Configuration management
- zod - Runtime type validation
- execa - Process execution

## Orchestra Theme & Terminology

Maestro uses orchestra/conductor metaphors throughout:

- **Orchestra Members**: Git worktrees (stored in `.git/orchestra-members`)
- **Performers**: Active worktree sessions
- **Conductors**: Main branch or coordinating worktrees
- **Configuration**: `.maestro.json` for project-specific settings

## Git Commit Guidelines

Follow semantic commit prefixes for this project:

- `feat:` - New features
- `fix:` - Bug fixes
- `test:` - Test additions/updates
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `chore:` - Build/dependency updates

**IMPORTANT**: Always stage files individually with `git add <specific-files>` instead of `git add -A`. Create meaningful commit messages that explain the "why" of changes.

**Post-Implementation Requirements**: After completing any issue fixes or feature additions, always run `pnpm format` to ensure code formatting consistency and avoid CI/Lint errors.

## AI Agent Integration

### Automated Command Documentation Updates

**IMPORTANT**: When you modify, add, or delete files in `src/commands/`, you MUST proactively use the `command-docs-updater` agent to maintain documentation consistency. This includes:

- Adding new commands to `src/commands/`
- Modifying existing command options, flags, or behavior
- Changing command help text or descriptions
- Updating command examples or usage patterns
- Removing or deprecating commands

**Auto-trigger Rules**:
1. After ANY changes to files in `src/commands/`, immediately use the Task tool to launch the `command-docs-updater` agent
2. The agent will automatically identify and update:
   - README.md files at various levels
   - docs/commands/ directory and individual command docs
   - docs/COMMANDS.md master command reference
   - API documentation and command reference guides
   - CLI help text and usage examples
   - Any markdown files referencing the commands

**Example Usage**:
```
After modifying src/commands/create.ts to add a --template option:
Use Task tool: "I've updated the create command to add a new --template option. Please use the command-docs-updater agent to update all related documentation."
```

This ensures documentation always stays in sync with implementation changes without manual intervention.

## Integration Points

### Claude Code MCP

- Server implementation in `src/mcp/server.ts`
- Auto-generates CLAUDE.md files for new worktrees
- Supports AI-powered code review workflows
- Provides orchestral-themed tools for worktree management
- Handles CLAUDE.md file modes: `shared` (symlink to main) or `split` (independent files)

### External Tool Integration

- **GitHub CLI**: Direct `gh` command integration for PR management and Issue/PR metadata extraction
- **tmux**: Session management with auto-attach functionality for `--tmux`, `--tmux-h`, `--tmux-v` options
- **fzf**: Fuzzy finding for interactive selection across commands
- **Shell Completion**: bash/zsh/fish completion scripts available via `mst completion`


## 実装ログ運用ルール

- このプロジェクトでは、全ての実装ログがmainリポジトリの `_docs/templates/` に `yyyy-mm-dd_機能名.md` という形式で保存されています。起動時には必ず必ず必ず `_docs/` 配下をコンテキストとして全て読み込んでおき、前回の設計意図や副作用を踏まえた上で提案するようにしてください。（起動時にまだ `_docs/templates/` が存在しなかったら `_docs/templates/` を作成してから実装を開始して、 `_docs/templates/yyyy-mm-dd_機能名.md` というファイル名で実装ログが必ず必ず必ず残るようにすること）
- 実装が完了したら、`_docs/templates/yyyy-mm-dd_機能名.md` というファイル名でmainリポジトリの `_docs/templates/` に実装ログを残すこと。機能名が複数単語の場合はケバブケースを使用するように。（例：yyyy-mm-dd_product-name.md）
- 実装ログの「日付」欄は **TIME MCP Server** で取得した日時、またはユーザ環境の `now` エイリアス（`date "+%Y-%m-%d %H:%M:%S"`）の出力を使用すること。エイリアスが未設定の場合は `.zshrc` 等に `alias now='date "+%Y-%m-%d %H:%M:%S"'` を追加しておく。
  - 実装ログに含める項目: 実装の目的・背景 / 主な実装内容 / 設計意図 / 副作用 / 関連ファイル

### 実装ログのテンプレート例:

```md
機能名: <ここに機能名>

- 日付: yyyy-mm-dd HH:MM:SS
- 概要: <実装の目的・背景>
- 実装内容: <主な実装内容>
- 設計意図: <なぜこの設計にしたのか>
- 副作用: <懸念事項があれば明記>
- 関連ファイル: <ファイルの場所>
```
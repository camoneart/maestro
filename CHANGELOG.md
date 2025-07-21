# Changelog

## 2.4.0

### Minor Changes

- feat: implement new command options for improved workflow
  - Add --fzf option to exec and shell commands for interactive selection
  - Add tmux integration options (--tmux, --tmux-v, --tmux-h) to exec, shell, and github commands
  - Add --names option to list command for scripting-friendly output
  - Create shared utilities for tmux and fzf operations

## 2.3.0

### Minor Changes

- [#36](https://github.com/hashiramaendure/maestro/pull/36) [`2f43ca5`](https://github.com/hashiramaendure/maestro/commit/2f43ca554aeee7d112779e77e2f814ab92e67006) Thanks [@hashiramaendure](https://github.com/hashiramaendure)! - Add new options to create command and implement attach command
  - Add `--shell` option to create command: enter shell after creating worktree
  - Add `--exec <command>` option to create command: execute command after creating worktree
  - Add `--copy-file <file>` option to create command: copy files from current worktree
  - Implement new `attach` command: create worktree for existing branches
  - Add `--shell` and `--exec` options to attach command
  - Set MAESTRO environment variables when entering shell sessions

## 2.2.1

### Patch Changes

- [`4280a19`](https://github.com/hashiramaendure/maestro/commit/4280a19) Thanks [@hashiramaendure](https://github.com/hashiramaendure)! - fix: resolve worktree branch name matching in delete command

  Fixed an issue where the `mst delete` command would fail with "ワークツリー 'refs/heads/branch-name' が見つかりません" error. The issue occurred because the delete command was passing branch names with the `refs/heads/` prefix to the GitWorktreeManager, which expects clean branch names.

## 2.2.0

### Minor Changes

- [`7a3c70d`](https://github.com/hashiramaendure/maestro/commit/7a3c70d6f76aaa5c9ef103b2973622ff7235a89e) Thanks [@hashiramaendure](https://github.com/hashiramaendure)! - feat: Add tmux pane split functionality
  - Add `--tmux-h` option for horizontal pane split (side by side)
  - Add `--tmux-v` option for vertical pane split (top and bottom)
  - Automatically execute Claude commands in new panes when `--claude` is used
  - Set up tmux status line to show current Git branch
  - Display branch names as pane titles

  This feature brings a Phantom-like development experience to Maestro, allowing developers to maintain their current context while creating new worktrees in split panes within the same tmux window.

## 2.1.1

### Patch Changes

- [`ed0a0ff`](https://github.com/hashiramaendure/maestro/commit/ed0a0ff2fc1b97f3e2a8f8a7f0a62a1d5937ecff) Thanks [@hashiramaendure](https://github.com/hashiramaendure)! - feat(list): Add relative path display for better readability
  - Display worktree paths relative to repository root by default
  - Add `--full-path` option to show absolute paths when needed
  - Current directory shows as `.` for clarity
  - Significantly improves output readability of `mst list` command

## 2.1.0

### Minor Changes

- Add wildcard support to delete command
  - Enable pattern matching with `*` in branch names (e.g., `mst delete "feature/demo-*"`)
  - Support bulk deletion of multiple worktrees matching a pattern
  - Update help text to indicate wildcard support
  - Useful for cleaning up multiple demo or temporary branches at once

## 2.0.2

### Patch Changes

- Fix command execution by adding shebang to cli.ts

## 2.0.1

### Patch Changes

- Fix Homebrew installation by including shell completion files in npm package

## 2.0.0

### Major Changes

- # 🎼 Maestro 2.0.0 - Complete Rebrand from Shadow Clone Jutsu

  This is a **major release** that completely rebrands the project from "shadow-clone-jutsu" to "Maestro" with a conductor/orchestra theme.

  ## 🚨 Breaking Changes

  ### Package & Command Changes
  - **Package name**: `shadow-clone-jutsu` → `@hashiramaendure/maestro`
  - **Command**: `scj` → `maestro` (or `mst` for short)
  - **Configuration file**: `.scj.json` → `.maestro.json`
  - **Default directory**: `.git/shadow-clones` → `.git/orchestrations`

  ### Environment Variables
  - `SHADOW_CLONE` → `MAESTRO_BRANCH`
  - `SHADOW_CLONE_PATH` → `MAESTRO_PATH`

  ### Terminology Changes
  - 影分身 (Shadow Clone) → 演奏者 (Orchestra Member)
  - 忍者 (Ninja) → 指揮者 (Conductor)
  - 🥷 → 🎼

  ## 📦 Migration Guide
  1. **Uninstall old package**:
     ```bash
     npm uninstall -g shadow-clone-jutsu
     ```
  2. **Install new package**:
     ```bash
     npm install -g @hashiramaendure/maestro
     ```
  3. **Update configuration**:
     - Rename `.scj.json` to `.maestro.json`
     - Update any scripts using `scj` command to use `maestro` or `mst`
  4. **Update environment variables**:
     - Replace `SHADOW_CLONE` with `MAESTRO_BRANCH`
     - Replace `SHADOW_CLONE_PATH` with `MAESTRO_PATH`

  ## ✨ What's New
  - Complete theme migration to conductor/orchestra metaphor
  - Improved command messages and user experience
  - Consistent branding throughout the codebase
  - Better alignment with Git worktree mental model

  ## 🙏 Thank You

  Thank you for using Maestro (formerly Shadow Clone Jutsu)! We believe this rebrand better represents the tool's purpose: orchestrating Git worktrees like a conductor leads an orchestra.

  ***

  For more details, see the [migration guide](https://github.com/hashiramaendure/maestro/wiki/migration-guide).

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING**: Rebranded from "shadow-clone-jutsu" to "Maestro" with conductor/orchestra theme
- **BREAKING**: Changed package name from `shadow-clone-jutsu` to `@hashiramaendure/maestro`
- **BREAKING**: Changed CLI command from `scj` to `maestro` (alias: `mst`), keeping `scj` for backward compatibility
- **BREAKING**: Changed configuration file from `.scj.json` to `.maestro.json` (with fallback support)
- **BREAKING**: Changed default worktree directory from `.git/shadow-clones` to `.git/orchestrations`
- Changed all ninja-themed terminology to conductor/orchestra theme:
  - 影分身 → 演奏者/オーケストラメンバー
  - 忍者 → 指揮者
  - 🥷 → 🎼
- Internal: Improved test coverage from 78.21% to 81.23%
- Internal: Refactored create.ts command to reduce complexity from 89 to smaller, maintainable functions
- Internal: Added comprehensive error path tests for github.ts and issue.ts commands
- Internal: Fixed MCP server process.exit issue in test environment

## 1.0.1

### Patch Changes

- [`4fcf9d1`](https://github.com/hashiramaendure/maestro/commit/4fcf9d1740864bc7d860cf32650cafde36f742e3) Thanks [@hashiramaendure](https://github.com/hashiramaendure)! - Test automatic versioning and release workflow setup

## [1.0.0] - 2025-07-15

### Added

- 🥷 影分身の術（Git Worktree）CLIツール初回リリース
- Claude Code統合（MCP）によるAI開発支援
- GitHub統合（PR/Issue連携）
- tmux/fzf統合による効率的ワークフロー
- インタラクティブUI（chalk, inquirer, ora）
- ダッシュボードによる可視化
- スナップショット機能
- ファイル監視・自動同期
- 健全性チェック機能
- 包括的なテストスイート

### Fixed

- TypeScript型エラーを修正
- CLI バージョン出力の問題を修正
- README.md構造とユーザビリティを改善

## [0.1.0] - 2025-07-13

### Added

- Initial release of shadow-clone-jutsu
- Core features:
  - Git worktree management with intuitive ninja-themed interface
  - Claude Code integration via MCP (Model Context Protocol)
  - GitHub Issues/PR integration for automatic branch creation
  - tmux/fzf integration for efficient workflow
  - Interactive UI with beautiful CLI experience
- Commands implemented:
  - `create`: Create new worktree with various options
  - `list`: List all worktrees with metadata
  - `delete`: Remove worktree safely
  - `where`: Show worktree path
  - `shell`: Enter worktree shell
  - `exec`: Execute commands in worktree
  - `sync`: Sync code/files between worktrees
  - `watch`: Auto-sync file changes
  - `attach`: Create worktree from existing branch
  - `github`: Create worktree from GitHub PR/Issue
  - `tmux`: Open worktree in tmux session
  - `batch`: Create multiple worktrees at once
  - `graph`: Visualize worktree dependency graph
  - `template`: Manage worktree templates
  - `history`: Manage Claude Code conversation history
  - `suggest`: Get AI suggestions for branch names and commits
  - `snapshot`: Save/restore worktree state
  - `health`: Check worktree health status
  - `dashboard`: Web UI for worktree management
  - `config`: Manage configuration
  - `mcp`: MCP server integration
- Developer experience:
  - ESLint and Prettier configuration
  - TypeScript support
  - Vitest for testing
  - E2E tests with actual Git operations
  - CI/CD with GitHub Actions
  - Code coverage with codecov
  - Cross-platform support (macOS, Linux, Windows)
  - Installation via npm, Homebrew, and Scoop

### Security

- Added security policy (SECURITY.md)
- No hardcoded secrets or sensitive information in codebase
- All dependencies with compatible open source licenses

### Documentation

- Comprehensive README with installation instructions and usage examples
- MIT License file
- Third-party licenses documentation
- Security vulnerability reporting guidelines

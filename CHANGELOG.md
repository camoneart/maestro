# Changelog

## 2.0.0

### Major Changes

- # 🎼 Maestro 2.0.0 - Complete Rebrand from Shadow Clone Jutsu

  This is a **major release** that completely rebrands the project from "shadow-clone-jutsu" to "Maestro" with a conductor/orchestra theme.

  ## 🚨 Breaking Changes

  ### Package & Command Changes
  - **Package name**: `shadow-clone-jutsu` → `maestro`
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
     npm install -g maestro
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
- **BREAKING**: Changed package name from `shadow-clone-jutsu` to `maestro`
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

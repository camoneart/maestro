# Changelog

## 3.5.5

### Patch Changes

- fix: tmuxペインタイトル設定とフォーカス位置のバグ修正

  Properly set unified branch name titles for all tmux panes and ensure focus is correctly set to the first pane (top-left).

  **Fixed:**
  - Use correct tmux pane specification format `sessionName:0.paneIndex` instead of `sessionName:paneIndex`
  - All panes now properly display the branch name as their title
  - Focus is correctly set to the first pane (0.0) after pane creation
  - Both new session and inside-tmux scenarios work correctly

  **Changes:**
  - Fixed `setTitleForAllPanes` function to use correct pane targeting format
  - Fixed `handleNewSessionPaneSplit` to focus on `sessionName:0.0` instead of `sessionName:0`
  - Added comprehensive tests for pane title and focus behavior

  Fixes #167, #169

## 3.5.4

### Patch Changes

- fix: Set unified branch name titles for all tmux panes

  When creating multiple tmux panes with options like `--tmux-h-panes` or `--tmux-v-panes`, all panes now display the branch name as their title instead of only the last pane. This provides better visual consistency and makes it easier to identify which worktree you're working in across all panes.

  Fixes #165

## 3.5.3

### Patch Changes

- fix: Complete elimination of duplicate error messages

  Removes the final redundant error display in executeCreateCommand that was causing
  triple error messages when tmux operations failed. Now shows clean, single error
  messages as intended.

  **Fixed behavior:**
  - Error messages now display only twice instead of three times
  - Eliminated redundant error output in CLI error handling
  - Cleaner error experience for users

  Completes fix for #163
  EOF < /dev/null

## 3.5.2

### Patch Changes

- fix: Reduce duplicate error messages in tmux pane creation

  When tmux pane creation fails due to insufficient screen space or other errors, the error message was displayed multiple times at different levels of the error handling chain. This fix consolidates error display to show clear, single error messages.

  **Fixed behavior:**
  - Error messages are now displayed once instead of 2-3 times
  - Better error handling hierarchy prevents redundant spinner failures
  - Cleaner user experience when tmux operations fail

  Fixes #163
  EOF < /dev/null

## 3.5.1

### Patch Changes

- feat: Add multi-pane support for tmux options (#157)
  - Added `--tmux-h-panes <number>` and `--tmux-v-panes <number>` options for creating multiple tmux panes
  - Added `--tmux-layout <type>` option for applying tmux layout (even-horizontal, even-vertical, main-horizontal, main-vertical, tiled)
  - Improved tmux integration with automatic layout application for optimal space usage

  fix: Improve tmux pane creation error handling (#161)
  - Enhanced error messages when tmux pane creation fails due to insufficient screen space
  - Better user feedback with specific guidance on resolution (e.g., "画面サイズに対してペイン数が多すぎます")

  fix: Lazy initialization for tmux helper to resolve path resolution issues (#162)
  - Fixed issue where CLI commands failed when run from directories outside the maestro project root
  - Tmux helper path is now resolved only when tmux features are actually used
  - Non-tmux commands (like `config init`) now work correctly from any directory

  Fixes #159, #160
  EOF < /dev/null

## 3.5.0

### Minor Changes

- feat: Add CLI configuration commands (set/get/reset)

  **New Commands:**
  - `mst config get <key>` - Get configuration value using dot notation
  - `mst config set <key> <value>` - Set configuration value using dot notation
  - `mst config reset <key>` - Reset configuration value to default

  **Features:**
  - Dot notation support for nested configurations (e.g., `ui.pathDisplay`)
  - Automatic type conversion for boolean and number values
  - Schema validation ensures only valid configurations are saved
  - Auto-creates `.maestro.json` if it doesn't exist
  - Removes empty nested objects after reset operations

  **Examples:**

  ```bash
  mst config set ui.pathDisplay relative
  mst config set development.autoSetup false
  mst config get worktrees.path
  mst config reset ui.pathDisplay
  ```

  Fixes #152

## 3.4.0

### Minor Changes

- feat: Add configurable path display format (absolute/relative)

  **New Feature:**
  - Added `ui.pathDisplay` configuration option in `.maestro.json`
  - Choose between `"absolute"` (default) or `"relative"` path display
  - Affects path display across all major commands

  **Affected Commands:**
  - `mst create` - Creation confirmation message
  - `mst list` - Worktree listing (respects configuration)
  - `mst where` - Current location display
  - `mst delete` - Deletion confirmation
  - `mst sync` - Sync target selection

  **Configuration Example:**

  ```json
  {
    "ui": {
      "pathDisplay": "relative" // or "absolute"
    }
  }
  ```

  **Benefits:**
  - Consistent path display across all commands
  - User preference for compact (relative) or explicit (absolute) paths
  - Better integration with different workflow preferences

  Fixes #150

## 3.3.5

### Patch Changes

- 🐛 Fix: Inquirer prompt fails due to Promise.allSettled conflict (Issue #148)

  **What was fixed:**
  - Separated tmux session creation from parallel task execution in `executePostCreationTasks`
  - Added TTY environment check before showing interactive prompts
  - Non-TTY environments now skip prompts and show manual attach instructions

  **Technical details:**
  - Interactive tmux confirmation prompts were conflicting with concurrent Promise execution
  - Now executes non-interactive tasks (setup, editor, CLAUDE.md) in parallel first
  - Then runs tmux session creation separately to avoid stdin/stdout conflicts
  - Prevents "User force closed the prompt" errors in inquirer

  **User impact:**
  - Interactive tmux attach confirmation now works reliably
  - Non-TTY environments (CI, scripts) gracefully skip prompts
  - Better user experience with proper prompt handling

  Fixes #148

## 3.3.4

### Patch Changes

- Use existing shell script helper for tmux auto-attach TTY fix

  **Fixed:**
  - 🚀 Integrated existing `scripts/maestro-tmux-attach` shell script that uses proper `exec()` system call
  - 🛠️ Resolved persistent TTY corruption when using `--tmux`, `--tmux-h`, `--tmux-v` options
  - ✨ Proper process replacement ensures tmux gets full TTY control
  - 🎯 No more keyboard input corruption or terminal breakage after detach

  **Technical Details:**
  - Utilizes shell's `exec` command for true process replacement
  - Avoids Node.js process lingering and competing for TTY control
  - Works immediately without requiring C compilation

  Fixes #142

## 3.3.3

### Patch Changes

- Critical fixes for tmux TTY corruption and spinner hanging issues

  **Fixed:**
  - 🚨 Resolved severe TTY corruption when using tmux auto-attach options (`--tmux`, `--tmux-h`, `--tmux-v`)
  - 🐛 Fixed spinner hanging indefinitely when specifying non-existent issue/PR numbers
  - 🔧 Improved tmux session environment handling with proper PATH configuration
  - 🛡️ Added maestro-exec helper for proper process replacement in tmux attach

  **Impact:**
  These fixes resolve critical issues that made tmux integration features unusable and could leave terminals in a corrupted state requiring restart.

## 3.3.2

### Patch Changes

- fix: tmux session attachment issues
  - Fixed tmux auto-attach breaking terminal input handling by using spawn instead of execa for proper TTY handling (#130)
  - Fixed custom PS1 not being applied in tmux sessions by using login shell (#128)
  - Added dedicated `attachToTmuxSession` and `switchTmuxClient` functions to handle TTY correctly
  - Resolved issue where Ctrl+C would terminate the mst process instead of being handled by tmux
  - Ensured tmux key bindings work properly after auto-attach

## 3.3.1

### Patch Changes

- Fix worktree self-deletion causing ENOENT error

  Resolves issue where attempting to delete a worktree from within the worktree directory itself would cause a `spawn git ENOENT` error and leave the system in an inconsistent state (directory deleted but branch remaining).

  **Changes:**
  - Added validation to prevent worktree self-deletion attempts
  - Enhanced error messages with clear guidance for correct usage
  - Added comprehensive test coverage for directory validation scenarios

  **Fixed behavior:**
  - Users are now warned when trying to delete a worktree from within itself
  - Proper error message guides users to run the command from outside the worktree
  - Prevents system inconsistency and manual cleanup requirements

  Fixes #126

## 3.3.0

### Minor Changes

- Add automatic tmux session cleanup when deleting worktrees

  ### New Features
  - **Automatic tmux session cleanup**
    - `mst delete` now automatically removes associated tmux sessions
    - Prevents accumulation of orphaned tmux sessions
    - Improves system resource management

  ### Options
  - **--keep-session flag**
    - Use `mst delete <branch> --keep-session` to preserve tmux session
    - Maintains backward compatibility for users who want to keep sessions

  ### Benefits
  - Eliminates manual tmux session cleanup
  - Prevents "duplicate session" errors on recreation
  - Reduces memory usage from orphaned sessions
  - Provides consistent worktree lifecycle management

  Resolves: #122

## 3.2.1

### Patch Changes

- Improve README documentation with update commands and enhanced content

  ### Documentation Improvements
  - **Add comprehensive "Updating" section**
    - Homebrew: `brew upgrade camoneart/tap/maestro`
    - npm: `npm update -g @camoneart/maestro`
    - pnpm: `pnpm update -g @camoneart/maestro`
  - **Add "Requirements" section with detailed dependency table**
    - Node.js >=20.0.0, Git >=2.22 requirements
    - Optional tools: tmux, fzf, GitHub CLI with install commands
  - **Add status badges**
    - CI workflow badge
    - Coverage status badge (≥80%)
  - **Enhance visual presentation**
    - Demo animation placeholder
    - Updated table of contents
    - Consistent formatting across README.md and README.ja.md

  ### Why This Matters
  - Users can now easily find update commands for their installation method
  - Professional documentation follows CLI tool best practices
  - Reduces support questions about "how to update"
  - Improves first-time user experience with clear requirements

## 3.2.0

### Minor Changes

- Enhance tmux integration and improve documentation

  ### New Features
  - **Auto-attach to tmux session when using --tmux-h/--tmux-v from terminal**
    - Now `--tmux-h` and `--tmux-v` options work consistently with `--tmux`
    - When run from terminal, automatically creates and attaches to tmux session
    - Maintains existing behavior when run inside tmux (pane splitting with auto-focus)
    - Resolves UX inconsistency where users had to manually start tmux sessions

  ### Documentation Improvements
  - **Add comprehensive documentation for claude.markdownMode configuration**
    - Added detailed explanation of `"shared"` vs `"split"` modes
    - Updated README.md and README.ja.md with configuration table
    - Enhanced docs/COMMANDS.md with practical examples
    - Improved docs/commands/create.md with detailed usage scenarios

  ### Technical Details
  - Enhanced tmux session management logic to detect terminal vs tmux execution context
  - Improved command consistency across all `--tmux*` options
  - Better error handling for tmux session creation and attachment

## 3.1.0

### Minor Changes

- Add tmux auto-focus and refactor --claude option to --claude-md

  ### New Features
  - **Auto-focus to new pane when using --tmux-h/--tmux-v options**
    - New tmux panes now automatically receive focus after creation
    - Eliminates manual pane switching for immediate development workflow
    - Uses `tmux select-pane -l` to focus the last created pane
    - Fixes #105
  - **Simplified --claude option to --claude-md**
    - Renamed `--claude` to `--claude-md` for clearer purpose indication
    - Focuses specifically on CLAUDE.md file management
    - Removed non-functional autoStart and initialCommands features
    - Simplified configuration and reduced complexity
    - Fixes #112

  ### Improvements
  - Streamlined tmux workflow with seamless pane focus management
  - Better semantic naming for Claude Code integration options
  - Reduced configuration complexity for better maintainability

## 3.0.1

### Patch Changes

- Fix EEXIST error when using --claude option with existing CLAUDE.md

  Resolves issue where `mst create <branch> --claude` would fail with EEXIST error when CLAUDE.md already exists in the worktree. Git worktree creation automatically copies all files from the root directory, including CLAUDE.md, but the --claude option was attempting to create a symlink without removing the existing file first.

  Changes:
  - Delete existing CLAUDE.md in worktree before creating symlink in shared mode
  - Add graceful error handling for cases where the file doesn't exist
  - Include comprehensive test coverage for the fix

  Fixes #106

## 3.0.0

### Major Changes

- [#108](https://github.com/camoneart/maestro/pull/108) [`3684416`](https://github.com/camoneart/maestro/commit/368441684d5dbdb4e4630eec9d6d827738dc8e50) Thanks [@camoneart](https://github.com/camoneart)! - Remove non-functional `mst claude` command

  The `mst claude` command has been removed due to fundamental design issues:
  - Claude Code is an interactive CLI tool that cannot run as a background process
  - The "start/stop" concept is not applicable to Claude Code
  - Commands appeared to work but were actually non-functional

  **Breaking Change**: The `mst claude` command and its subcommands (`start`, `stop`, `list`) are no longer available.

  **Migration**: Use the `claude` command directly in your worktrees. The `--claude-md` option for `mst create` remains available for CLAUDE.md generation.

## 2.7.4

### Patch Changes

- Fix critical bug in delete command
  - #98 365842c Thanks @camoneart! - Ensure local branch is deleted when removing worktree

## 2.7.3

### Patch Changes

- Fix bugs and improve user experience
  - #91 932a35a Thanks @camoneart! - Add confirmation prompt after fzf selection for better UX
  - #92 077a70e Thanks @camoneart! - Update README files to reflect v2.7.0+ changes (removed commands, new features)
  - 02571d7 Thanks @camoneart! - Improve spinner text from '初期化中...' to '準備中...' for better UX

## 2.7.2

### Patch Changes

- Fix repository maintenance issues and update dependencies
  - Remove gitignored \_docs directory from repository (#88)
  - Remove caret from @types/node version for consistency (#87)
  - Update dependencies to latest versions (Issue #84) (#85)

## 2.7.1

### Patch Changes

- Fix multiple critical bugs affecting core functionality
  - Fix exec command -a flag not working across all worktrees (Issue #72)
  - Fix sync command failing with worktree filters (Issue #73)
  - Fix github list command undefined property errors (Issue #74)
  - Fix graph command stack overflow from circular dependencies (Issue #75)
  - Fix mcp serve module resolution errors (Issue #76)

## 2.7.0

### Minor Changes

- ### 💥 Breaking Changes
  - Worktrees are now created outside the `.git` directory by default (Issue #67)
    - Old: `.git/orchestrations/feature/branch-name`
    - New: `../branch-name` (sibling to main repository)
  - Removed hardcoded `maestro-` prefix for worktree directories (Issue #69)
    - Now configurable via `directoryPrefix` setting (default: empty string)

  ### 🚀 New Features
  - Add `mst push --draft-pr` option to create draft pull requests
  - Add configurable `directoryPrefix` for worktree directory names

  ### 🐛 Bug Fixes
  - Fix gitignore auto-addition bug (Issue #62, #64)
  - Add `.maestro-metadata.json` to repository .gitignore (Issue #66)
  - Remove default branch prefix to allow flexible branch naming
  - Remove legacy path config from .maestro.json

  ### 📝 Notes
  - Existing worktrees inside `.git/` will need to be manually recreated
  - Update your `.maestro.json` if you have custom `path` settings
  - This release follows Git's standard worktree conventions

## 2.6.3

### Patch Changes

- fix: improve create command package manager detection and gitignore handling
  - Automatically detect project package manager (pnpm/npm/yarn) instead of hardcoding npm
  - Auto-add .maestro-metadata.json to .gitignore in worktrees
  - Add comprehensive documentation for 13 missing commands
  - Improve CI Prettier configuration and Claude Code settings

## 2.6.2

### Patch Changes

- fix: improve error messages when copying optional files like .env

## 2.6.1

### Patch Changes

- fix: サブworktreeからのworktree作成時のパス解決エラーを修正
  - createWorktreeとattachWorktreeメソッドで相対パスの代わりに絶対パスを使用
  - getRepositoryRoot()を使用してリポジトリルートからの絶対パスを生成
  - これによりどのworktreeから実行してもworktree作成が可能に

  Fixes: サブworktree内で'mst create'実行時の'Not a directory'エラー

## 2.6.0

### Minor Changes

- feat: implement `mst init` command for project setup
  - Add interactive project setup command with smart detection
  - Auto-detect project types (React, Next.js, Vue.js, Python, Go)
  - Auto-detect package managers (pnpm, npm, yarn) from lockfiles
  - Support multiple execution modes (--minimal, --yes, --package-manager)
  - Generate appropriate configuration based on project type
  - Include comprehensive test coverage and documentation

## 2.5.0

### Minor Changes

- feat: add advanced worktree management features
  - Add `claude` command for managing multiple Claude Code instances
    - `mst claude list` - List running Claude Code instances
    - `mst claude start [branch]` - Start Claude Code for a worktree
    - `mst claude stop [branch]` - Stop Claude Code for a worktree
    - Supports `--all` option to manage all instances at once
  - Enhance `--copy-file` option to handle gitignored files
    - Automatically detects and copies gitignored files (like .env)
    - Shows which files are gitignored in the output
  - Add automatic setup commands execution from config
    - New `postCreate` config section in `.maestro.json`
    - `postCreate.copyFiles` - Files to copy automatically
    - `postCreate.commands` - Commands to run after creation
    - Enables workflow automation like dependency installation

## 2.4.0

### Minor Changes

- feat: implement new command options for improved workflow
  - Add --fzf option to exec and shell commands for interactive selection
  - Add tmux integration options (--tmux, --tmux-v, --tmux-h) to exec, shell, and github commands
  - Add --names option to list command for scripting-friendly output
  - Create shared utilities for tmux and fzf operations

## 2.3.0

### Minor Changes

- [#36](https://github.com/camoneart/maestro/pull/36) [`2f43ca5`](https://github.com/camoneart/maestro/commit/2f43ca554aeee7d112779e77e2f814ab92e67006) Thanks [@camoneart](https://github.com/camoneart)! - Add new options to create command and implement attach command
  - Add `--shell` option to create command: enter shell after creating worktree
  - Add `--exec <command>` option to create command: execute command after creating worktree
  - Add `--copy-file <file>` option to create command: copy files from current worktree
  - Implement new `attach` command: create worktree for existing branches
  - Add `--shell` and `--exec` options to attach command
  - Set MAESTRO environment variables when entering shell sessions

## 2.2.1

### Patch Changes

- [`4280a19`](https://github.com/camoneart/maestro/commit/4280a19) Thanks [@camoneart](https://github.com/camoneart)! - fix: resolve worktree branch name matching in delete command

  Fixed an issue where the `mst delete` command would fail with "ワークツリー 'refs/heads/branch-name' が見つかりません" error. The issue occurred because the delete command was passing branch names with the `refs/heads/` prefix to the GitWorktreeManager, which expects clean branch names.

## 2.2.0

### Minor Changes

- [`7a3c70d`](https://github.com/camoneart/maestro/commit/7a3c70d6f76aaa5c9ef103b2973622ff7235a89e) Thanks [@camoneart](https://github.com/camoneart)! - feat: Add tmux pane split functionality
  - Add `--tmux-h` option for horizontal pane split (side by side)
  - Add `--tmux-v` option for vertical pane split (top and bottom)
  - Automatically execute Claude commands in new panes when `--claude` is used
  - Set up tmux status line to show current Git branch
  - Display branch names as pane titles

  This feature brings a Phantom-like development experience to Maestro, allowing developers to maintain their current context while creating new worktrees in split panes within the same tmux window.

## 2.1.1

### Patch Changes

- [`ed0a0ff`](https://github.com/camoneart/maestro/commit/ed0a0ff2fc1b97f3e2a8f8a7f0a62a1d5937ecff) Thanks [@camoneart](https://github.com/camoneart)! - feat(list): Add relative path display for better readability
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
  - **Package name**: `shadow-clone-jutsu` → `@camoneart/maestro`
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
     npm install -g @camoneart/maestro
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

  For more details, see the [migration guide](https://github.com/camoneart/maestro/wiki/migration-guide).

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING**: Rebranded from "shadow-clone-jutsu" to "Maestro" with conductor/orchestra theme
- **BREAKING**: Changed package name from `shadow-clone-jutsu` to `@camoneart/maestro`
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

- [`4fcf9d1`](https://github.com/camoneart/maestro/commit/4fcf9d1740864bc7d860cf32650cafde36f742e3) Thanks [@camoneart](https://github.com/camoneart)! - Test automatic versioning and release workflow setup

## [1.0.0] - 2025-07-15

### Added

- 🥷 影分身の術（Git worktree）CLIツール初回リリース
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

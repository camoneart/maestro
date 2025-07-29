# Maestro

[![Node.js >=20.0.0](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-45CC11?labelColor=555555&style=flat&logoColor=FFFFFF)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/@camoneart/maestro?color=007EC5&labelColor=555555&style=flat&logoColor=FFFFFF)](https://www.npmjs.com/package/@camoneart/maestro)
[![License MIT](https://img.shields.io/badge/License-MIT-yellow?labelColor=555555&style=flat)](https://opensource.org/licenses/MIT)

![maestro](public/image/logo/maestro-logo.png)
**A CLI tool that “conducts” Git worktrees like an orchestra and turbo-charges parallel development with Claude Code.**

![Demo Animation](https://via.placeholder.com/800x400/2D3748/FFFFFF?text=Demo+Animation+Coming+Soon)

**English** | **[日本語](/README.ja.md)**

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Installation](#installation)
- [Updating](#updating)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Command Reference](#command-reference)
- [Advanced Features](#advanced-features)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

Maestro is a CLI that makes Git worktree management intuitive. When working on multiple branches in parallel you can treat each branch as an independent “orchestra member” without changing directories.

### Why Maestro?

| Pain Point                                                                                      | Maestro’s Approach                                                           | Benefit                                               |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Inefficient parallel development**<br>Frequent branch switches, stashes and context switching | **Automatic Worktree management**<br>Each feature lives in its own directory | Zero branch-switch cost, smooth multitasking          |
| **Hard to keep track of tasks**                                                                 | **CLI list & status**<br>Visualise all performers (worktrees)                | Instantly know where you are and the current progress |
| **Heavy review / merge workload**                                                               | **Claude Code integration**<br>AI diff reviews & automated PR flow           | Drastically reduces review time                       |

## Key Features

| Feature                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| 🎼 **Orchestra UI**       | Operate worktrees as performers in an intuitive way |
| 🤖 **Claude AI**          | AI diff reviews & code suggestions                  |
| 🔗 **GitHub integration** | Generate worktrees from Issues / PRs                |
| 🎯 **tmux / fzf**         | Keyboard-only, lightning-fast switching             |
| 📊 **Status**             | Real-time worktree status and health monitoring     |
| 🔄 **Auto Sync**          | Propagate file changes in real time                 |
| 📸 **Snapshot**           | Save / restore any state with one command           |
| 🏥 **Health Check**       | Detect & auto-fix orphaned / conflicting branches   |

## Installation

### Homebrew (recommended)

```bash
brew install camoneart/tap/maestro
```

- Homebrew installs completion scripts for **zsh / fish / bash** automatically.<br>
- For bash you also need `brew install bash-completion@2`. See [Shell Completion](#shell-completion).

### npm

```bash
npm install -g @camoneart/maestro
```

### pnpm

```bash
# If pnpm is not installed yet
npm install -g pnpm

pnpm add -g @camoneart/maestro
```

## Updating

### Homebrew

```bash
brew upgrade camoneart/tap/maestro
```

### npm

```bash
npm update -g @camoneart/maestro
```

### pnpm

```bash
pnpm update -g @camoneart/maestro
```

## Requirements

| Requirement | Version | Purpose | Install Command |
|-------------|---------|---------|-----------------|
| **Node.js** | >=20.0.0 | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **Git** | >=2.22 | Worktree support | `brew install git` |
| **tmux** (optional) | Any | Session management | `brew install tmux` |
| **fzf** (optional) | Any | Fuzzy finding | `brew install fzf` |
| **GitHub CLI** (optional) | Any | GitHub integration | `brew install gh` |

## Quick Start

```bash
# 1. Install (Homebrew example)
brew install camoneart/tap/maestro

# 2. Move to your Git project
cd ~/path/to/your-repo

# 2.5. Initialize maestro for your project (NEW!)
mst init                                      # Interactive setup
# or: mst init --yes                          # Quick setup with defaults

# 3. Create a performer (worktree)
mst create feature/awesome-feature            # create only

# 4. Jump into the performer’s shell
mst shell feature/awesome-feature             # open a shell inside

# ── one-liner (tmux + Claude) ──
# Create the worktree, prompt for tmux session attachment, and set up Claude Code workspace
mst create feature/awesome-feature --tmux --claude-md
```

#### Tips

- `mst shell <branch>` lets you enter any performer after creation (fzf prompt when omitted).
- `--tmux` creates a dedicated tmux session and prompts for attachment (automatically attaches in non-TTY environments); combine with `--claude-md` to set up Claude Code workspace files.
- `--tmux-h`/`--tmux-v` splits the current tmux pane horizontally/vertically with improved focus management (focuses first pane) and unified pane titles.
- `--tmux-h-panes <number>`/`--tmux-v-panes <number>` creates multiple horizontal/vertical panes with specified count, all displaying consistent branch name titles.
- `--tmux-layout <type>` applies specific tmux layout (even-horizontal, even-vertical, main-horizontal, main-vertical, tiled).

### Basic Usage Examples

| Goal                              | Command Example                                                              |
| --------------------------------- | ---------------------------------------------------------------------------- |
| **Parallel dev** Feature + bugfix | `mst create feature/auth --tmux --claude-md`<br>`mst create bugfix/login-issue` |
| **List performers**               | `mst list`                                                                   |
| **Fast switch** via tmux          | `mst tmux`                                                                   |
| **Create from GitHub Issue**      | `mst create 123`                                                             |
| **Create from PR**                | `mst github checkout 456`                                                    |
| **List GitHub issues/PRs**        | `mst github list`                                                            |
| **Push with PR**                  | `mst push --pr`                                                              |
| **Push with draft PR**            | `mst push --draft-pr`                                                        |
| **Auto review & merge**           | `mst review --auto-flow`                                                     |

## Command Reference

See the full [Command Reference](./docs/COMMANDS.md).

### Main Commands

| Command     | Description                  | Example                        |
| ----------- | ---------------------------- | ------------------------------ |
| `init`      | Initialize project config    | `mst init --yes`               |
| `create`    | Create a new worktree        | `mst create feature/login`     |
| `list`      | List worktrees               | `mst list`                     |
| `delete`    | Delete worktree, branch & tmux session | `mst delete feature/old --keep-session` |
| `tmux`      | Open in tmux                 | `mst tmux`                     |
| `sync`      | Real-time file sync          | `mst sync --auto`              |
| `push`      | Push and create PR           | `mst push --pr`                |
| `github`    | GitHub integration           | `mst github checkout 123`      |
| `health`    | Health check                 | `mst health --fix`             |
| `where`     | Show current performer       | `mst where`                    |

All sub-commands and options are documented in the [Command Reference](./docs/COMMANDS.md).

#### One-line Cheat Sheet

```bash
mst create feature/my-ui --tmux --claude-md   # create + AI + tmux
mst create feature/api --tmux-h-panes 3       # create + 3 horizontal panes (unified titles)
mst create feature/tdd --tmux-h-panes 4 --tmux-layout tiled  # 4-pane grid layout
mst list                                       # list performers
mst tmux                                       # switch via fzf
mst push --pr                                  # push with PR
mst review --auto-flow                         # auto review & merge
```

## Advanced Features

Maestro ships with **power commands** that automate tedious tasks in a single line.

| Feature                     | Command Example                                                       | What It Automates                                                           |
| --------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Auto Review & Merge 🚀**  | `mst review --auto-flow`                                              | Fetch → rebase → AI review → Conventional Commit → open PR — all in one go  |
| **GitHub Integration 🔗**   | `mst github list` <br>`mst github checkout 123`                       | List and checkout GitHub issues/PRs, automate repository workflows         |
| **Snapshot 📸**             | `mst snapshot -m "before-refactor"` <br>`mst snapshot --restore <id>` | Save / restore any working state instantly                                  |
| **Health Check 🏥**         | `mst health` <br>`mst health --fix`                                   | Detects stale / orphaned / conflicted branches and fixes them automatically |

Need more? Run `mst <command> --help`.

## Configuration

### 📁 Project Configuration `.maestro.json`

Maestro reads **`.maestro.json` at the project root** to customise behaviour.<br>
Key settings are summarised below; a full example follows.

### ⚙️ Configuration Management

Maestro provides commands to manage configuration settings using dot notation:

```bash
# Get configuration values
mst config get ui.pathDisplay                      # Get path display setting
mst config get development.autoSetup               # Get auto-setup setting

# Set configuration values  
mst config set ui.pathDisplay relative             # Auto-detects as user setting
mst config set --user ui.pathDisplay relative     # Explicitly save to user settings
mst config set --project worktrees.path "../"     # Explicitly save to project settings
mst config set development.defaultEditor cursor    # Set default editor (user setting)

# Reset to defaults
mst config reset ui.pathDisplay                    # Reset path display to default
mst config reset development.autoSetup             # Reset auto-setup to default

# View and manage configuration files
mst config show                                    # Show current effective config
mst config path                                    # Show config file locations
mst config init                                    # Create project configuration
```

**Claude Configuration:**
- `markdownMode: "shared"` - Creates symlink to main repository's CLAUDE.md (default)
- `markdownMode: "split"` - Creates independent CLAUDE.md for each worktree

| Category    | Key            | Purpose                               | Default / Example                   |
| ----------- | -------------- | ------------------------------------- | ----------------------------------- |
| worktrees   | `path`         | Where to store performers             | `../maestro-{branch}`               |
|             | `directoryPrefix` | Prefix for worktree directories    | `""` (empty string)                 |
|             | `branchPrefix` | Prefix for new branches               | `feature/`                          |
| development | `autoSetup`    | Auto-run `npm install` after `create` | `true`                              |
|             | `syncFiles`    | Files to sync across worktrees        | `[".env", ".env.local"]`            |
|             | `defaultEditor`| Default editor for opening            | `cursor`                            |
| tmux        | `enabled`      | Enable tmux integration               | `false`                             |
|             | `openIn`       | Open in window or pane                | `window` (`window` or `pane`)       |
|             | `sessionNaming`| Session naming pattern                | `{branch}`                          |
| claude      | `markdownMode` | CLAUDE.md file management mode        | `shared` (`shared` or `split`)      |
| github      | `autoFetch`    | Auto-fetch before operations          | `true`                              |
|             | `branchNaming.prTemplate` | PR branch naming template    | `pr-{number}`                       |
|             | `branchNaming.issueTemplate` | Issue branch naming template | `issue-{number}`                 |
| ui          | `pathDisplay`  | Path display format across commands   | `absolute` (`absolute` or `relative`) |
| hooks       | `afterCreate`  | Command after creation                | `npm install`                       |
|             | `beforeDelete` | Command before deletion               | `echo "Deleting $ORCHESTRA_MEMBER"` |

#### Full Example with Default Values

```json
{
  "worktrees": {
    "path": "../maestro-{branch}",     // Default: "../maestro-{branch}"
    "directoryPrefix": "",              // Default: "" (empty string)
    "branchPrefix": "feature/"          // Custom prefix for new branches
  },
  "development": {
    "autoSetup": true,                  // Default: true
    "syncFiles": [".env", ".env.local"], // Default: [".env", ".env.local"]
    "defaultEditor": "cursor"           // Default: "cursor"
  },
  "tmux": {
    "enabled": false,                   // Default: false
    "openIn": "window",                 // Default: "window" (options: "window" | "pane")
    "sessionNaming": "{branch}"         // Default: "{branch}"
  },
  "claude": {
    "markdownMode": "shared"            // Default: "shared" (options: "shared" | "split")
  },
  "github": {
    "autoFetch": true,                  // Default: true
    "branchNaming": {
      "prTemplate": "pr-{number}",       // Default: "pr-{number}"
      "issueTemplate": "issue-{number}"  // Default: "issue-{number}"
    }
  },
  "ui": {
    "pathDisplay": "absolute"           // Default: "absolute" (options: "absolute" | "relative")
  },
  "hooks": {
    "afterCreate": "npm install",
    "beforeDelete": "echo \"Deleting performer: $ORCHESTRA_MEMBER\""
  }
}
```

### 🤖 MCP Integration Setup

Add the following to your Claude Code config (`.claude/mcp_settings.json`):

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

### 🐚 Shell Completion

Maestro provides completion scripts for **bash / zsh / fish**.

| Install Method | bash                                     | zsh / fish     |
| -------------- | ---------------------------------------- | -------------- |
| Homebrew       | Auto (bash requires `bash-completion@2`) | Auto           |
| npm / pnpm     | Manual (below)                           | Manual (below) |

#### bash manual setup (npm / pnpm installs)

```bash
brew install bash-completion@2  # if not installed

echo 'eval "$(mst completion bash)"' >> ~/.bashrc
source ~/.bashrc
```

#### zsh manual setup

```bash
mkdir -p ~/.zsh/completions
mst completion zsh > ~/.zsh/completions/_mst
autoload -U compinit && compinit
```

#### fish manual setup

```bash
mst completion fish > ~/.config/fish/completions/mst.fish
```

## Troubleshooting

### ❓ Common Errors and Fixes

| Error                                          | Likely Cause                            | One-line Fix                      |
| ---------------------------------------------- | --------------------------------------- | --------------------------------- |
| **Git is too old** <br>`fatal: unknown option` | Git < 2.22                              | `brew install git`                |
| **fzf not found**                              | fzf not installed                       | `brew install fzf`                |
| **tmux not found**                             | tmux not installed                      | `brew install tmux`               |
| **Claude Code won't start**                    | MCP server not running or port conflict | `mst mcp status` → `mst mcp stop` |
| **Too many tmux panes** <br>`画面サイズに対してペイン数（N個）が多すぎます` | Terminal window too small for requested panes | Resize window or use fewer panes |

### Other error codes

| Code         | Cause                  | Fix                                     |
| ------------ | ---------------------- | --------------------------------------- |
| `EADDRINUSE` | MCP server port in use | `mst mcp stop` to kill previous process |
| `ENOENT`     | Git binary not found   | Check PATH or reinstall Git             |

### ⚠️ tmux Multi-Pane Troubleshooting

When using multi-pane creation (`--tmux-h-panes` or `--tmux-v-panes`), you may encounter space limitations. The create command now provides enhanced error handling with user-friendly Japanese messages:

**Enhanced Error Messages**:
```bash
# New Japanese error message format:
Error: 画面サイズに対してペイン数（4個）が多すぎます。ターミナルウィンドウを大きくするか、ペイン数を減らしてください。（水平分割）

# Generic tmux error fallback:
Error: tmuxペインの作成に失敗しました: [specific error details]
```

**Quick Solutions**:
```bash
# If this fails due to terminal size:
mst create feature/api --tmux-h-panes 6

# Try reducing panes:
mst create feature/api --tmux-h-panes 3

# Or switch to vertical layout:
mst create feature/api --tmux-v-panes 4 --tmux-layout main-vertical

# Use space-efficient layouts:
mst create feature/api --tmux-h-panes 4 --tmux-layout tiled
```

**Terminal Size Guidelines**:
- **Small (80x24)**: 2-3 panes maximum
- **Medium (120x40)**: 4-6 panes optimal
- **Large (200x60+)**: 6+ panes supported

**Error Message Features**:
- Displays number of panes that couldn't be created
- Indicates split direction (水平分割 for horizontal, 垂直分割 for vertical)
- Provides actionable solutions directly in the error message

If the issue persists, search or open a new ticket in the [Issues](https://github.com/camoneart/maestro/issues).

### 🔍 Debug Mode

```bash
# Verbose logs to console
DEBUG=mst:* mst create feature/debug

# Save detailed logs to a file
DEBUG=mst:* mst review --auto-flow &> maestro-debug.log
```

## Contributing

### 🤝 Contribution Workflow

1. Open an [Issue](https://github.com/camoneart/maestro/issues) for bugs or feature requests.
2. Fork the repo and create a branch like `feat/your-topic`.
3. Run `pnpm lint && pnpm test` and make sure everything passes.
4. Commit with **Conventional Commits**.
5. Open a Pull Request and fill out the template.

See the [Contributing Guide](/CONTRIBUTING.md) and [Code of Conduct](/CODE_OF_CONDUCT.md) for details.

## License

Licensed under the [MIT License](./LICENSE).

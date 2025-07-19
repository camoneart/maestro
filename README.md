# Maestro

[![Node.js >=20.0.0](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-45CC11?labelColor=555555&style=flat&logoColor=FFFFFF)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/@hashiramaendure/maestro?color=007EC5&labelColor=555555&style=flat&logoColor=FFFFFF)](https://www.npmjs.com/package/@hashiramaendure/maestro)
[![License MIT](https://img.shields.io/badge/License-MIT-yellow?labelColor=555555&style=flat)](https://opensource.org/licenses/MIT)

![maestro](public/image/logo/maestro-logo.png)
**A CLI tool that “conducts” Git Worktrees like an orchestra and turbo-charges parallel development with Claude Code**

![Demo Animation]()

**English** | **[日本語](/README.ja.md)**

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Command Reference](#command-reference)
- [Advanced Features](#advanced-features)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

Maestro is a CLI that makes Git Worktree management intuitive. When working on multiple branches in parallel you can treat each branch as an independent “orchestra member” without changing directories.

### Why Maestro?

| Pain Point                                                                                      | Maestro’s Approach                                                           | Benefit                                               |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Inefficient parallel development**<br>Frequent branch switches, stashes and context switching | **Automatic Worktree management**<br>Each feature lives in its own directory | Zero branch-switch cost, smooth multitasking          |
| **Hard to keep track of tasks**                                                                 | **Dashboard & CLI list**<br>Visualise all performers (worktrees)             | Instantly know where you are and the current progress |
| **Heavy review / merge workload**                                                               | **Claude Code integration**<br>AI diff reviews & automated PR flow           | Drastically reduces review time                       |

## Key Features

| Feature                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| 🎼 **Orchestra UI**       | Operate worktrees as performers in an intuitive way |
| 🤖 **Claude AI**          | AI diff reviews & code suggestions                  |
| 🔗 **GitHub integration** | Generate worktrees from Issues / PRs                |
| 🎯 **tmux / fzf**         | Keyboard-only, lightning-fast switching             |
| 📊 **Dashboard**          | Visualise everything in a Web UI                    |
| 🔄 **Auto Sync**          | Propagate file changes in real time                 |
| 📸 **Snapshot**           | Save / restore any state with one command           |
| 🏥 **Health Check**       | Detect & auto-fix orphaned / conflicting branches   |

## Installation

### Homebrew (recommended)

```bash
brew install hashiramaendure/tap/maestro
```

> Homebrew installs completion scripts for **zsh / fish / bash** automatically.<br>
> For bash you also need `brew install bash-completion@2`. See [Shell Completion](#shell-completion).

### npm

```bash
npm install -g @hashiramaendure/maestro
```

### pnpm

```bash
# If pnpm is not installed yet
npm install -g pnpm

pnpm add -g @hashiramaendure/maestro
```

## Quick Start

```bash
# 1. Install (Homebrew example)
brew install hashiramaendure/tap/maestro

# 2. Move to your Git project
cd ~/path/to/your-repo

# 3. Create a worktree and drop into its shell
mst create feature/awesome-feature --shell
```

#### Tips

- `--shell` drops you into the performer immediately.
- Combine `--tmux --claude` to launch a tmux window and a Claude Code session automatically.

### Basic Usage Examples

| Goal                              | Command Example                                                              |
| --------------------------------- | ---------------------------------------------------------------------------- |
| **Parallel dev** Feature + bugfix | `mst create feature/auth --tmux --claude`<br>`mst create bugfix/login-issue` |
| **List performers**               | `mst list --details`                                                         |
| **Fast switch** via tmux          | `mst tmux`                                                                   |
| **Create from GitHub Issue**      | `mst create 123`                                                             |
| **Create from PR**                | `mst github pr 456`                                                          |
| **Auto draft PR**                 | `mst create feature/new-ui --draft-pr`                                       |
| **AI diff review**                | `mst suggest --review`                                                       |
| **Auto review & merge**           | `mst review --auto-flow`                                                     |

## Command Reference

See the full [Command Reference](./docs/COMMANDS.md).

### Main Commands

| Command     | Description                  | Example                        |
| ----------- | ---------------------------- | ------------------------------ |
| `create`    | Create a new worktree        | `mst create feature/login`     |
| `list`      | List worktrees               | `mst list --details`           |
| `delete`    | Delete worktree              | `mst delete feature/old --fzf` |
| `tmux`      | Open in tmux                 | `mst tmux`                     |
| `sync`      | Real-time file sync          | `mst sync --auto`              |
| `suggest`   | Claude suggestions / reviews | `mst suggest --review`         |
| `github`    | GitHub integration           | `mst github pr 123`            |
| `dashboard` | Launch Web dashboard         | `mst dashboard --open`         |
| `health`    | Health check                 | `mst health --fix`             |
| `where`     | Show current performer       | `mst where --verbose`          |

All sub-commands and options are documented in the [Command Reference](./docs/COMMANDS.md).

#### One-line Cheat Sheet

```bash
mst create feature/my-ui --tmux --claude   # create + AI + tmux
mst list                                   # list performers
mst tmux                                   # switch via fzf
mst suggest --branch                       # AI suggestions
mst review --auto-flow                     # auto review & merge
```

## Advanced Features

Maestro ships with **power commands** that automate tedious tasks in a single line.

| Feature                     | Command Example                                                       | What It Automates                                                           |
| --------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Auto Review & Merge 🚀**  | `mst review --auto-flow`                                              | Fetch → rebase → AI review → Conventional Commit → open PR — all in one go  |
| **Integrated Dashboard 📊** | `mst dashboard` <br>`mst dashboard --port 3000`                       | Real-time Web UI showing worktree state, GitHub status, health metrics      |
| **Snapshot 📸**             | `mst snapshot -m "before-refactor"` <br>`mst snapshot --restore <id>` | Save / restore any working state instantly                                  |
| **Health Check 🏥**         | `mst health` <br>`mst health --fix`                                   | Detects stale / orphaned / conflicted branches and fixes them automatically |

Need more? Run `mst <command> --help`.

## Configuration

### 📁 Project Configuration `.maestro.json`

Maestro reads **`.maestro.json` at the project root** to customise behaviour.<br>
Key settings are summarised below; a full example follows.

| Category    | Key            | Purpose                               | Default / Example                   |
| ----------- | -------------- | ------------------------------------- | ----------------------------------- |
| worktrees   | `path`         | Where to store performers             | `.git/orchestra-members`            |
|             | `branchPrefix` | Prefix for new branches               | `feature/`                          |
| development | `autoSetup`    | Auto-run `npm install` after `create` | `true`                              |
|             | `syncFiles`    | Files to sync across worktrees        | `[".env", ".env.local"]`            |
| hooks       | `afterCreate`  | Command after creation                | `npm install`                       |
|             | `beforeDelete` | Command before deletion               | `echo "Deleting $ORCHESTRA_MEMBER"` |
| claude      | `autoStart`    | Start Claude Code on enter            | `true`                              |

#### Full Example

```json
{
  "worktrees": {
    "path": ".git/orchestra-members",
    "branchPrefix": "feature/"
  },
  "development": {
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"],
    "defaultEditor": "cursor"
  },
  "hooks": {
    "afterCreate": "npm install",
    "beforeDelete": "echo \"Deleting performer: $ORCHESTRA_MEMBER\""
  },
  "claude": {
    "autoStart": true,
    "markdownMode": "shared",
    "initialCommands": ["/model sonnet-3.5"]
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

### Other error codes

| Code         | Cause                  | Fix                                     |
| ------------ | ---------------------- | --------------------------------------- |
| `EADDRINUSE` | MCP server port in use | `mst mcp stop` to kill previous process |
| `ENOENT`     | Git binary not found   | Check PATH or reinstall Git             |

If the issue persists, search or open a new ticket in the [Issues](https://github.com/hashiramaendure/maestro/issues).

### 🔍 Debug Mode

```bash
# Verbose logs to console
DEBUG=mst:* mst create feature/debug

# Save detailed logs to a file
DEBUG=mst:* mst review --auto-flow &> maestro-debug.log
```

## Contributing

### 🤝 Contribution Workflow

1. Open an [Issue](https://github.com/hashiramaendure/maestro/issues) for bugs or feature requests.
2. Fork the repo and create a branch like `feat/your-topic`.
3. Run `pnpm lint && pnpm test` and make sure everything passes.
4. Commit with **Conventional Commits**.
5. Open a Pull Request and fill out the template.

See the [Contributing Guide](/CONTRIBUTING.md) and [Code of Conduct](/CODE_OF_CONDUCT.md) for details.

## License

Licensed under the [MIT License](./LICENSE).

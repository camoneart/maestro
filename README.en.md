# 🎼 Maestro

**English** | **[日本語](/README.md)**

_Parallel Development CLI powered by Git Worktree Orchestration & Claude AI_

[![npm version](https://badge.fury.io/js/maestro.svg)](https://www.npmjs.com/package/maestro)
[![CI](https://github.com/hashiramaendure/maestro/actions/workflows/ci.yml/badge.svg)](https://github.com/hashiramaendure/maestro/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/hashiramaendure/maestro/branch/main/graph/badge.svg)](https://codecov.io/gh/hashiramaendure/maestro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Git Worktree Orchestration CLI Tool for Parallel Development with Claude Code**

![maestro](public/image/logo/maestro-logo.png)

![Demo Animation](https://via.placeholder.com/800x400/1a1a1a/00ff00?text=maestro+demo)

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Command Reference](#command-reference)
- [Advanced Features](#advanced-features)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

Maestro is a CLI tool that makes Git Worktree management more intuitive. When working on multiple branches in parallel, you can treat each branch as an independent "orchestra member" without switching directories.

### Why Maestro?

**Pain**: Traditional Git workflows involve frequent branch switching, stashing, and context switching when developing multiple features in parallel, significantly reducing development efficiency.

**Solution**: Maestro leverages Git Worktree to create each branch as an independent "performer", enabling complete parallel development and AI integration.

**Benefit**: Developers can work on multiple features simultaneously, with AI-driven development through Claude Code integration and perfect workflow efficiency through tmux/fzf integration.

## Key Features

| Feature | Description |
|---------|-------------|
| 🎼 **Conductor Theme** | Intuitive interface treating Worktrees as "orchestra members" |
| 🤖 **Claude Code Integration** | AI development assistance via MCP (Model Context Protocol) |
| 🔗 **GitHub Integration** | Create performers directly from PR/Issues |
| 🎯 **tmux/fzf Integration** | Efficient workflow |
| 🎨 **Interactive UI** | Beautiful and user-friendly CLI experience |
| 📊 **Dashboard** | Visualize everything with Web UI |
| 🔄 **Auto Sync** | Detect file changes and auto-sync |
| 📸 **Snapshot** | Save and restore work states |

## Installation

### Prerequisites

- **Node.js** >= 20.0.0
- **Git** >= 2.22.0
- **npm** or **pnpm** (recommended)

### Installation Methods

#### 🌟 Global Installation (Recommended)

```bash
# pnpm (recommended)
pnpm add -g maestro

# npm
npm install -g maestro

# yarn
yarn global add maestro
```

#### ⚡ One-shot Execution

```bash
# For trying out
npx maestro create feature/my-feature

# pnpm dlx also available
pnpm dlx maestro create feature/my-feature --tmux --claude --open
```

#### 🍺 Homebrew (macOS/Linux)

```bash
brew tap hashiramaendure/tap
brew install maestro
```

#### 🪟 Scoop (Windows)

```powershell
scoop bucket add hashiramaendure https://github.com/hashiramaendure/scoop-bucket
scoop install maestro
```

#### 📂 Install from Source

```bash
git clone https://github.com/hashiramaendure/maestro.git
cd maestro
pnpm install
pnpm run build
pnpm link
```

## Quick Start

### 🚀 Get Started in 3 Steps

```bash
# 1. Navigate to your project directory
cd your-git-project

# 2. Create a new performer (worktree)
mst create feature/awesome-feature

# 3. Start working in the created performer
mst shell feature/awesome-feature
```

### 📚 Basic Usage Examples

#### Parallel Development of Multiple Features

```bash
# Develop authentication feature (with Claude Code integration)
mst create feature/auth --tmux --claude

# Work on bug fixes in parallel
mst create bugfix/login-issue

# Check list of performers
mst list

# Quickly switch between performers
mst tmux
```

#### GitHub Integration

```bash
# Create Worktree from Issue
mst create 123  # Created as issue-123

# Create performer from PR
mst github pr 456

# Auto-create Draft PR
mst create feature/new-ui --draft-pr
```

#### Claude Code Integration

```bash
# Start development with Claude Code
mst create feature/ai-integration --tmux --claude

# Run AI diff review
mst suggest --review

# Auto review & merge flow
mst review --auto-flow
```

## Command Reference

For detailed command documentation, see [docs/COMMANDS.md](./docs/COMMANDS.md).

### 📊 Main Commands (Top 10)

| Command | Description | Example |
|---------|-------------|---------|
| `create` | Create new performer | `mst create feature/new --tmux --claude --open` |
| `list` | List performers | `mst list --details` |
| `delete` | Delete performer | `mst delete feature/old --fzf` |
| `tmux` | Open in tmux session | `mst tmux feature/new` |
| `sync` | File synchronization | `mst sync --auto` |
| `suggest` | AI suggestion feature | `mst suggest --branch --description "new feature"` |
| `github` | GitHub integration | `mst github --issue 123` |
| `dashboard` | Launch Web UI | `mst dashboard --open` |
| `health` | Health check | `mst health --fix` |
| `where` | Check current location | `mst where --verbose` |

### 🎯 Quick Reference

```bash
# Basic usage
mst create feature/awesome-feature
mst list
mst tmux feature/awesome-feature

# Full setup
mst create feature/full-setup --tmux --claude --open --setup

# AI suggestions
mst suggest --branch --description "user authentication feature"
mst suggest --commit --diff

# GitHub integration
mst github --issue 123
mst github --create-pr
```

## Advanced Features

### 🚀 Auto Review & Merge Flow

```bash
# Run auto flow
mst review --auto-flow
```

**Executed processes:**
1. ✅ `git fetch origin main && git rebase origin/main`
2. 🔧 On conflict: launch Claude Code with `claude /resolve-conflict`
3. 📝 Execute code review with `claude /review --diff origin/main`
4. 💬 Auto-generate Conventional Commit messages
5. 🚀 Create GitHub PR

### 📊 Integrated Dashboard

```bash
# Launch dashboard
mst dashboard

# Launch on custom port
mst dashboard --port 3000
```

**Dashboard features:**
- List all worktree states
- Visualize GitHub integration status
- Display health status
- Real-time updates (every 30 seconds)

### 📸 Snapshot Feature

```bash
# Create snapshot
mst snapshot -m "State before refactoring"

# Snapshot all worktrees
mst snapshot --all

# Restore from snapshot
mst snapshot --restore snapshot-xxxxx
```

### 🏥 Worktree Health Check

```bash
# Check health
mst health

# Auto-fix
mst health --fix

# Remove old worktrees (30+ days)
mst health --prune --days 30
```

**Detected issues:**
- 🕰️ `stale`: Not updated for long time
- 👻 `orphaned`: Remote branch doesn't exist
- 🌊 `diverged`: Significantly diverged from main branch
- 📝 `uncommitted`: Uncommitted changes
- ⚔️ `conflict`: Unresolved merge conflicts
- ❌ `missing`: Directory doesn't exist

## Configuration

### 📁 Project Configuration (.maestro.json)

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

Add to Claude Code configuration (`.claude/mcp_settings.json`):

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

#### Bash

```bash
mst completion bash >> ~/.bashrc
source ~/.bashrc
```

#### Zsh

```bash
mkdir -p ~/.zsh/completions
mst completion zsh > ~/.zsh/completions/_mst
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc
source ~/.zshrc
```

#### Fish

```bash
mst completion fish > ~/.config/fish/completions/mst.fish
```

## Troubleshooting

### ❓ Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Git version error | Update Git to 2.22.0 or later: `brew install git` |
| fzf not found | Install fzf: `brew install fzf` |
| tmux not found | Install tmux: `brew install tmux` |
| Claude Code not starting | Check MCP server configuration |

### 🔍 Debug Mode

```bash
# Show debug information
DEBUG=mst:* mst create feature/debug

# Output detailed logs
mst --verbose create feature/test
```

## Contributing

### 🤝 Contribution

Please report bugs and feature requests to [GitHub Issues](https://github.com/hashiramaendure/maestro/issues).

Pull requests are welcome!

### 📚 Related Documentation

- [Contributing Guidelines](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Changelog](./CHANGELOG.md)
- [License](./LICENSE)

### 🛠️ Development

```bash
# Clone repository
git clone https://github.com/hashiramaendure/maestro.git
cd maestro

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run tests
pnpm test

# Build
pnpm build
```

## License

Licensed under the [MIT License](./LICENSE).
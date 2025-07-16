# 🥷 shadow-clone-jutsu

**English** | **[日本語](/README.md)**

_Parallel Development CLI powered by Git Worktree & Claude AI_

[![npm version](https://badge.fury.io/js/shadow-clone-jutsu.svg)](https://www.npmjs.com/package/shadow-clone-jutsu)
[![CI](https://github.com/hashiramaendure/scj/actions/workflows/ci.yml/badge.svg)](https://github.com/hashiramaendure/scj/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/hashiramaendure/shadow-clone-jutsu/branch/main/graph/badge.svg)](https://codecov.io/gh/hashiramaendure/shadow-clone-jutsu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Shadow Clone Jutsu (Git Worktree) CLI Tool for Parallel Development with Claude Code**  
_Parallel Development CLI powered by Git Worktree & Claude AI_

![Demo Animation](https://via.placeholder.com/800x400/1a1a1a/00ff00?text=shadow-clone-jutsu+demo)

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

shadow-clone-jutsu is a CLI tool that makes Git Worktree management more intuitive. When working on multiple branches in parallel, you can treat each branch as an independent "shadow clone" without switching directories.

### Why shadow-clone-jutsu?

**Pain**: Traditional Git workflows involve frequent branch switching, stashing, and context switching when developing multiple features in parallel, significantly reducing development efficiency.

**Solution**: shadow-clone-jutsu leverages Git Worktree to create each branch as an independent "shadow clone", enabling complete parallel development and AI integration.

**Benefit**: Developers can work on multiple features simultaneously, with AI-driven development through Claude Code integration and perfect workflow efficiency through tmux/fzf integration.

## Key Features

| Feature | Description |
|---------|-------------|
| 🥷 **Ninja Theme** | Intuitive interface treating Worktrees as "shadow clones" |
| 🤖 **Claude Code Integration** | AI development assistance via MCP (Model Context Protocol) |
| 🔗 **GitHub Integration** | Create shadow clones directly from PR/Issues |
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
pnpm add -g shadow-clone-jutsu

# npm
npm install -g shadow-clone-jutsu

# yarn
yarn global add shadow-clone-jutsu
```

#### ⚡ One-shot Execution

```bash
# For trying out
npx shadow-clone-jutsu create feature/my-feature

# pnpm dlx also available
pnpm dlx shadow-clone-jutsu create feature/my-feature --tmux --claude --open
```

#### 🍺 Homebrew (macOS/Linux)

```bash
brew tap hashiramaendure/tap
brew install shadow-clone-jutsu
```

#### 🪟 Scoop (Windows)

```powershell
scoop bucket add hashiramaendure https://github.com/hashiramaendure/scoop-bucket
scoop install shadow-clone-jutsu
```

#### 📂 Install from Source

```bash
git clone https://github.com/hashiramaendure/scj.git
cd scj
pnpm install
pnpm run build
pnpm link
```

## Quick Start

### 🚀 Get Started in 3 Steps

```bash
# 1. Navigate to your project directory
cd your-git-project

# 2. Create a new shadow clone (worktree)
scj create feature/awesome-feature

# 3. Start working in the created shadow clone
scj shell feature/awesome-feature
```

### 📚 Basic Usage Examples

#### Parallel Development of Multiple Features

```bash
# Develop authentication feature (with Claude Code integration)
scj create feature/auth --tmux --claude

# Work on bug fixes in parallel
scj create bugfix/login-issue

# Check list of shadow clones
scj list

# Quickly switch between shadow clones
scj tmux
```

#### GitHub Integration

```bash
# Create Worktree from Issue
scj create 123  # Created as issue-123

# Create shadow clone from PR
scj github pr 456

# Auto-create Draft PR
scj create feature/new-ui --draft-pr
```

#### Claude Code Integration

```bash
# Start development with Claude Code
scj create feature/ai-integration --tmux --claude

# Run AI diff review
scj suggest --review

# Auto review & merge flow
scj review --auto-flow
```

## Command Reference

For detailed command documentation, see [docs/COMMANDS.md](./docs/COMMANDS.md).

### 📊 Main Commands (Top 10)

| Command | Description | Example |
|---------|-------------|---------|
| `create` | Create new shadow clone | `scj create feature/new --tmux --claude --open` |
| `list` | List shadow clones | `scj list --details` |
| `delete` | Delete shadow clone | `scj delete feature/old --fzf` |
| `tmux` | Open in tmux session | `scj tmux feature/new` |
| `sync` | File synchronization | `scj sync --auto` |
| `suggest` | AI suggestion feature | `scj suggest --branch --description "new feature"` |
| `github` | GitHub integration | `scj github --issue 123` |
| `dashboard` | Launch Web UI | `scj dashboard --open` |
| `health` | Health check | `scj health --fix` |
| `where` | Check current location | `scj where --verbose` |

### 🎯 Quick Reference

```bash
# Basic usage
scj create feature/awesome-feature
scj list
scj tmux feature/awesome-feature

# Full setup
scj create feature/full-setup --tmux --claude --open --setup

# AI suggestions
scj suggest --branch --description "user authentication feature"
scj suggest --commit --diff

# GitHub integration
scj github --issue 123
scj github --create-pr
```

## Advanced Features

### 🚀 Auto Review & Merge Flow

```bash
# Run auto flow
scj review --auto-flow
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
scj dashboard

# Launch on custom port
scj dashboard --port 3000
```

**Dashboard features:**
- List all worktree states
- Visualize GitHub integration status
- Display health status
- Real-time updates (every 30 seconds)

### 📸 Snapshot Feature

```bash
# Create snapshot
scj snapshot -m "State before refactoring"

# Snapshot all worktrees
scj snapshot --all

# Restore from snapshot
scj snapshot --restore snapshot-xxxxx
```

### 🏥 Worktree Health Check

```bash
# Check health
scj health

# Auto-fix
scj health --fix

# Remove old worktrees (30+ days)
scj health --prune --days 30
```

**Detected issues:**
- 🕰️ `stale`: Not updated for long time
- 👻 `orphaned`: Remote branch doesn't exist
- 🌊 `diverged`: Significantly diverged from main branch
- 📝 `uncommitted`: Uncommitted changes
- ⚔️ `conflict`: Unresolved merge conflicts
- ❌ `missing`: Directory doesn't exist

## Configuration

### 📁 Project Configuration (.scj.json)

```json
{
  "worktrees": {
    "path": ".git/shadow-clones",
    "branchPrefix": "feature/"
  },
  "development": {
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"],
    "defaultEditor": "cursor"
  },
  "hooks": {
    "afterCreate": "npm install",
    "beforeDelete": "echo \"Deleting shadow clone: $SHADOW_CLONE\""
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
    "shadow-clone-jutsu": {
      "command": "scj",
      "args": ["mcp", "serve"]
    }
  }
}
```

### 🐚 Shell Completion

#### Bash

```bash
scj completion bash >> ~/.bashrc
source ~/.bashrc
```

#### Zsh

```bash
mkdir -p ~/.zsh/completions
scj completion zsh > ~/.zsh/completions/_scj
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc
source ~/.zshrc
```

#### Fish

```bash
scj completion fish > ~/.config/fish/completions/scj.fish
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
DEBUG=scj:* scj create feature/debug

# Output detailed logs
scj --verbose create feature/test
```

## Contributing

### 🤝 Contribution

Please report bugs and feature requests to [GitHub Issues](https://github.com/hashiramaendure/scj/issues).

Pull requests are welcome!

### 📚 Related Documentation

- [Contributing Guidelines](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Changelog](./CHANGELOG.md)
- [License](./LICENSE)

### 🛠️ Development

```bash
# Clone repository
git clone https://github.com/hashiramaendure/scj.git
cd shadow-clone-jutsu

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
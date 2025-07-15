# 🥷 shadow-clone-jutsu

**English** | **[日本語](/README.md)**

_Parallel Development CLI powered by Git Worktree & Claude AI_

[![npm version](https://badge.fury.io/js/shadow-clone-jutsu.svg)](https://www.npmjs.com/package/shadow-clone-jutsu)
[![CI](https://github.com/hashiramaendure/scj/actions/workflows/ci.yml/badge.svg)](https://github.com/hashiramaendure/scj/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/hashiramaendure/shadow-clone-jutsu/branch/main/graph/badge.svg)](https://codecov.io/gh/hashiramaendure/shadow-clone-jutsu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A CLI tool that realizes parallel development with Claude Code using Shadow Clone Jutsu (Git Worktree)**

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

**Pain**: Traditional Git workflows require constant branch switching, stashing, and context switching when working on multiple features simultaneously.

**Solution**: shadow-clone-jutsu leverages Git Worktree to create isolated "shadow clones" for each branch, enabling true parallel development with seamless AI integration.

**Benefit**: Developers can work on multiple features simultaneously, leverage Claude Code for AI-powered development, and maintain perfect workflow efficiency with tmux/fzf integration.

## Key Features

| Feature | Description |
|---------|-------------|
| 🥷 **Ninja Theme** | Intuitive interface treating Worktrees as "shadow clones" |
| 🤖 **Claude Code Integration** | AI development support via MCP (Model Context Protocol) |
| 🔗 **GitHub Integration** | Create shadow clones directly from PR/Issues |
| 🎯 **tmux/fzf Integration** | Efficient workflow management |
| 🎨 **Interactive UI** | Beautiful and user-friendly CLI experience |
| 📊 **Dashboard** | Web UI for comprehensive visualization |
| 🔄 **Auto Sync** | Automatic synchronization on file changes |
| 📸 **Snapshots** | Save and restore work states |

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

## Quick Start

### 🚀 Get Started in 3 Steps

```bash
# 1. Navigate to your Git project directory
cd your-git-project

# 2. Create a new shadow clone (worktree)
scj create feature/awesome-feature

# 3. Start developing in the new worktree
cd ../worktrees/feature-awesome-feature
```

### 🎯 Copy-Paste Ready Command

```bash
pnpm dlx shadow-clone-jutsu create feat/my-feature --tmux --claude --open
```

## Command Reference

For detailed command documentation, see [COMMANDS.md](./docs/COMMANDS.md).

### Core Commands

| Command | Description |
|---------|-------------|
| `scj create <branch>` | Create a new shadow clone |
| `scj list` | List all shadow clones |
| `scj delete <branch>` | Delete a shadow clone |
| `scj tmux [branch]` | Open shadow clone in tmux |
| `scj sync` | Synchronize files between worktrees |
| `scj suggest` | AI-powered suggestions with Claude Code |
| `scj github` | GitHub integration commands |
| `scj dashboard` | Launch web dashboard |
| `scj health` | Check shadow clone health |
| `scj where` | Show current worktree location |

## Advanced Features

### 🤖 Claude Code Integration

```bash
# AI-powered branch name suggestions
scj suggest --branch --description "fix login bug"

# AI-powered commit message suggestions
scj suggest --commit --diff

# Create shadow clone with Claude Code setup
scj create feature/ai-feature --claude
```

### 🔗 GitHub Integration

```bash
# Create shadow clone from GitHub Issue
scj github --issue 123

# Create shadow clone from PR
scj github --pr 456
```

### 🎯 tmux Integration

```bash
# Open shadow clone in tmux session
scj tmux feature/my-feature

# Auto-create tmux session when creating shadow clone
scj create feature/tmux-feature --tmux
```

## Configuration

Configuration is managed through `scj.config.json`:

```json
{
  "worktrees": {
    "root": "../worktrees",
    "branchPrefix": "feature/"
  },
  "development": {
    "defaultEditor": "cursor",
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"]
  },
  "integrations": {
    "claude": true,
    "tmux": true,
    "github": true
  }
}
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

[MIT License](./LICENSE) © 2025 hashiramaendure

---

<div align="center">

**🥷 Happy parallel development with shadow-clone-jutsu!**

[GitHub](https://github.com/hashiramaendure/scj) • 
[npm](https://www.npmjs.com/package/shadow-clone-jutsu) • 
[Issues](https://github.com/hashiramaendure/scj/issues) • 
[Discussions](https://github.com/hashiramaendure/scj/discussions)

</div>
---
"shadow-clone-jutsu": major
---

## 🎉 shadow-clone-jutsu v1.0.0

### Major Changes

- Initial stable release of shadow-clone-jutsu
- Complete Git worktree management with intuitive ninja-themed interface  
- Claude Code integration via MCP (Model Context Protocol)
- GitHub Issues/PR integration for automatic branch creation
- tmux/fzf integration for efficient workflow
- Interactive UI with beautiful CLI experience

### Features

- **Core Commands**: create, list, delete, shell, exec, attach
- **GitHub Integration**: Automatic worktree creation from Issues/PRs
- **Claude Code Support**: MCP server for AI-assisted development
- **Advanced Features**: batch operations, file sync, health checks, snapshots
- **Cross-platform**: Support for macOS, Linux, and Windows

### Installation

```bash
# npm
npm install -g shadow-clone-jutsu

# pnpm (recommended)
pnpm add -g shadow-clone-jutsu

# Homebrew (macOS/Linux)
brew tap hashiramaendure/tap
brew install shadow-clone-jutsu

# Scoop (Windows)
scoop bucket add hashiramaendure https://github.com/hashiramaendure/scoop-bucket
scoop install shadow-clone-jutsu
```

🥷 Happy parallel development with shadow-clone-jutsu!
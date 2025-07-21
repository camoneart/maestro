# 🐚 shell - Enter Orchestra Member Shell

Enter an interactive shell session in an orchestra member.

## Overview

The `shell` command provides an interactive shell environment within a specific worktree. This allows you to work directly in the context of a feature branch with all environment variables properly set.

## Usage

```bash
mst shell [branch-name] [options]
mst sh [branch-name] [options]  # alias
```

## Options

- `--fzf` - Interactively select orchestra member with fzf
- `--cmd <command>` - Execute command and exit (non-interactive)
- `--tmux` - Attach to existing tmux session (create if doesn't exist)
- `--tmux-vertical`, `--tmux-v` - Open shell in vertical split pane
- `--tmux-horizontal`, `--tmux-h` - Open shell in horizontal split pane

## Examples

### Basic Usage

Enter a shell in a specific orchestra member:

```bash
# Enter shell
mst shell feature/awesome

# Using alias
mst sh feature/api
```

### Interactive Selection

Use fzf to select which orchestra member to enter:

```bash
# Select with fzf
mst shell --fzf

# Shorthand without branch name
mst sh --fzf
```

### Execute Command and Exit

Run a single command without entering interactive shell:

```bash
# Run tests and exit
mst shell feature/test --cmd "npm test"

# Check Node version
mst shell backend --cmd "node --version"
```

### tmux Integration

Work with tmux for better session management:

```bash
# Attach to existing tmux session or create new
mst shell feature/ui --tmux

# Open in vertical split (side by side)
mst shell feature/api --tmux-v

# Open in horizontal split (top and bottom)
mst shell feature/db --tmux-h

# Combine with fzf
mst shell --fzf --tmux-v
```

## Environment Variables

When in a maestro shell, these environment variables are automatically set:

- `MAESTRO` - Set to "1" (indicates you're in a maestro shell)
- `MAESTRO_BRANCH` - The branch name of current worktree
- `MAESTRO_PATH` - The absolute path to the worktree

## Shell Customization

The shell prompt is automatically customized to show the current orchestra member:

- **Bash**: `🎼 [branch-name] ~/path $ `
- **Zsh**: `🎼 [branch-name] ~/path $ `
- **Fish**: `🎼 [branch-name] ~/path $ `

The shell type is determined by your `$SHELL` environment variable.

## tmux Features

### Session Management

When using `--tmux`:
- Creates a session named `maestro-{branch-name}`
- Reattaches to existing session if available
- Maintains separate session per orchestra member

### Pane Splitting

When using `--tmux-v` or `--tmux-h`:
- Creates a new pane in current tmux window
- Sets pane title to branch name
- Automatically configures tmux status line

## Use Cases

1. **Development Work**
   ```bash
   # Enter frontend development environment
   mst shell feature/ui
   
   # Start with tmux for long sessions
   mst shell feature/backend --tmux
   ```

2. **Quick Commands**
   ```bash
   # Run migrations
   mst shell main --cmd "npm run migrate"
   
   # Check dependencies
   mst shell feature/auth --cmd "npm ls"
   ```

3. **Multiple Environments**
   ```bash
   # Open frontend and backend in splits
   mst shell frontend --tmux-v
   mst shell backend --tmux-v
   ```

4. **Interactive Workflow**
   ```bash
   # Select and enter with fzf
   mst shell --fzf
   
   # Select and open in tmux
   mst shell --fzf --tmux
   ```

## Tips

- Use `--tmux` for long-running development sessions
- Use `--cmd` for quick one-off commands
- Combine `--fzf` with tmux options for flexible workflow
- Exit the shell with `exit` or Ctrl+D
- Your shell history is maintained per orchestra member

## Notes

- tmux options require being inside an existing tmux session
- The shell inherits your normal shell configuration (.bashrc, .zshrc, etc.)
- Use `mst where` inside a shell to confirm current location

## Related Commands

- [exec](./exec.md) - Execute commands without entering shell
- [create](./create.md) - Create new orchestra members
- [list](./list.md) - List all orchestra members
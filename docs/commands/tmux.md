# 🔸 tmux

Command to integrate maestro with tmux for enhanced terminal session management. Provides seamless worktree navigation and session management within tmux environments.

## Overview

```bash
mst tmux [branch-name] [options]
mst t [branch-name] [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Interactive worktree selection with tmux
mst tmux

# Open specific worktree in new tmux window
mst tmux feature/auth

# Open in vertical split pane
mst tmux feature/api --vertical

# Open in horizontal split pane  
mst tmux bugfix/login --split-pane
```

### Advanced Usage

```bash
# Create new tmux window
mst tmux feature/dashboard --new-window

# Open with specific editor
mst tmux feature/ui --editor cursor

# Detached session management
mst tmux feature/backend --detach
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--new-window` | `-n` | Open in new tmux window | `false` |
| `--split-pane` | `-p` | Split current pane | `false` |
| `--vertical` | `-v` | Vertical split (with split-pane) | `false` |
| `--editor <name>` | | Open editor after tmux setup | none |
| `--detach` | | Create detached session | `false` |

## Tmux Integration

### Session Management

The command integrates with tmux to provide:

- **Session detection**: Automatically detects existing tmux sessions
- **Window management**: Creates new windows or splits panes as needed
- **Worktree navigation**: Changes directory to selected worktree
- **Environment setup**: Sets appropriate environment variables

### Session Information

```bash
# View tmux sessions
mst tmux --list-sessions

# Attach to existing session
mst tmux --attach session-name
```

## Workflow Examples

### Development Session Setup

```bash
# 1. Start tmux session for project
tmux new-session -d -s project

# 2. Open main worktree in first window  
mst tmux main

# 3. Create new window for feature work
mst tmux feature/auth --new-window

# 4. Split pane for testing
mst tmux feature/auth --split-pane --vertical
```

### Multi-worktree Development

```bash
# Open multiple worktrees in split panes
mst tmux feature/frontend --split-pane
mst tmux feature/backend --split-pane --vertical
mst tmux feature/database --split-pane
```

### Editor Integration

```bash
# Open worktree with editor in tmux
mst tmux feature/ui --editor cursor --new-window
```

## Tmux Requirements

### Installation

Ensure tmux is installed:

```bash
# macOS
brew install tmux

# Ubuntu
sudo apt-get install tmux

# Check installation
tmux -V
```

### Configuration

Optional tmux configuration for better maestro integration:

```bash
# Add to ~/.tmux.conf
set-option -g default-shell $SHELL
set-option -g default-command $SHELL

# Enable mouse support
set-option -g mouse on

# Better pane navigation
bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R
```

## Session Lifecycle

### Creating Sessions

```bash
# Create new detached session
mst tmux feature/new --detach

# Create and attach immediately
mst tmux feature/new
```

### Managing Sessions

```bash
# List all sessions
tmux list-sessions

# Attach to session
tmux attach-session -t session-name

# Kill session
tmux kill-session -t session-name
```

## Error Handling

### Common Issues

1. **Tmux not installed**
   ```bash
   # Install tmux first
   brew install tmux  # macOS
   apt-get install tmux  # Ubuntu
   ```

2. **No tmux session active**
   ```bash
   # Start new tmux session first
   tmux new-session
   
   # Then use maestro tmux commands
   mst tmux feature/branch
   ```

3. **Worktree not found**
   ```bash
   # Check available worktrees
   mst list
   
   # Create worktree if needed
   mst create feature/branch
   ```

## Best Practices

### 1. Consistent Session Naming

```bash
# Use project-based session names
tmux new-session -s project-frontend
tmux new-session -s project-backend
```

### 2. Window Organization

```bash
# Organize by feature or component
mst tmux main --new-window           # Window 0: main
mst tmux feature/auth --new-window   # Window 1: auth
mst tmux feature/api --new-window    # Window 2: api
```

### 3. Pane Layout

```bash
# Standard development layout
mst tmux feature/work                # Main pane: editor
mst tmux feature/work --split-pane   # Split: terminal
mst tmux logs --split-pane --vertical # Split: logs
```

## Related Commands

- [`mst shell`](./shell.md) - Enter worktree shell without tmux
- [`mst where`](./where.md) - Get worktree paths for tmux navigation
- [`mst list`](./list.md) - List available worktrees for tmux sessions
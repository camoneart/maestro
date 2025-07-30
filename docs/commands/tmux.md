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

### Instant Worktree Creation with Pane Splitting

Use `mst create` with tmux split options for immediate worktree creation and pane setup:

```bash
# Create worktree and split horizontally (auto-focus to first pane)
mst create feature/new-ui --tmux-h

# Create worktree and split vertically (auto-focus to first pane)  
mst create bugfix/critical --tmux-v

# Create worktree with multiple panes
mst create feature/api --tmux-h-panes 3      # 3 horizontal panes
mst create feature/ui --tmux-v-panes 4       # 4 vertical panes

# Create with specific layouts
mst create feature/dashboard --tmux-h-panes 3 --tmux-layout even-horizontal
mst create feature/service --tmux-v-panes 2 --tmux-layout main-vertical

# Combine with Claude Code for AI-assisted development
mst create feature/ai-feature --tmux-h-panes 2 --tmux-layout tiled --claude-md
```

**Multi-Pane Layout Examples:**

```bash
# Even Horizontal (3 panes) - Services side by side
mst create feature/services --tmux-h-panes 3
┌──────────┬──────────┬──────────┐
│ Frontend │ Backend  │ Database │
│  :3000   │  :8080   │  :5432   │
└──────────┴──────────┴──────────┘

# Main Vertical (4 panes) - Main editor with side panels
mst create feature/monitoring --tmux-v-panes 4 --tmux-layout main-vertical
┌──────────┬──────────┐
│          │ Logs     │
│  Main    ├──────────┤
│  Editor  │ Metrics  │
│          ├──────────┤
│          │ Alerts   │
└──────────┴──────────┘

# Tiled Layout (4 panes) - Balanced grid for testing
mst create feature/testing --tmux-h-panes 4 --tmux-layout tiled
┌──────────┬──────────┐
│  Tests   │ Coverage │
├──────────┼──────────┤
│  Lint    │  Build   │
└──────────┴──────────┘
```

**Common Multi-Pane Use Cases:**

1. **Full-Stack Development (3 horizontal panes)**
   ```bash
   mst create feature/fullstack --tmux-h-panes 3
   # Pane 1: pnpm run dev (frontend)
   # Pane 2: pnpm run server (backend)
   # Pane 3: docker-compose up (database)
   ```

2. **Test-Driven Development (4 tiled panes)**
   ```bash
   mst create feature/tdd --tmux-h-panes 4 --tmux-layout tiled
   # Pane 1: Code editor
   # Pane 2: Test runner (watch mode)
   # Pane 3: Coverage report
   # Pane 4: Git operations
   ```

3. **Microservices (main-vertical with 3 panes)**
   ```bash
   mst create feature/microservice --tmux-v-panes 3 --tmux-layout main-vertical
   # Main: Primary service code
   # Side 1: API Gateway logs
   # Side 2: Message queue monitor
   ```

**Improved Auto-Focus & Title Management:**
- **First pane (top-left) is automatically focused** after creation for optimal workflow positioning
- **All panes receive unified titles** displaying the branch name for consistent identification
- No manual pane switching required - ready for immediate development
- Better user experience with consistent focus behavior across all pane creation scenarios

**Layout Options:**
- `even-horizontal` - Evenly distribute panes horizontally
- `even-vertical` - Evenly distribute panes vertically
- `main-horizontal` - Large main pane at top, smaller panes below  
- `main-vertical` - Large main pane on left, smaller panes on right
- `tiled` - Tiled layout that balances all panes

**Multi-Pane Features:**
- Supports 2-10 panes per worktree creation (recommended: 2-6)
- Automatic layout application for optimal space usage
- **Unified pane titles**: All panes display the branch name consistently
- **Improved focus management**: First pane (top-left) is automatically focused
- All panes inherit shell environment and working directory
- Each pane starts in the worktree directory
- MAESTRO environment variables set in all panes

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

### Shell Environment Inheritance

Maestro automatically inherits your shell environment when creating tmux sessions, including:

- **Custom PS1 prompts**: Your shell prompts will be preserved in tmux sessions
- **Environment variables**: PATH, aliases, and custom variables are inherited
- **Shell configuration**: `.bashrc`, `.zshrc`, and other config files are sourced

The tmux sessions are created with login shells (`-l` flag) to ensure proper environment loading:

```bash
# Examples of preserved environments:
export PS1="mycustom:prompt$ "           # ✅ Preserved
alias ll="ls -la"                        # ✅ Preserved  
export CUSTOM_VAR="value"               # ✅ Preserved
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

### Multi-Pane Creation Errors

When using `mst create` with multi-pane options (`--tmux-h-panes` or `--tmux-v-panes`), you may encounter space-related errors. The create command now provides enhanced error handling with user-friendly Japanese messages and **automatic rollback protection** to prevent orphaned worktrees:

4. **No space for new pane**
   ```
   Error: 画面サイズに対してペイン数（4個）が多すぎます。ターミナルウィンドウを大きくするか、ペイン数を減らしてください。（水平分割）
   ```

   **Enhanced Error Message Features**:
   - Displays in Japanese for better user experience
   - Shows the exact number of panes that couldn't be created
   - Indicates split direction: 水平分割 (horizontal) or 垂直分割 (vertical)
   - Provides immediate solutions in the error message itself

   **Immediate Solutions**:
   - Resize terminal window (drag corners or maximize)
   - Reduce pane count: `--tmux-h-panes 2` instead of `--tmux-h-panes 4`
   - Switch split direction: `--tmux-v-panes` may fit better than `--tmux-h-panes`
   - Use efficient layouts: `--tmux-layout main-vertical` or `--tmux-layout tiled`

   **Terminal Size Guidelines**:
   - **80x24 (small)**: Maximum 2-3 panes
   - **120x40 (medium)**: Optimal for 4-6 panes  
   - **200x60+ (large)**: Supports 6+ panes comfortably

   **Automatic Rollback Protection**:
   When tmux pane creation fails, the `create` command automatically cleans up any created worktrees:
   ```bash
   # If pane creation fails, you'll see:
   ⚠️  後処理でエラーが発生したため、作成したリソースをクリーンアップします...
   ✅ クリーンアップが完了しました
   ```
   This prevents orphaned worktrees and maintains repository cleanliness.

5. **General tmux pane errors**
   ```
   Error: tmuxペインの作成に失敗しました: [error details]
   ```

   **Improved Error Handling**:
   - Generic fallback for all other tmux pane creation failures
   - Preserves original tmux error message for debugging purposes
   - Consistent Japanese error messaging throughout the application
   - **Automatic rollback**: Created worktrees are automatically deleted when tmux errors occur

   **Troubleshooting Steps**:
   ```bash
   # 1. Check tmux version
   tmux -V
   
   # 2. Test basic tmux functionality
   tmux new-session -d test-session
   tmux kill-session -t test-session
   
   # 3. Reset tmux if needed
   tmux kill-server && tmux
   
   # 4. Check configuration
   tmux show-options -g
   ```

### Pane Layout Optimization

**Space-Efficient Layouts by Use Case**:

```bash
# Horizontal development (code + terminal)
mst create feature/dev --tmux-h-panes 2 --tmux-layout even-horizontal

# Vertical stack (editor + terminal + logs)  
mst create feature/stack --tmux-v-panes 3 --tmux-layout even-vertical

# Main focus with helpers (large editor + small panels)
mst create feature/focus --tmux-v-panes 3 --tmux-layout main-vertical
```

**Layout Performance by Terminal Size**:
- **tiled**: Best for square terminals, 4+ panes
- **main-vertical**: Optimal for wide terminals  
- **main-horizontal**: Good for tall terminals
- **even-horizontal**: Simple, works in most sizes
- **even-vertical**: Compact, good for narrow terminals

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
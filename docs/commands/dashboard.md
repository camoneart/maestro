# 🔸 dashboard

Command to launch a web-based dashboard for visualizing and managing all orchestra members (Git worktrees). Provides a comprehensive overview of worktree status, health, and GitHub integration in an intuitive web interface.

## Overview

```bash
mst dashboard [options]
mst ui [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Launch dashboard with default settings
mst dashboard

# Launch on specific port
mst dashboard --port 3000

# Launch without opening browser automatically
mst dashboard --no-open
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--port <number>` | `-p` | Port number for web server | `8765` |
| `--no-open` | | Don't automatically open browser | Auto-open enabled |

## Dashboard Features

### Real-time Overview

The dashboard provides a comprehensive view of your orchestra members:

- **Statistics Cards**: Total worktrees, active count, attention needed, GitHub linked
- **Worktree Grid**: Visual cards for each worktree with status indicators
- **Auto-refresh**: Updates every 30 seconds automatically
- **Interactive Actions**: Direct editor and terminal integration

### Worktree Status Indicators

Each worktree card displays:

#### Visual Indicators
- **📍** Main worktree (repository root)
- **🎼** Regular orchestra member
- **Color coding**: Different colors for status and health

#### Status Badges
- **Issue Badge**: GitHub issue integration (`ISSUE #123`)
- **PR Badge**: GitHub pull request integration (`PR #456`)  
- **Template Badge**: Template used for creation (`feature`, `bugfix`)
- **Health Badges**: 
  - **Stale**: No commits for 30+ days
  - **Uncommitted**: Has uncommitted changes

### Interactive Actions

Each worktree provides action buttons:

#### Editor Integration
Opens worktree in preferred editor (Cursor → VSCode → fallback)

#### Terminal Integration
Opens new terminal window in worktree directory (macOS Terminal app)

## Web Interface

The dashboard runs on `http://localhost:8765` by default and provides:

- **Real-time status monitoring** of all worktrees
- **Health checks** for staleness and uncommitted changes
- **GitHub integration** showing linked issues and PRs
- **Direct actions** to open in editor or terminal

## API Endpoints

- `GET /api/worktrees` - Returns comprehensive worktree data
- `POST /api/open-editor` - Opens worktree in editor
- `POST /api/open-terminal` - Opens worktree in terminal

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Use different port
   mst dashboard --port 8080
   ```

2. **Editor integration not working**
   ```bash
   # Ensure Cursor or VSCode is installed
   which cursor  # or: which code
   ```

## Related Commands

- [`mst list`](./list.md) - Command-line worktree listing
- [`mst health`](./health.md) - Detailed health checking
- [`mst graph`](./graph.md) - Dependency visualization
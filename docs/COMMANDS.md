# 📚 Command Reference

Detailed usage of all maestro (mst) commands.

## Basic Commands

### 🎼 create - Create Orchestra Member

Create a new orchestra member (worktree).

```bash
mst create <branch-name> [options]
```

#### Options
- `--base <branch>` - Specify base branch (default: main)
- `--open` - Automatically open in editor
- `--setup` - Auto-setup development environment
- `--tmux` - Create new tmux window
- `--tmux-h` - Create in horizontal tmux pane split (side by side)
- `--tmux-v` - Create in vertical tmux pane split (top and bottom)
- `--claude` - Create CLAUDE.md for Claude Code
- `--template <name>` - Use template
- `--draft-pr` - Auto-create Draft PR
- `--no-push` - Create branch without pushing to remote
- `--from-pr` - Create from PR
- `--from-issue` - Create from Issue
- `--fzf` - Select PR/Issue with fzf
- `--sync-files` - Sync specific files from main branch
- `-y, --yes` - Skip confirmations

#### Examples
```bash
# Basic usage
mst create feature/awesome-feature

# Full setup
mst create feature/full-setup --tmux --claude --open --setup

# Create from GitHub Issue
mst create 123  # Auto-generates branch name from Issue #123

# Create with tmux pane split
mst create feature/new --tmux-h --claude  # Horizontal split with Claude
mst create issue-456 --tmux-v --setup     # Vertical split with setup
```

### 📋 list - List Orchestra Members

Display all orchestra members.

```bash
mst list [options]
```

#### Options
- `--json` - Output in JSON format
- `--sort <field>` - Sort by field (branch, age, size)
- `--filter <pattern>` - Filter by pattern
- `--last-commit` - Show last commit info
- `--metadata` - Show metadata info
- `--full-path` - Show full paths instead of relative paths
- `--fzf` - Select with fzf (outputs selected branch name)

#### Examples
```bash
# Basic list
mst list

# Show with details
mst list --last-commit --metadata

# Sort by size
mst list --sort size

# Show full paths
mst list --full-path
```

### 🗑️ delete - Delete Orchestra Member

Delete orchestra members.

```bash
mst delete [branch-name] [options]
```

#### Options
- `--force` - Force delete
- `--remove-remote` - Also delete remote branch
- `--fzf` - Select with fzf (multiple selection)
- `--current` - Delete current worktree

#### Features
- **Wildcard support**: Use patterns like `"feature/old-*"` to delete multiple branches

#### Examples
```bash
# Basic delete
mst delete feature/old-feature

# Force delete (even with uncommitted changes)
mst delete feature/broken --force

# Delete with wildcards
mst delete "feature/old-*"

# Select multiple with fzf
mst delete --fzf
```

### 🔄 sync - Sync Orchestra Members

Sync files between orchestra members.

```bash
mst sync [options]
```

#### Options
- `--files <pattern>` - File pattern to sync
- `--from <branch>` - Source branch
- `--to <branch>` - Target branch
- `--dry-run` - Preview only, don't sync
- `--auto` - Auto sync mode
- `-c, --concurrency <number>` - Number of parallel executions (default: 5)

#### Examples
```bash
# Basic sync
mst sync

# Sync specific files
mst sync --files "*.env"

# Dry run mode
mst sync --dry-run
```

### 🐚 shell - Enter Orchestra Member Shell

Enter the shell of an orchestra member.

```bash
mst shell [branch-name] [options]
mst sh [branch-name] [options]  # alias
```

#### Options
- `--fzf` - Select with fzf
- `--cmd <command>` - Execute command and exit
- `--tmux` - Attach to tmux session (create if doesn't exist)

#### Examples
```bash
# Enter shell
mst shell feature/awesome

# Select with fzf
mst shell --fzf

# Execute command
mst shell feature/test --cmd "npm test"
```

## Integration Commands

### 🤖 suggest - AI Suggestions

Use Claude Code to provide various suggestions.

```bash
mst suggest [options]
```

#### Options
- `--branch` - Suggest branch name
- `--commit` - Suggest commit message
- `--issue` - Suggest issue title
- `--pr` - Suggest PR title/description
- `--review` - Suggest review comments
- `--description <text>` - Specify description
- `--diff` - Include diff

#### Examples
```bash
# Suggest branch name
mst suggest --branch --description "Add user authentication"

# Suggest commit message
mst suggest --commit --diff

# Suggest PR description
mst suggest --pr --description "Implement login feature"
```

### 🔗 github - GitHub Integration

Provides GitHub integration features.

```bash
mst github [options]
```

#### Options
- `--issue <number>` - Create orchestra member from issue
- `--pr <number>` - Create orchestra member from PR
- `--create-pr` - Create PR
- `--draft` - Create as Draft PR
- `--branch <name>` - Specify branch name
- `-o, --open` - Open in editor
- `-s, --setup` - Execute environment setup
- `-m, --message <message>` - Comment message
- `--reopen` - Reopen PR/Issue
- `--close` - Close PR/Issue

#### Examples
```bash
# Create from Issue #123
mst github --issue 123

# Create from PR #456
mst github --pr 456

# Create PR from current branch
mst github --create-pr
```

### 🖥️ tmux - tmux Integration

Manage orchestra members with tmux sessions.

```bash
mst tmux [branch-name] [options]
```

#### Options
- `--detach` - Start in detached mode
- `--kill` - Kill session
- `--list` - List active sessions
- `--editor` - Launch editor
- `-n, --new-window` - Open in new window
- `-p, --split-pane` - Split current pane
- `-v, --vertical` - Vertical split (use with -p)
- `-e, --editor <editor>` - Auto-launch editor (nvim, vim, code, emacs)
- `-d, --detach` - Only create session (don't attach)

#### Examples
```bash
# Open in tmux
mst tmux feature/awesome

# Select with fzf
mst tmux

# Start in detached mode
mst tmux feature/background --detach
```

## Advanced Features

### 📊 dashboard - Dashboard

Launch Web UI dashboard.

```bash
mst dashboard [options]
```

#### Options
- `-p, --port <number>` - Port number (default: 8765)
- `--no-open` - Don't auto-open browser
- `--host <address>` - Host address

#### Examples
```bash
# Launch dashboard
mst dashboard

# Launch on port 8080
mst dashboard --port 8080
```

### 🩺 health - Health Check

Check health status of orchestra members.

```bash
mst health [options]
```

#### Options
- `--fix` - Auto-fix issues
- `--json` - Output in JSON format
- `--verbose` - Detailed diagnostic info
- `-p, --prune` - Delete old worktrees
- `-d, --days <number>` - Days to determine "old" (default: 30)

#### Examples
```bash
# Basic health check
mst health

# Auto-fix issues
mst health --fix

# Prune old worktrees
mst health --prune --days 60
```

### 📸 snapshot - Snapshots

Manage work state snapshots.

```bash
mst snapshot [options]
```

#### Options
- `-m, --message <message>` - Snapshot message
- `-s, --stash` - Save changes to stash
- `-a, --all` - Create snapshots for all worktrees
- `-l, --list` - Show list of snapshots
- `-r, --restore <id>` - Restore a snapshot
- `-d, --delete <id>` - Delete a snapshot
- `-j, --json` - Output in JSON format

#### Examples
```bash
# Create snapshot
mst snapshot -m "before refactoring"

# List snapshots
mst snapshot --list

# Restore snapshot
mst snapshot --restore <snapshot-id>
```

### 👁️ watch - File Watch

Watch file changes and auto-sync.

```bash
mst watch [options]
```

#### Options
- `--files <pattern>` - File pattern to watch
- `--ignore <pattern>` - Pattern to ignore
- `--auto` - Auto-sync without confirmation
- `--dry` - Dry run mode

#### Examples
```bash
# Basic watch
mst watch

# Watch specific files
mst watch --files "src/**/*.ts"

# Auto-sync mode
mst watch --auto
```

## Utility Commands

### 🔧 config - Configuration Management

Manage configuration.

```bash
mst config <command> [options]
```

#### Subcommands
- `get <key>` - Get config value
- `set <key> <value>` - Set config value
- `list` - List all configs
- `reset` - Reset config

#### Examples
```bash
# List configs
mst config list

# Set editor
mst config set development.defaultEditor cursor

# Get config
mst config get worktrees.root
```

### 📍 where - Current Location

Check current worktree location.

```bash
mst where [options]
```

#### Options
- `--json` - Output in JSON format
- `--verbose` - Show detailed info

#### Examples
```bash
# Check location
mst where

# With details
mst where --verbose
```

### 🔗 exec - Execute Commands

Execute same command in all orchestra members.

```bash
mst exec <command> [options]
```

#### Options
- `--parallel` - Execute in parallel
- `--continue-on-error` - Continue on error
- `--dry-run` - Preview only
- `-s, --silent` - Suppress output
- `-a, --all` - Execute on all orchestra members

#### Examples
```bash
# Run tests in all
mst exec "npm test"

# Parallel execution
mst exec "npm run lint" --parallel
```

### 🔄 batch - Batch Processing

Batch process multiple orchestra members.

```bash
mst batch <command> [options]
```

#### Options
- `-c, --concurrency <number>` - Number of parallel executions (default: 5)

#### Subcommands
- `create <pattern>` - Create multiple based on pattern
- `delete <pattern>` - Delete multiple based on pattern
- `sync` - Sync all orchestra members

#### Examples
```bash
# Create multiple
mst batch create feature/task-{1..5}

# Delete by pattern
mst batch delete "feature/old-*"
```

### 📋 template - Template Management

Manage project templates.

```bash
mst template <command> [options]
```

#### Subcommands
- `list` - List templates
- `create <name>` - Create template
- `apply <name>` - Apply template
- `delete <name>` - Delete template

#### Examples
```bash
# List templates
mst template list

# Create template
mst template create react-component

# Apply template
mst template apply react-component
```

### 🔍 mcp - MCP Server

Manage MCP server.

```bash
mst mcp <command> [options]
```

#### Subcommands
- `start` - Start MCP server
- `stop` - Stop MCP server
- `status` - Check server status
- `restart` - Restart server

#### Examples
```bash
# Start server
mst mcp start

# Check status
mst mcp status
```

### 🎯 attach - Session Attach

Attach to existing branch.

```bash
mst attach [branch-name] [options]
```

#### Options
- `-r, --remote` - Include remote branches
- `-f, --fetch` - Execute fetch first
- `-o, --open` - Open in editor
- `-s, --setup` - Execute environment setup

#### Examples
```bash
# Attach to branch
mst attach feature-awesome

# With fetch and setup
mst attach --fetch --setup
```

### 📈 graph - Relationship Graph

Display orchestra member relationships.

```bash
mst graph [options]
```

#### Options
- `--format <type>` - Output format (text, mermaid, dot)
- `--output <file>` - Output file
- `--show-commits` - Show latest commits
- `--show-dates` - Show last update dates
- `-d, --depth <number>` - Display depth (default: 3)

#### Examples
```bash
# Display graph
mst graph

# Output as Mermaid
mst graph --format mermaid --output graph.md
```

### 📚 history - History

Display operation history.

```bash
mst history [options]
```

#### Options
- `--limit <number>` - Number of history entries
- `--json` - Output in JSON format
- `--filter <pattern>` - Filter pattern

#### Examples
```bash
# Show history
mst history

# Latest 10 entries
mst history --limit 10
```

### 🔍 issue - Issue Management

GitHub Issue integration.

```bash
mst issue <command> [options]
```

#### Subcommands
- `create` - Create issue
- `list` - List issues
- `view <number>` - View issue
- `close <number>` - Close issue

#### Examples
```bash
# Create issue
mst issue create

# List issues
mst issue list

# View Issue #123
mst issue view 123
```

### 🔍 review - Review Management

Manage Pull Request reviews.

```bash
mst review <command> [options]
```

#### Options
- `--auto-flow` - Execute automatic review & merge flow

#### Subcommands
- `create` - Create review
- `list` - List reviews
- `approve <number>` - Approve PR
- `request-changes <number>` - Request changes

#### Examples
```bash
# Create review
mst review create

# Approve PR
mst review approve 123

# Request changes
mst review request-changes 123
```

### 🔄 completion - Auto Completion

Set up shell auto-completion.

```bash
mst completion <shell>
```

#### Supported Shells
- `bash` - Bash completion
- `zsh` - Zsh completion
- `fish` - Fish completion

#### Examples
```bash
# Set up Zsh completion
mst completion zsh > ~/.zsh/completions/_mst

# Set up Bash completion
mst completion bash > /etc/bash_completion.d/mst
```

## Global Options

Options available for all commands:

- `--help, -h` - Show help
- `--version, -V` - Show version
- `--verbose, -v` - Verbose output
- `--quiet, -q` - Quiet mode
- `--config <path>` - Config file path
- `--no-color` - Disable colors

## Configuration File

Customize settings with `mst.config.json`:

```json
{
  "worktrees": {
    "root": "../worktrees",
    "branchPrefix": "feature/",
    "autoCleanup": true
  },
  "development": {
    "defaultEditor": "cursor",
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"],
    "hooks": {
      "preCreate": ["npm install"],
      "postCreate": ["npm run setup"]
    }
  },
  "integrations": {
    "claude": {
      "enabled": true,
      "autoGenerate": true
    },
    "tmux": {
      "enabled": true,
      "autoAttach": true
    },
    "github": {
      "enabled": true,
      "autoLink": true
    }
  },
  "ui": {
    "theme": "orchestra",
    "colors": true,
    "animations": true
  }
}
```

## Environment Variables

- `MST_CONFIG_PATH` - Config file path
- `MST_WORKTREES_ROOT` - Worktrees root directory
- `MST_DEFAULT_EDITOR` - Default editor
- `MST_GITHUB_TOKEN` - GitHub API token
- `MST_CLAUDE_ENABLED` - Enable/disable Claude Code integration
- `DEBUG` - Debug mode (`DEBUG=mst:*`)

## Error Handling

maestro properly handles the following errors:

- Git-related errors
- File system errors
- Network errors
- Permission errors
- Configuration errors

If an error occurs, use the `--verbose` option for detailed information.

## More Information

For detailed usage of each command, see the following documentation:

- [Create Command Details](./commands/create.md)
- [Delete Command Details](./commands/delete.md)
- [Sync Command Details](./commands/sync.md)
- [GitHub Integration Details](./commands/github.md)
- [Health Check Details](./commands/health.md)
- [Snapshot Details](./commands/snapshot.md)
- [Batch Processing Details](./commands/batch.md)
- [History Management Details](./commands/history.md)
- [List Display Details](./commands/list.md)
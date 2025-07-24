# 📚 Command Reference

Detailed usage of all maestro (mst) commands.

## 📑 Table of Contents

### 🎯 Basic Commands
- [init](#-init) - Initialize project configuration
- [create](#-create) - Create new orchestra member (worktree)
- [push](#-push) - Push current branch and create PR
- [list](#-list) - Display all orchestra members
- [delete](#-delete) - Delete orchestra members
- [sync](#-sync) - Sync files between members
- [shell](#-shell) - Enter member shell

### 🔗 Integration Commands
- [github](#-github) - GitHub integration features
- [tmux](#-tmux) - tmux session management

### 📊 Advanced Features
- [health](#-health) - Health status checking
- [snapshot](#-snapshot) - Work state snapshots
- [watch](#-watch) - File watching and auto-sync

### 🛠️ Utility Commands
- [config](#-config) - Configuration management
- [where](#-where) - Check current location
- [exec](#-exec) - Execute commands in members
- [mcp](#-mcp) - MCP server management
- [attach](#-attach) - Attach to existing branch
- [graph](#-graph) - Display relationships
- [history](#-history) - Operation history
- [issue](#-issue) - GitHub issue integration
- [review](#-review) - PR review management
- [claude](#-claude) - Claude Code management
- [completion](#-completion) - Shell auto-completion

---

## 🎯 Basic Commands

### 🔸 init

Initialize Maestro configuration for your project.

```bash
mst init [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--minimal` | `-m` | Create minimal configuration |
| `--package-manager <manager>` | `-p` | Specify package manager (pnpm/npm/yarn/none) |
| `--yes` | `-y` | Skip prompts and use defaults |

#### Features
- **Smart Project Detection**: Auto-detects project type (React, Next.js, Vue.js, Python, Go)
- **Package Manager Detection**: Identifies pnpm/npm/yarn from lockfiles
- **Interactive Setup**: Guided prompts for custom configuration
- **Safe Overwrite**: Prompts before overwriting existing `.maestro.json`

#### Examples
```bash
# Interactive setup with prompts
mst init

# Quick minimal setup
mst init --minimal

# Auto setup with defaults (no prompts)
mst init --yes

# Override detected package manager
mst init --package-manager pnpm --yes
```

#### Project Type Detection
- **React**: Detects React apps, suggests `.env` and `.env.local`
- **Next.js**: Detects Next.js projects, includes `.env.development.local`
- **Vue.js**: Detects Vue projects with appropriate setup
- **Python**: Detects `requirements.txt`/`pyproject.toml`, suggests `pip install`
- **Go**: Detects `go.mod` files, suggests `go mod download`
- **Generic**: Fallback for other project types

### 🔸 create

Create a new orchestra member (worktree).

```bash
mst create <branch-name> [options]
```

| Option | Description |
|--------|-------------|
| `--base <branch>` | Specify base branch (default: main) |
| `--open` | Automatically open in editor |
| `--setup` | Auto-setup development environment |
| `--tmux` | Create new tmux window |
| `--tmux-h` | Create in horizontal tmux pane split |
| `--tmux-v` | Create in vertical tmux pane split |
| `--claude` | Create CLAUDE.md for Claude Code |
| `--copy-file <file>` | Copy files from current worktree |
| `--yes`, `-y` | Skip confirmations |

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

# Copy environment files to new worktree
mst create feature/api --copy-file .env --copy-file .env.local
```

### 🔸 push

Push current branch to remote and optionally create Pull Request.

```bash
mst push [options]
```

| Option | Description |
|--------|-------------|
| `--pr` | Create regular Pull Request |
| `--draft-pr` | Create Draft Pull Request |
| `--base <branch>` | Specify base branch (default: main) |
| `--title <title>` | Specify PR title |
| `--body <body>` | Specify PR body |
| `--no-edit` | Skip PR template editing |
| `--force` | Force push (uses --force-with-lease) |
| `--all` | Push all orchestra members |
| `--issue <number>` | Link to issue number |

#### Examples
```bash
# Basic push
mst push

# Push and create regular PR
mst push --pr

# Push and create Draft PR
mst push --draft-pr

# Push with custom PR title and body
mst push --pr --title "Add user authentication" --body "Implements login and signup features"

# Push to specific base branch
mst push --pr --base develop

# Force push (safe with --force-with-lease)
mst push --force

# Push all orchestra members with Draft PRs
mst push --all --draft-pr

# Skip PR template editing
mst push --pr --no-edit
```

### 🔸 list

Display all orchestra members.

```bash
mst list [options]
mst ls [options]  # alias
```

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |
| `--sort <field>` | Sort by field (branch, age, size) |
| `--filter <pattern>` | Filter by pattern |
| `--last-commit` | Show last commit info |
| `--metadata` | Show metadata info |
| `--full-path` | Show full paths instead of relative paths |
| `--fzf` | Select with fzf (outputs selected branch name) |
| `--names` | Machine-readable output (for scripting) |

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

# For scripting
for worktree in $(mst list --names); do
  echo "Processing $worktree"
done
```

### 🔸 delete

Delete orchestra members.

```bash
mst delete [branch-name] [options]
mst rm [branch-name] [options]  # alias
```

| Option | Description |
|--------|-------------|
| `--force`, `-f` | Force delete even with uncommitted changes |
| `--remove-remote`, `-r` | Also delete remote branch |
| `--fzf` | Select with fzf (multiple selection) |
| `--current` | Delete current worktree |

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

### 🔸 sync

Sync changes from main branch to orchestra members.

```bash
mst sync [branch-name] [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--all` | `-a` | Sync all orchestra members |
| `--main <branch>` | `-m` | Specify main branch (default: main or master) |
| `--fzf` | | Select with fzf |
| `--rebase` | | Use rebase instead of merge |
| `--dry-run` | | Preview only, don't sync |
| `--push` | | Push after merge/rebase |
| `--filter <keyword>` | | Filter worktrees by branch name or path |
| `--pattern <pattern>` | | Filter worktrees by wildcard pattern |
| `--files` | `-f` | Copy environment/config files |
| `--interactive` | `-i` | Interactive file selection |
| `--preset <name>` | `-p` | Use sync preset (env, config, all) |
| `--concurrency <number>` | `-c` | Number of parallel executions (default: 5) |

#### Examples
```bash
# Sync specific branch
mst sync feature/auth

# Sync all branches
mst sync --all

# Filter by keyword
mst sync --filter feature --all

# Filter by pattern
mst sync --pattern "feature/*" --all

# Sync with rebase
mst sync --rebase --all

# Copy environment files
mst sync --files --all
```

### 🔸 shell

Enter the shell of an orchestra member.

```bash
mst shell [branch-name] [options]
mst sh [branch-name] [options]  # alias
```

| Option | Aliases | Description |
|--------|---------|-------------|
| `--fzf` | | Select with fzf |
| `--cmd <command>` | | Execute command and exit |
| `--tmux` | | Attach to tmux session (create if doesn't exist) |
| `--tmux-vertical` | `--tmux-v` | Open shell in vertical split pane |
| `--tmux-horizontal` | `--tmux-h` | Open shell in horizontal split pane |

#### Examples
```bash
# Enter shell
mst shell feature/awesome

# Select with fzf
mst shell --fzf

# Execute command
mst shell feature/test --cmd "npm test"

# Open in vertical split pane
mst shell feature/new --tmux-v

# Open in horizontal split pane
mst shell feature/test --tmux-h
```

## 🔗 Integration Commands


### 🔸 github

Provides GitHub integration features.

```bash
mst github [type] [number] [options]
mst gh [type] [number] [options]  # alias
```

#### Arguments
| Argument | Description |
|----------|-------------|
| `type` | Type (checkout, pr, issue, comment, list) |
| `number` | PR/Issue number |

#### Options
| Option | Short | Description |
|--------|-------|-------------|
| `--open` | `-o` | Open in editor |
| `--setup` | `-s` | Execute environment setup |
| `--message <message>` | `-m` | Comment message |
| `--reopen` | | Reopen PR/Issue |
| `--close` | | Close PR/Issue |
| `--tmux` | `-t` | Open in new tmux window |
| `--tmux-vertical` | `--tmux-v` | Open in vertical split pane |
| `--tmux-horizontal` | `--tmux-h` | Open in horizontal split pane |

#### Examples
```bash
# List all GitHub PRs and Issues
mst github list
mst gh list

# Create from PR #123
mst github checkout 123
mst gh 123  # shorthand

# Create from Issue #456
mst github issue 456

# Create and open in tmux
mst github 123 --tmux

# Create and open in vertical split
mst github 123 --tmux-v

# Add comment to PR/Issue
mst github comment 123 -m "LGTM!"
```

### 🔸 tmux

Manage orchestra members with tmux sessions.

```bash
mst tmux [branch-name] [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--detach` | `-d` | Start in detached mode |
| `--kill` | | Kill session |
| `--list` | | List active sessions |
| `--editor` | | Launch editor |
| `--new-window` | `-n` | Open in new window |
| `--split-pane` | `-p` | Split current pane |
| `--vertical` | `-v` | Vertical split (use with -p) |
| `--editor <editor>` | `-e` | Auto-launch editor (nvim, vim, code, emacs) |

#### Examples
```bash
# Open in tmux
mst tmux feature/awesome

# Select with fzf
mst tmux

# Start in detached mode
mst tmux feature/background --detach
```

## 📊 Advanced Features


### 🔸 health

Check health status of orchestra members.

```bash
mst health [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--fix` | | Auto-fix issues |
| `--json` | | Output in JSON format |
| `--verbose` | | Detailed diagnostic info |
| `--prune` | `-p` | Delete old worktrees |
| `--days <number>` | `-d` | Days to determine "old" (default: 30) |

#### Examples
```bash
# Basic health check
mst health

# Auto-fix issues
mst health --fix

# Prune old worktrees
mst health --prune --days 60
```

### 🔸 snapshot

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

### 🔸 watch

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

## 🛠️ Utility Commands

### 🔸 config

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

### 🔸 where

Check current worktree location.

```bash
mst where [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |
| `--verbose` | Show detailed info |

#### Examples
```bash
# Check location
mst where

# With details
mst where --verbose
```

### 🔸 exec

Execute command in a specific orchestra member or all orchestra members.

```bash
mst exec [branch-name] <command> [options]
mst e [branch-name] <command> [options]  # alias
```

| Option | Short | Description |
|--------|-------|-------------|
| `--silent` | `-s` | Suppress output |
| `--all` | `-a` | Execute on all orchestra members |
| `--fzf` | | Select orchestra member with fzf |
| `--tmux` | `-t` | Execute in new tmux window |
| `--tmux-vertical` | `--tmux-v` | Execute in vertical split pane |
| `--tmux-horizontal` | `--tmux-h` | Execute in horizontal split pane |

#### Examples
```bash
# Execute in specific orchestra member
mst exec feature/test npm test

# Execute in all orchestra members (various formats)
mst exec --all npm run lint
mst exec -a npm run lint
# Note: When using -a/--all flag, the branch name is optional

# Select with fzf
mst exec --fzf npm run dev

# Execute in tmux
mst exec feature/api --tmux npm run watch

# Execute in vertical split
mst exec --fzf --tmux-v npm test
```


### 🔸 mcp

Manage MCP server.

```bash
mst mcp <command> [options]
```

| Subcommand | Description |
|------------|-------------|
| `serve` | Start MCP server for Claude Code/Cursor integration |

#### Examples
```bash
# Start MCP server
mst mcp serve

# Display usage information
mst mcp
```

### 🔸 attach

Attach to existing branch.

```bash
mst attach [branch-name] [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--remote` | `-r` | Include remote branches |
| `--fetch` | `-f` | Execute fetch first |
| `--open` | `-o` | Open in editor |
| `--setup` | `-s` | Execute environment setup |

#### Examples
```bash
# Attach to branch
mst attach feature-awesome

# With fetch and setup
mst attach --fetch --setup
```

### 🔸 graph

Display orchestra member relationships with automatic circular dependency detection.

```bash
mst graph [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--format <type>` | | Output format (mermaid, dot) |
| `--output <file>` | | Output file |
| `--show-commits` | | Show latest commits |
| `--show-dates` | | Show last update dates |
| `--depth <number>` | `-d` | Display depth (default: 3) |

#### Features
- **Circular Reference Detection**: Automatically detects and resolves circular dependencies between branches
- **Branch Relationship Analysis**: Shows parent-child relationships and commit divergence
- **Multiple Output Formats**: Supports Mermaid diagrams and Graphviz DOT format
- **Health Assessment**: Identifies outdated branches and potential issues

#### Examples
```bash
# Display graph (default: mermaid format)
mst graph

# Output as DOT format
mst graph --format dot --output graph.dot

# When circular dependencies are detected, warnings are automatically shown:
# ⚠️  循環参照が検出されました:
#   - feature-a → feature-b → feature-c → feature-a
# 循環参照のあるブランチは main から派生するよう調整されました
```

### 🔸 history

Display operation history.

```bash
mst history [options]
```

| Option | Description |
|--------|-------------|
| `--limit <number>` | Number of history entries |
| `--json` | Output in JSON format |
| `--filter <pattern>` | Filter pattern |

#### Examples
```bash
# Show history
mst history

# Latest 10 entries
mst history --limit 10
```

### 🔸 issue

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

### 🔸 review

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

### 🔸 claude

Manage Claude Code instances for each orchestra member.

```bash
mst claude <command> [options]
```

#### Subcommands
- `list` - List running Claude Code instances
- `start <branch-name>` - Start Claude Code for specific worktree
- `stop <branch-name>` - Stop Claude Code for specific worktree

#### Options
- `--all` - Apply to all orchestra members (for start/stop)

#### Examples
```bash
# List running instances
mst claude list

# Start Claude Code for a branch
mst claude start feature/awesome

# Start Claude Code for all branches
mst claude start --all

# Stop Claude Code
mst claude stop feature/awesome

# Stop all Claude Code instances
mst claude stop --all
```

### 🔸 completion

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

## 🌐 Global Options

Options available for all commands:

- `--help, -h` - Show help
- `--version, -V` - Show version
- `--verbose, -v` - Verbose output
- `--quiet, -q` - Quiet mode
- `--config <path>` - Config file path
- `--no-color` - Disable colors

## ⚙️ Configuration File

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
    "syncFiles": [".env", ".env.local"]
  },
  "postCreate": {
    "copyFiles": [".env", ".env.local"],
    "commands": ["pnpm install", "pnpm run dev"]
  },
  "hooks": {
    "afterCreate": ["npm install", "npm run setup"],
    "beforeDelete": "echo 'Cleaning up worktree'"
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

## 🌍 Environment Variables

- `MST_CONFIG_PATH` - Config file path
- `MST_WORKTREES_ROOT` - Worktrees root directory
- `MST_DEFAULT_EDITOR` - Default editor
- `MST_GITHUB_TOKEN` - GitHub API token
- `MST_CLAUDE_ENABLED` - Enable/disable Claude Code integration
- `DEBUG` - Debug mode (`DEBUG=mst:*`)

## ⚠️ Error Handling

maestro properly handles the following errors:

- Git-related errors
- File system errors
- Network errors
- Permission errors
- Configuration errors

If an error occurs, use the `--verbose` option for detailed information.

## 📚 More Information

For detailed usage of each command, see the following documentation:

### 🎯 Basic Commands
- [Init Command Details](./commands/init.md)
- [Create Command Details](./commands/create.md)
- [Push Command Details](./commands/push.md)
- [List Display Details](./commands/list.md)
- [Delete Command Details](./commands/delete.md)
- [Sync Command Details](./commands/sync.md)
- [Shell Command Details](./commands/shell.md)

### 🔗 Integration Commands
- [GitHub Integration Details](./commands/github.md)
- [Tmux Integration Details](./commands/tmux.md)

### 📊 Advanced Features
- [Health Check Details](./commands/health.md)
- [Snapshot Details](./commands/snapshot.md)
- [Watch Details](./commands/watch.md)

### 🛠️ Utility Commands
- [Config Management Details](./commands/config.md)
- [Where Command Details](./commands/where.md)
- [Exec Command Details](./commands/exec.md)
- [MCP Server Details](./commands/mcp.md)
- [Attach Command Details](./commands/attach.md)
- [Graph Display Details](./commands/graph.md)
- [History Management Details](./commands/history.md)
- [Issue Integration Details](./commands/issue.md)
- [Review Management Details](./commands/review.md)
- [Claude Code Management Details](./commands/claude.md)
- [Completion Setup Details](./commands/completion.md)
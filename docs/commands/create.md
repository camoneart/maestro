# 🔸 create

Command to create orchestra members (Git worktrees). Creates a new branch and worktree simultaneously, building an independent development environment.

## Overview

```bash
mst create <branch-name> [options]
```

## Usage Examples

### Basic Usage

```bash
# Create a new orchestra member
mst create feature/new-feature

# Create orchestra member from issue number
mst create 123           # Created as issue-123
mst create #123          # Created as issue-123
mst create issue-123     # Created as issue-123
```

### Advanced Usage

```bash
# Create with tmux session (auto-attaches to the session)
mst create feature/new-feature --tmux

# Create with tmux session and auto-start Claude Code
mst create feature/new-feature --tmux --claude

# Create with tmux pane split options (when already in tmux)
mst create feature/new-feature --tmux-h  # Horizontal split
mst create feature/new-feature --tmux-v  # Vertical split

# Create with specified base branch
mst create feature/new-feature --base develop

# Combine all options
mst create feature/new-feature --base main --open --setup --tmux --claude
```

## Options

| Option               | Short | Description                                                   | Default |
| -------------------- | ----- | ------------------------------------------------------------- | ------- |
| `--base <branch>`    | `-b`  | Specify base branch                                           | `main`  |
| `--open`             | `-o`  | Open in editor after creation                                 | `false` |
| `--setup`            | `-s`  | Run environment setup (npm install, etc.)                     | `false` |
| `--tmux`             | `-t`  | Create tmux session and auto-attach                          | `false` |
| `--tmux-h`           |       | Split tmux pane horizontally (when in tmux)                  | `false` |
| `--tmux-v`           |       | Split tmux pane vertically (when in tmux)                    | `false` |
| `--claude`           | `-c`  | Auto-start Claude Code                                        | `false` |
| `--copy-file <file>` |       | Copy files from current worktree (including gitignored files) | none    |
| `--shell`            |       | Enter shell after creation                                    | `false` |
| `--exec <command>`   |       | Execute command after creation                                | none    |

## Creating from Issue Number

When you specify an issue number, it automatically fetches issue information using the GitHub API and saves it as metadata:

```bash
# Any of these formats work
mst create 123
mst create #123
mst create issue-123
```

Retrieved information:

- Issue title
- Issue body
- Labels
- Assignees
- Milestone
- Author information



## tmux Integration

### Session Creation with Auto-Attach

Using the `--tmux` option creates a new tmux session and automatically attaches to it:

```bash
# Creates session and attaches immediately
mst create feature/new-feature --tmux
```

**Behavior:**
- If outside tmux: Creates session and attaches using `tmux attach`
- If inside tmux: Creates session and switches using `tmux switch-client`

### Pane Splitting (when already in tmux)

For quick development without leaving your current tmux session:

```bash
# Split horizontally (left/right)
mst create feature/new-feature --tmux-h

# Split vertically (top/bottom)
mst create feature/new-feature --tmux-v
```

These options create a new pane in your current tmux window and immediately switch to the worktree directory.

## Claude Code Integration

Using the `--claude` option automatically starts Claude Code after orchestra member creation:

```bash
mst create feature/ai-feature --tmux --claude
```

Executed processes:

1. Worktree creation
2. tmux session/window creation (with auto-attach if using `--tmux`)
3. Claude Code startup
4. Initial command execution (if specified in configuration)

## Copying Files Feature

Using the `--copy-file` option allows you to copy files from the current worktree to the new one, including gitignored files:

```bash
# Copy environment files
mst create feature/api --copy-file .env --copy-file .env.local

# Multiple files can be specified
mst create feature/new --copy-file .env --copy-file config/local.json --copy-file .npmrc
```

Features:

- **Gitignore detection**: Automatically detects and can copy gitignored files
- **Multiple files**: Can specify multiple files by using the option multiple times
- **Preserves directory structure**: Maintains the original directory structure when copying

## Configuration File Integration

Settings from `.maestro.json` are automatically applied:

```json
{
  "worktrees": {
    "path": ".git/orchestra-members",
    "branchPrefix": "feature/"
  },
  "development": {
    "autoSetup": true,
    "defaultEditor": "cursor"
  },
  "postCreate": {
    "copyFiles": [".env", ".env.local"],
    "commands": ["pnpm install", "pnpm run dev"]
  },
  "hooks": {
    "afterCreate": ["npm install", "npm run setup"]
  }
}
```

### postCreate Configuration

The `postCreate` section allows automatic execution of file copying and commands after worktree creation:

- **copyFiles**: Array of files to copy automatically (including gitignored files)
- **commands**: Array of commands to execute in the new worktree

### hooks.afterCreate

The `afterCreate` hook supports both string and array formats:

```json
// String format (backward compatible)
"afterCreate": "npm install"

// Array format (for multiple commands)
"afterCreate": ["npm install", "npm run setup", "npm run test"]
```

## Tips & Tricks

### 1. Utilize Shortcuts

```bash
# Convenient to alias commonly used combinations
alias mstf='mst create --tmux --claude --setup'

# Usage example
mstf feature/new-feature
```

### 2. Issue-Driven Development

```bash
# Check issues
gh issue list

# Create orchestra member by issue number
mst create 123 --tmux --claude

# Start development
# Issue information is automatically saved as metadata
```

### 3. Parallel Development Flow

```bash
# Main feature development
mst create feature/main-feature --tmux

# Sub-feature development (separate window)
mst create feature/sub-feature --tmux --new-window

# Bug fix (yet another window)
mst create bugfix/urgent-fix --tmux --new-window
```

## Error Handling

### Common Errors

1. **Branch already exists**

   ```
   Error: Branch 'feature/new-feature' already exists
   ```

   Solution: Use a different branch name or delete the existing branch

2. **Base branch not found**

   ```
   Error: Base branch 'develop' not found
   ```

   Solution: Specify an existing branch or run `git fetch`

3. **GitHub authentication error**
   ```
   Error: GitHub authentication failed
   ```
   Solution: Authenticate GitHub CLI with `gh auth login`

## Related Commands

- [`mst list`](./list.md) - Display list of created orchestra members
- [`mst delete`](./delete.md) - Delete orchestra members
- [`mst github`](./github.md) - Create orchestra members from GitHub PR/Issues

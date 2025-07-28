# 🔸 where

Command to display the filesystem path of orchestra members (Git worktrees). Useful for navigation, scripting, and integration with other tools.

## Overview

```bash
mst where [branch-name] [options]
mst w [branch-name] [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Show path of specific worktree
mst where feature/auth

# Show current worktree path
mst where --current

# Interactive selection with fzf
mst where --fzf
```

### Advanced Usage

```bash
# Navigate to worktree using output
cd $(mst where feature/auth)

# Open worktree in editor
code $(mst where feature/api)

# Use in scripts
WORKTREE_PATH=$(mst where --current)
echo "Working in: $WORKTREE_PATH"
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--fzf` | | Interactive selection with fzf | `false` |
| `--current` | | Show current worktree path | `false` |

## Usage Patterns

### Direct Path Lookup

Path display format depends on the `ui.pathDisplay` configuration setting in `.maestro.json`:

```bash
# Get path for specific branch
mst where feature/authentication

# With "pathDisplay": "absolute" (default)
# Output: /project/.git/orchestrations/feature-authentication

# With "pathDisplay": "relative"  
# Output: .git/orchestrations/feature-authentication
```

### Current Location

```bash
# Show current worktree path
mst where --current

# With "pathDisplay": "absolute" (default)
# Output: /project/.git/orchestrations/feature-auth

# With "pathDisplay": "relative"
# Output: .git/orchestrations/feature-auth
```

### Interactive Selection

```bash
# Select worktree interactively
mst where --fzf
# Shows fzf interface with all worktrees
# Path display in fzf selection screen follows ui.pathDisplay setting
# Returns selected worktree path in the configured format
```

## Integration Examples

### Navigation

```bash
# Quick navigation function
goto() {
  cd $(mst where $1)
}

# Usage
goto feature/auth
```

### Editor Integration

```bash
# Open worktree in editor
edit_worktree() {
  code $(mst where $1)
}

# Usage
edit_worktree feature/api
```

### Scripting

```bash
# Process all worktrees
for branch in $(mst list --names); do
  path=$(mst where $branch)
  echo "Processing $branch at $path"
  # Do something with each worktree
done
```

## Error Handling

### Common Errors

1. **Branch not found**
   ```
   エラー: ブランチ 'nonexistent' のworktreeが見つかりません
   ```
   Solution: Check available worktrees with `mst list`

2. **Not in Git repository**
   ```
   エラー: このディレクトリはGitリポジトリではありません
   ```
   Solution: Run command in a Git repository

## Related Commands

- [`mst list`](./list.md) - List all available worktrees
- [`mst create`](./create.md) - Create new worktrees
- [`mst shell`](./shell.md) - Enter worktree shell environment
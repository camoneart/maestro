# 🔸 delete

Command for orchestra members (Git worktrees) to exit the stage. Provides complete cleanup by removing both the worktree directory and associated local branch.

## Overview

```bash
mst delete <branch-name> [options]
mst rm <branch-name> [options]  # alias
```

### What gets deleted

When an orchestra member exits the stage, Maestro performs a **complete cleanup**:

1. **Worktree directory** - The physical directory containing the branch's files
2. **Empty parent directories** - Any empty directories left behind after worktree deletion
   - Automatically cleans up empty parent directories (useful for branches like `feature/api` which would leave empty `feature/` directory)
   - Recursively removes empty directories up to the repository base directory
   - Provides visual feedback showing which directories were cleaned up with the message: `🧹 Removed empty directory: {directory-name}`
3. **Local branch** - The Git branch associated with the worktree
   - First attempts safe deletion with `git branch -d`
   - Automatically retries with `git branch -D` if the branch is not fully merged
   - Ensures complete cleanup without manual intervention
4. **tmux session** - The tmux session with the same name as the worktree (if exists)
   - Automatically terminates the session when deleting the worktree
   - Session names are normalized to handle special characters (e.g., `feature/api-auth` becomes `feature-api-auth`)
   - Use `--keep-session` to preserve the tmux session after deletion

This ensures no orphaned branches, sessions, or empty directories remain after worktree deletion.

## Usage Examples

### Basic Usage

```bash
# Orchestra member exits the stage (removes both worktree and local branch)
mst delete feature/old-feature

# Force exit (even with uncommitted changes)
mst delete feature/old-feature --force

# Keep tmux session after worktree exits
mst delete feature/old-feature --keep-session

# Select with fzf for exit
mst delete --fzf
```

### Batch Exit

```bash
# Merged orchestra members exit in batch
mst delete --merged

# Orchestra members older than 30 days exit
mst delete --older-than 30

# Dry run (don't actually process exits)
mst delete --merged --dry-run
```

## Options

| Option                | Short | Description                                        | Default |
| --------------------- | ----- | -------------------------------------------------- | ------- |
| `--force`             | `-f`  | Force exit (ignore uncommitted changes)           | `false` |
| `--remove-remote`     | `-r`  | Also delete remote branch                          | `false` |
| `--keep-session`      |       | Keep tmux session after worktree exits            | `false` |
| `--fzf`               |       | Select with fzf for exit                           | `false` |
| `--current`           |       | Current worktree exits                             | `false` |
| `--dry-run`           | `-n`  | Show exit targets without actually processing      | `false` |
| `--yes`               | `-y`  | Skip confirmation prompts                          | `false` |

## Exit Confirmation

Normally, a confirmation prompt is displayed before orchestra members exit. The path display format follows the `ui.pathDisplay` configuration setting in `.maestro.json`:

**With `"pathDisplay": "absolute"` (default):**
```
🪽  Are you sure you want orchestra member 'feature/old-feature' to exit?
   Branch: feature/old-feature
   Path: /Users/user/project/.git/orchestra-members/feature-old-feature
   Status: 3 uncommitted changes

   ⚠️  This will remove:
   • Worktree directory and all its contents
   • Any empty parent directories (e.g., empty 'feature/' directory)
   • Local branch 'feature/old-feature'

   This action cannot be undone.

? Orchestra member exits? (y/N)
```

**With `"pathDisplay": "relative"`:**
```
🪽  Are you sure you want orchestra member 'feature/old-feature' to exit?
   Branch: feature/old-feature
   Path: .git/orchestra-members/feature-old-feature
   Status: 3 uncommitted changes

   ⚠️  This will remove:
   • Worktree directory and all its contents
   • Any empty parent directories (e.g., empty 'feature/' directory)
   • Local branch 'feature/old-feature'

   This action cannot be undone.

? Orchestra member exits? (y/N)
```

## Safe Exit

### When There Are Uncommitted Changes

```bash
# Normal exit fails
mst delete feature/work-in-progress
# Error: Worktree has uncommitted changes. Use --force to process exit anyway.

# Check changes
mst exec feature/work-in-progress git status

# Save changes before exit
mst exec feature/work-in-progress git stash
mst delete feature/work-in-progress

# Or force exit
mst delete feature/work-in-progress --force
```

### Checking Merged Branches

```bash
# Check merged orchestra members
mst delete --merged --dry-run

# Example output:
# The following merged worktrees would exit:
# - feature/completed-feature (merged to main)
# - bugfix/fixed-bug (merged to main)
# - feature/old-feature (merged to develop)

# Actually process exits
mst delete --merged --yes
```

## tmux Session Management

By default, Maestro automatically cleans up tmux sessions when orchestra members exit to prevent orphaned sessions. Session names are normalized to handle special characters in branch names (slashes, spaces, etc. are converted to hyphens):

### Default Behavior (Auto-cleanup)

```bash
# Orchestra member exits with cleanup of both worktree and tmux session (if it exists)
mst delete feature/my-feature

# Example output:
# ✅ Orchestra member 'feature/my-feature' exited
# 🧹 Removed empty directory: feature
# ✅ tmux session 'feature-my-feature' terminated

# Works with complex branch names too
mst delete feature/api/auth-handler

# Example output:
# ✅ Orchestra member 'feature/api/auth-handler' exited
# 🧹 Removed empty directory: feature/api
# 🧹 Removed empty directory: feature
# ✅ tmux session 'feature-api-auth-handler' terminated
```

### Preserving tmux Sessions

If you want to keep the tmux session active after orchestra member exits:

```bash
# Keep tmux session after orchestra member exits
mst delete feature/my-feature --keep-session

# Example output:
# ✅ Orchestra member 'feature/my-feature' exited
# 🧹 Removed empty directory: feature
# ℹ️  tmux session 'feature-my-feature' preserved

# Works with complex branch names too
mst delete feature/api/user-management --keep-session

# Example output:
# ✅ Orchestra member 'feature/api/user-management' exited
# 🧹 Removed empty directory: feature/api
# 🧹 Removed empty directory: feature
# ℹ️  tmux session 'feature-api-user-management' preserved
```

### Use Cases for --keep-session

- **Continuing work in the same session**: You want to recreate the worktree later but keep your tmux environment
- **Session has other windows**: Your tmux session contains additional windows/panes you want to preserve
- **Custom session setup**: The session has been customized with specific layouts or configurations

```bash
# Example workflow
mst delete feature/temp-branch --keep-session  # Orchestra member exits, keep session
mst create feature/new-branch --tmux           # Create new worktree in existing session
```

## Utilizing Batch Exit

### Cleanup Old Orchestra Members

```bash
# Check orchestra members not updated for 60+ days
mst delete --older-than 60 --dry-run

# Confirm and process exits
mst delete --older-than 60
```

### Custom Condition Exit

```bash
# Orchestra members with specific prefix exit
mst list --json | jq -r '.worktrees[] | select(.branch | startswith("experiment/")) | .branch' | while read branch; do
  mst delete "$branch" --yes
done

# PR-related orchestra members that are closed exit
mst list --json | jq -r '.worktrees[] | select(.metadata.githubPR.state == "closed") | .branch' | while read branch; do
  mst delete "$branch"
done
```

## Hook Feature

You can set hooks before and after orchestra member exits in `.mst.json`:

```json
{
  "hooks": {
    "beforeDelete": "echo \"Orchestra member exiting: $ORCHESTRA_MEMBER\"",
    "afterDelete": "echo \"Orchestra member exited: $ORCHESTRA_MEMBER\""
  }
}
```

## Error Handling

### Common Errors

1. **Orchestra member not found**

   ```
   Error: Worktree 'feature/non-existent' not found
   ```

   Solution: Check the correct branch name with `mst list`

2. **Attempting to exit current orchestra member**

   ```
   Error: Current directory is inside the worktree to be exited.
   Please run from a different directory.
   Example: cd .. && mst delete feature/current-branch
   ```

   Solution: Move to a different directory (outside the worktree) before exit

3. **Remote branch still exists**
   ```
   Warning: Remote branch 'origin/feature/old-feature' still exists
   ```
   Action: Also delete remote branch with `mst delete feature/old-feature --remove-remote` or manually with `git push origin --delete feature/old-feature`

## Best Practices

### 1. Regular Cleanup

```bash
#!/bin/bash
# cleanup-worktrees.sh

echo "🧹 Cleaning up worktrees..."

# Delete merged ones
mst delete --merged --yes

# Delete those older than 90 days
mst delete --older-than 90 --yes

# Display statistics
echo "Remaining worktrees:"
mst list | grep -c "^  "
```

### 2. Pre-exit Confirmation Flow

```bash
# Check exit target
BRANCH="feature/to-delete"

# 1. Check status
mst exec "$BRANCH" git status

# 2. Check latest commits
mst exec "$BRANCH" git log --oneline -5

# 3. Check differences with remote
mst exec "$BRANCH" git log origin/main..HEAD --oneline

# 4. Process exit if no issues
mst delete "$BRANCH"
```

### 3. Safe Exit Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias mst-safe-exit='mst delete --dry-run'
alias mst-cleanup='mst delete --merged --older-than 30'

# Usage examples
mst-safe-exit feature/old    # Check exit targets
mst-cleanup --yes            # Cleanup old orchestra members
```

## Tips & Tricks

### Exit Both Remote and Local

```bash
# Since v2.7.3, the --remove-remote option makes this simpler
mst delete feature/old-feature --remove-remote

# Or use a function for more control
exit_worktree_and_remote() {
  local branch=$1

  # Orchestra member exits (worktree + local branch)
  mst delete "$branch" --yes

  # Also delete remote branch
  git push origin --delete "$branch" 2>/dev/null || echo "Remote branch not found"
}

# Usage example
exit_worktree_and_remote feature/old-feature
```

### Record Exit History

```bash
# Record information before exit
mst list --json > worktrees-backup-$(date +%Y%m%d).json

# Execute exit
mst delete feature/old-feature

# Reference restoration information if needed
cat worktrees-backup-*.json | jq '.worktrees[] | select(.branch == "feature/old-feature")'
```

## Related Commands

- [`mst list`](./list.md) - Display list of orchestra members
- [`mst create`](./create.md) - Create new orchestra members
- [`mst health`](./health.md) - Check orchestra member health
- [`mst snapshot`](./snapshot.md) - Create snapshots before exit

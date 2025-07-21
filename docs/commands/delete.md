# mst delete

Command to delete orchestra members (Git Worktrees). Cleans up unnecessary orchestra members and frees disk space.

## Overview

```bash
mst delete <branch-name> [options]
mst rm <branch-name> [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Delete orchestra member
mst delete feature/old-feature

# Force delete (delete even with uncommitted changes)
mst delete feature/old-feature --force

# Select with fzf and delete
mst delete --fzf
```

### Batch Deletion

```bash
# Delete merged orchestra members in batch
mst delete --merged

# Delete orchestra members older than 30 days
mst delete --older-than 30

# Dry run (don't actually delete)
mst delete --merged --dry-run
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--force` | `-f` | Force delete (ignore uncommitted changes) | `false` |
| `--fzf` | | Select with fzf and delete | `false` |
| `--merged` | `-m` | Delete merged orchestra members | `false` |
| `--older-than <days>` | `-o` | Delete orchestra members older than specified days | none |
| `--dry-run` | `-n` | Show deletion targets without actually deleting | `false` |
| `--yes` | `-y` | Skip confirmation prompts | `false` |

## Deletion Confirmation

Normally, a confirmation prompt is displayed before deletion:

```
🗑️  Are you sure you want to delete worktree 'feature/old-feature'?
   Branch: feature/old-feature
   Path: /Users/user/project/.git/orchestra-members/feature-old-feature
   Status: 3 uncommitted changes
   
   This action cannot be undone.
   
? Delete worktree? (y/N)
```

## Safe Deletion

### When There Are Uncommitted Changes

```bash
# Normal deletion fails
mst delete feature/work-in-progress
# Error: Worktree has uncommitted changes. Use --force to delete anyway.

# Check changes
mst exec feature/work-in-progress git status

# Save changes before deletion
mst exec feature/work-in-progress git stash
mst delete feature/work-in-progress

# Or force delete
mst delete feature/work-in-progress --force
```

### Checking Merged Branches

```bash
# Check merged orchestra members
mst delete --merged --dry-run

# Example output:
# Would delete the following merged worktrees:
# - feature/completed-feature (merged to main)
# - bugfix/fixed-bug (merged to main)
# - feature/old-feature (merged to develop)

# Actually delete
mst delete --merged --yes
```

## Utilizing Batch Deletion

### Cleanup Old Orchestra Members

```bash
# Check orchestra members not updated for 60+ days
mst delete --older-than 60 --dry-run

# Confirm and delete
mst delete --older-than 60
```

### Custom Condition Deletion

```bash
# Delete orchestra members with specific prefix
mst list --json | jq -r '.worktrees[] | select(.branch | startswith("experiment/")) | .branch' | while read branch; do
  mst delete "$branch" --yes
done

# Delete PR-related orchestra members that are closed
mst list --json | jq -r '.worktrees[] | select(.metadata.githubPR.state == "closed") | .branch' | while read branch; do
  mst delete "$branch"
done
```

## Hook Feature

You can set hooks before and after deletion in `.mst.json`:

```json
{
  "hooks": {
    "beforeDelete": "echo \"Deleting worktree: $ORCHESTRA_MEMBER\"",
    "afterDelete": "echo \"Worktree deleted: $ORCHESTRA_MEMBER\""
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

2. **Attempting to delete current orchestra member**
   ```
   Error: Cannot delete the current worktree
   ```
   Solution: Move to another orchestra member before deletion

3. **Remote branch still exists**
   ```
   Warning: Remote branch 'origin/feature/old-feature' still exists
   ```
   Action: Also delete remote branch with `git push origin --delete feature/old-feature`

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

### 2. Pre-deletion Confirmation Flow

```bash
# Check deletion target
BRANCH="feature/to-delete"

# 1. Check status
mst exec "$BRANCH" git status

# 2. Check latest commits
mst exec "$BRANCH" git log --oneline -5

# 3. Check differences with remote
mst exec "$BRANCH" git log origin/main..HEAD --oneline

# 4. Delete if no issues
mst delete "$BRANCH"
```

### 3. Safe Deletion Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias mst-safe-delete='mst delete --dry-run'
alias mst-cleanup='mst delete --merged --older-than 30'

# Usage examples
mst-safe-delete feature/old  # Check deletion targets
mst-cleanup --yes            # Cleanup old orchestra members
```

## Tips & Tricks

### Delete Both Remote and Local

```bash
# Function to delete both local and remote
delete_worktree_and_remote() {
  local branch=$1
  
  # Delete local orchestra member
  mst delete "$branch" --yes
  
  # Also delete remote branch
  git push origin --delete "$branch" 2>/dev/null || echo "Remote branch not found"
}

# Usage example
delete_worktree_and_remote feature/old-feature
```

### Record Deletion History

```bash
# Record information before deletion
mst list --json > worktrees-backup-$(date +%Y%m%d).json

# Execute deletion
mst delete feature/old-feature

# Reference restoration information if needed
cat worktrees-backup-*.json | jq '.worktrees[] | select(.branch == "feature/old-feature")'
```

## Related Commands

- [`mst list`](./list.md) - Display list of orchestra members
- [`mst create`](./create.md) - Create new orchestra members
- [`mst health`](./health.md) - Check orchestra member health
- [`mst snapshot`](./snapshot.md) - Create snapshots before deletion

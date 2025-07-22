# 🔸 snapshot

Command to save and restore the current state of orchestra members (Git Worktrees) as snapshots. You can create backups before experimental changes or at important work milestones.

## Overview

```bash
mst snapshot [options]
mst snap [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Create snapshot of current orchestra member
mst snapshot

# Create snapshot with message
mst snapshot -m "State before feature implementation"

# Save changes to stash and create snapshot
mst snapshot --stash

# Create snapshots of all orchestra members
mst snapshot --all
```

### Snapshot Management

```bash
# Display snapshot list
mst snapshot --list

# Display list in JSON format
mst snapshot --list --json

# Restore snapshot
mst snapshot --restore snapshot-20250120-103045

# Delete snapshot
mst snapshot --delete snapshot-20250120-103045
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--message <msg>` | `-m` | Snapshot description | none |
| `--stash` | `-s` | Stash uncommitted changes | `false` |
| `--all` | `-a` | Snapshot all orchestra members | `false` |
| `--list` | `-l` | Display snapshot list | `false` |
| `--restore <id>` | `-r` | Restore snapshot | none |
| `--delete <id>` | `-d` | Delete snapshot | none |
| `--json` | `-j` | Output in JSON format | `false` |
| `--force` | `-f` | Execute without confirmation | `false` |

## Snapshot Contents

Snapshots save the following information:

- Git state (branch, HEAD, tracking info)
- Commit history (latest 10 commits)
- Staged files
- Modified files
- Untracked files
- Worktree metadata
- Stash (when using `--stash` option)

### Snapshot File Format

```json
{
  "id": "snapshot-20250120-103045",
  "worktree": "feature/auth",
  "timestamp": "2025-01-20T10:30:45Z",
  "message": "State before feature implementation",
  "git": {
    "branch": "feature/auth",
    "head": "abc123def456",
    "tracking": "origin/feature/auth",
    "ahead": 2,
    "behind": 0
  },
  "changes": {
    "staged": ["src/auth.js", "src/login.js"],
    "modified": ["README.md"],
    "untracked": ["test.log"]
  },
  "commits": [
    {
      "hash": "abc123def456",
      "message": "feat: add login functionality",
      "author": "user@example.com",
      "date": "2025-01-20T09:00:00Z"
    }
  ],
  "stash": {
    "ref": "stash@{0}",
    "message": "WIP on feature/auth: abc123d feat: add login"
  }
}
```

## Snapshot List

### Normal Output

```bash
mst snapshot --list
```

Example output:

```
📸 Snapshots:

feature/auth:
  • snapshot-20250120-103045 - "State before feature implementation" (2 hours ago)
  • snapshot-20250119-150000 - "Before bug fix" (1 day ago)

bugfix/memory-leak:
  • snapshot-20250120-090000 - "Before debugging start" (4 hours ago)

Total: 3 snapshots across 2 worktrees
```

### JSON Output (`--json`)

```json
{
  "snapshots": [
    {
      "id": "snapshot-20250120-103045",
      "worktree": "feature/auth",
      "timestamp": "2025-01-20T10:30:45Z",
      "message": "State before feature implementation",
      "size": "2.3MB",
      "hasStash": false
    },
    {
      "id": "snapshot-20250119-150000",
      "worktree": "feature/auth",
      "timestamp": "2025-01-19T15:00:00Z",
      "message": "Before bug fix",
      "size": "1.8MB",
      "hasStash": true
    }
  ],
  "summary": {
    "total": 3,
    "worktrees": 2,
    "totalSize": "5.9MB"
  }
}
```

## Snapshot Restoration

### Basic Restoration

```bash
# Restore by specifying snapshot ID
mst snapshot --restore snapshot-20250120-103045
```

Restoration process:

1. Temporarily save current state
2. Move HEAD to specified commit
3. Restore file change states
4. Apply stash if available

### Confirmation During Restoration

```
🔄 Restoring snapshot: snapshot-20250120-103045
   Worktree: feature/auth
   Created: 2025-01-20 10:30:45
   Message: "State before feature implementation"

Current state will be backed up as: snapshot-20250120-140000-backup

? Proceed with restoration? (y/N)
```

## Advanced Usage Examples

### Managing Experimental Changes

```bash
# 1. Create snapshot before experiment
mst snapshot -m "Stable version before experiment"

# 2. Make experimental changes
# ... code changes ...

# 3. If experiment fails, revert
mst snapshot --list  # Check ID
mst snapshot --restore snapshot-20250120-103045

# 4. If experiment succeeds, create new snapshot
mst snapshot -m "Experiment successful - new feature complete"
```

### Regular Backup

```bash
#!/bin/bash
# daily-snapshot.sh

# Create snapshots for active orchestra members
mst list --json | jq -r '.worktrees[] | select(.ahead > 0 or .behind > 0) | .branch' | while read branch; do
  echo "Creating snapshot for $branch..."
  mst exec "$branch" mst snapshot -m "Daily backup - $(date +%Y-%m-%d)"
done
```

### Pre-deployment Checkpoint

```bash
# Save state before deployment
deploy_with_snapshot() {
  local branch=$1

  # Create snapshot
  mst exec "$branch" mst snapshot -m "Pre-deployment snapshot"

  # Execute deployment
  if ! deploy_script.sh; then
    echo "Deployment failed! Rolling back..."
    LATEST_SNAPSHOT=$(mst snapshot --list --json | jq -r '.snapshots[0].id')
    mst snapshot --restore "$LATEST_SNAPSHOT"
    return 1
  fi

  echo "Deployment successful!"
}
```

## Snapshot Management

### Delete Old Snapshots

```bash
# Delete snapshots older than 7 days
mst snapshot --list --json | jq -r '.snapshots[] | select(.timestamp < (now - 604800 | strftime("%Y-%m-%dT%H:%M:%SZ"))) | .id' | while read snapshot; do
  mst snapshot --delete "$snapshot"
done
```

### Export Snapshots

```bash
# Export snapshot as archive
SNAPSHOT_ID="snapshot-20250120-103045"
EXPORT_DIR="./snapshot-exports"

mkdir -p "$EXPORT_DIR"
mst snapshot --export "$SNAPSHOT_ID" --output "$EXPORT_DIR/$SNAPSHOT_ID.tar.gz"
```

### Compare Snapshots

```bash
# Show differences between two snapshots
mst snapshot --diff snapshot-20250120-103045 snapshot-20250120-140000
```

## Storage Management

Snapshots are stored in `.git/orchestrations/.snapshots/`:

```bash
# Check storage usage
du -sh .git/orchestrations/.snapshots/

# Detect large snapshots
find .git/orchestrations/.snapshots/ -type f -size +10M -exec ls -lh {} \;
```

## Configuration

Customize snapshot behavior in `.maestro.json`:

```json
{
  "snapshot": {
    "autoCleanupDays": 30,
    "maxSnapshots": 50,
    "compression": true,
    "includeNodeModules": false,
    "excludePatterns": ["*.log", "*.tmp", "dist/*", "build/*"]
  }
}
```

## Best Practices

### 1. Naming Conventions

```bash
# Use consistent naming conventions
mst snapshot -m "feat: before authentication implementation"
mst snapshot -m "fix: before memory leak fix"
mst snapshot -m "refactor: before API structure change"
```

### 2. Habitually Create Before Important Changes

```bash
# Automate with Git hooks
cat > .git/hooks/pre-rebase << 'EOF'
#!/bin/bash
echo "Creating snapshot before rebase..."
mst snapshot -m "Auto-snapshot before rebase"
EOF
chmod +x .git/hooks/pre-rebase
```

### 3. Team Sharing

```bash
# Share snapshots with team
mst snapshot --export snapshot-20250120-103045 --share

# Import shared snapshot
mst snapshot --import shared-snapshot-20250120-103045.tar.gz
```

## Tips & Tricks

### Snapshot Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias mst-backup='mst snapshot -m "Quick backup - $(date +%Y-%m-%d_%H:%M)"'
alias mst-restore-latest='mst snapshot --restore $(mst snapshot --list --json | jq -r ".snapshots[0].id")'

# Usage examples
mst-backup          # Quick backup
mst-restore-latest  # Restore to latest snapshot
```

### Snapshot Statistics

```bash
# Display snapshot statistics
mst snapshot --list --json | jq '
  {
    total: .summary.total,
    avgSize: (.snapshots | map(.size | gsub("MB"; "") | tonumber) | add / length),
    oldestDays: (
      .snapshots |
      map(.timestamp | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime) |
      min |
      ((now - .) / 86400 | floor)
    )
  }
'
```

## Related Commands

- [`mst list`](./list.md) - Check orchestra members to snapshot
- [`mst health`](./health.md) - Health check before snapshots
- [`mst sync`](./sync.md) - Sync after snapshots
- [`mst history`](./history.md) - Manage alongside Claude Code history

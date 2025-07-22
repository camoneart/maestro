# 🔸 health

Command to check the health of orchestra members (Git Worktrees), detect and fix issues. Provides comprehensive diagnosis including detection of old orchestra members, uncommitted changes, and synchronization status with remote branches.

## Overview

```bash
mst health [options]
mst check [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Check health of all orchestra members
mst health

# Auto-fix fixable issues
mst health --fix

# Delete old orchestra members (default: 30+ days)
mst health --prune

# Display detailed information
mst health --verbose
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--fix` | `-f` | Auto-fix fixable issues | `false` |
| `--prune` | `-p` | Delete old orchestra members | `false` |
| `--days <n>` | `-d` | Days to consider as old | `30` |
| `--verbose` | `-v` | Display detailed information | `false` |
| `--json` | `-j` | Output in JSON format | `false` |
| `--dry-run` | `-n` | Show results without actually fixing | `false` |

## Detected Issues

### stale (Old Orchestra Members)

Orchestra members not updated for a long time:

```
⚠️  stale: feature/old-feature
   Last commit: 45 days ago
   Recommendation: Review and delete if no longer needed
```

### orphaned (Orphaned Orchestra Members)

Orchestra members without remote branches:

```
❌ orphaned: feature/deleted-remote
   Remote branch 'origin/feature/deleted-remote' not found
   Recommendation: Delete worktree or push to remote
```

### diverged (Significantly Diverged)

Orchestra members that have diverged significantly from main branch:

```
⚠️  diverged: feature/long-running
   Behind main: 152 commits
   Ahead of main: 23 commits
   Recommendation: Rebase or merge with main branch
```

### uncommitted (Uncommitted Changes)

Orchestra members with uncommitted changes:

```
⚠️  uncommitted: feature/work-in-progress
   Modified files: 5
   Untracked files: 3
   Recommendation: Commit or stash changes
```

### conflict (Merge Conflicts)

Orchestra members with unresolved merge conflicts:

```
❌ conflict: feature/merge-conflict
   Conflicted files: 2
   Recommendation: Resolve conflicts and commit
```

### missing (Missing Directory)

Orchestra members without existing directories:

```
❌ missing: feature/moved-worktree
   Directory not found: /path/to/worktree
   Recommendation: Remove worktree entry
```

## Output Formats

### Normal Output

```
🏥 Orchestra Health Check

Checking 8 worktrees...

✅ main - healthy
⚠️  feature/auth - uncommitted (3 modified files)
❌ feature/old-ui - stale (60 days old)
⚠️  bugfix/memory-leak - diverged (behind: 45, ahead: 12)
✅ feature/api - healthy
❌ experiment/ml - orphaned (remote branch deleted)
⚠️  docs/update - uncommitted (2 untracked files)
✅ feature/dashboard - healthy

Summary:
- Total: 8
- Healthy: 3 (37.5%)
- Warnings: 3 (37.5%)
- Errors: 2 (25.0%)

Run 'mst health --fix' to auto-fix some issues
Run 'mst health --prune' to remove stale worktrees
```

### JSON Output (`--json`)

```json
{
  "timestamp": "2025-01-20T10:30:00Z",
  "worktrees": [
    {
      "branch": "main",
      "path": "/Users/user/project",
      "status": "healthy",
      "issues": []
    },
    {
      "branch": "feature/auth",
      "path": "/Users/user/project/.git/orchestra-members/feature-auth",
      "status": "warning",
      "issues": [
        {
          "type": "uncommitted",
          "severity": "warning",
          "details": {
            "modified": 3,
            "untracked": 0,
            "deleted": 0
          },
          "recommendation": "Commit or stash changes"
        }
      ]
    }
  ],
  "summary": {
    "total": 8,
    "healthy": 3,
    "warning": 3,
    "error": 2,
    "fixable": 4
  }
}
```

## Auto-fix Feature

The `--fix` option can automatically fix the following issues:

### Fix orphaned (Orphaned)

```bash
mst health --fix
```

Execution:

- Remove local tracking information when remote branch is deleted
- Confirm whether to create new remote branch if needed

### Fix missing (Missing Directory)

Automatically remove Worktree entries:

```bash
git worktree prune
```

### Fix Configuration Inconsistencies

Detect and fix Worktree configuration inconsistencies

## Pruning (Delete Old Orchestra Members)

```bash
# Check orchestra members older than 30 days
mst health --prune --dry-run

# Actually delete
mst health --prune

# Change to 60+ days
mst health --prune --days 60
```

Confirmation during pruning:

```
The following stale worktrees will be deleted:
- feature/old-ui (60 days old)
- experiment/abandoned (45 days old)
- bugfix/fixed-long-ago (90 days old)

? Proceed with deletion? (y/N)
```

## Regular Maintenance

### Cron Job Setup

```bash
# Daily health check at 9 AM
0 9 * * * cd /path/to/project && mst health --json > /tmp/mst-health.json

# Weekly cleanup of old orchestra members
0 10 * * 1 cd /path/to/project && mst health --prune --days 30 --yes
```

### CI/CD Usage

```yaml
# .github/workflows/health-check.yml
name: Worktree Health Check

on:
  schedule:
    - cron: '0 0 * * *' # Daily execution

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install mst
        run: npm install -g maestro
      - name: Run health check
        run: |
          mst health --json > health-report.json
          if [ $(jq '.summary.error' health-report.json) -gt 0 ]; then
            echo "::error::Worktree health check failed"
            exit 1
          fi
```

## Custom Checks

### Generate Health Report

```bash
#!/bin/bash
# health-report.sh

echo "# Worktree Health Report - $(date)"
echo

# Basic information
echo "## Summary"
mst health --json | jq -r '
  "- Total worktrees: \(.summary.total)",
  "- Healthy: \(.summary.healthy) (\(.summary.healthy / .summary.total * 100 | floor)%)",
  "- Issues found: \(.summary.warning + .summary.error)"
'

echo
echo "## Detailed Issues"

# Details of problematic orchestra members
mst health --json | jq -r '
  .worktrees[] |
  select(.status != "healthy") |
  "### \(.branch)",
  "- Status: \(.status)",
  "- Path: \(.path)",
  (.issues[] | "- Issue: \(.type) - \(.recommendation)")
'
```

### Issue-specific Handling

```bash
# Batch process orchestra members with uncommitted changes
mst health --json | jq -r '.worktrees[] | select(.issues[].type == "uncommitted") | .branch' | while read branch; do
  echo "Processing $branch..."
  mst exec "$branch" git stash push -m "Auto-stash by health check"
done

# Delete orphaned orchestra members
mst health --json | jq -r '.worktrees[] | select(.issues[].type == "orphaned") | .branch' | while read branch; do
  mst delete "$branch" --force
done
```

## Threshold Settings

Set health check thresholds in `.mst.json`:

```json
{
  "health": {
    "staleThresholdDays": 30,
    "divergedThresholdCommits": 50,
    "autoFixEnabled": true,
    "checks": {
      "stale": true,
      "orphaned": true,
      "diverged": true,
      "uncommitted": true,
      "conflict": true,
      "missing": true
    }
  }
}
```

## Tips & Tricks

### Calculate Health Score

```bash
# Calculate health score (out of 100)
SCORE=$(mst health --json | jq '
  .summary.healthy / .summary.total * 100 | floor
')

echo "Worktree health score: $SCORE/100"

# Warning if below 80
if [ $SCORE -lt 80 ]; then
  echo "⚠️  Health score is low. Run 'mst health --fix' to improve."
fi
```

### Auto-notification for Issues

```bash
# Slack notification example
ISSUES=$(mst health --json | jq '.summary.error + .summary.warning')

if [ $ISSUES -gt 0 ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"⚠️ Worktree health check: $ISSUES issues found\"}" \
    YOUR_SLACK_WEBHOOK_URL
fi
```

### Interactive Fixing

```bash
# Check and fix issues one by one
mst health --json | jq -r '.worktrees[] | select(.status != "healthy") | .branch' | while read branch; do
  echo "=== $branch ==="
  mst health --verbose | grep -A5 "$branch"

  read -p "Fix this issue? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Implement fixing logic here
    echo "Fixing $branch..."
  fi
done
```

## Related Commands

- [`mst list`](./list.md) - Display orchestra member list and status
- [`mst delete`](./delete.md) - Delete problematic orchestra members
- [`mst sync`](./sync.md) - Sync diverged orchestra members
- [`mst snapshot`](./snapshot.md) - Create snapshots before fixing

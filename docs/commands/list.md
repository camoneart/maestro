# mst list

Command to display a list of created orchestra members (Git Worktrees). You can check the status, metadata, and GitHub integration status of each orchestra member.

## Overview

```bash
mst list [options]
mst ls [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Display list of orchestra members
mst list

# Output in JSON format
mst list --json

# Display with metadata
mst list --metadata

# Select with fzf (outputs selected branch name)
mst list --fzf

# Display full paths
mst list --full-path
```

## Options

| Option         | Short  | Description                            | Default  |
| -------------- | ------ | -------------------------------------- | -------- |
| `--json`       | `-j`   | Output in JSON format                  | `false`  |
| `--metadata`   | `-m`   | Display with metadata                  | `false`  |
| `--fzf`        | `-f`   | Select mode with fzf                   | `false`  |
| `--filter`     |        | Filter by branch name or path          | `""`     |
| `--sort`       |        | Sort by field (branch, age, size)      | `branch` |
| `--last-commit`|        | Show last commit information           | `false`  |
| `--full-path`  |        | Show full paths instead of relative    | `false`  |

## Output Formats

### Normal Output

By default, paths are shown relative to the repository root:

```
🎼 Orchestra Members:

📍 refs/heads/main                . 
🎼 feature/auth                   .git/orchestrations/feature-auth 
🎼 bugfix/login                   .git/orchestrations/bugfix-login 
🎼 issue-123                      .git/orchestrations/issue-123
```

### Full Path Output (`--full-path`)

```
🎼 Orchestra Members:

📍 refs/heads/main                /Users/user/project 
🎼 feature/auth                   /Users/user/project/.git/orchestrations/feature-auth 
🎼 bugfix/login                   /Users/user/project/.git/orchestrations/bugfix-login 
🎼 issue-123                      /Users/user/project/.git/orchestrations/issue-123
```

### JSON Output (`--json`)

```json
{
  "worktrees": [
    {
      "branch": "main",
      "path": "/Users/user/project",
      "HEAD": "abc123def",
      "isMain": true,
      "tracking": "origin/main",
      "ahead": 0,
      "behind": 0
    },
    {
      "branch": "feature/auth",
      "path": "/Users/user/project/.git/orchestrations/feature-auth",
      "HEAD": "def456ghi",
      "isMain": false,
      "tracking": "origin/feature/auth",
      "ahead": 3,
      "behind": 0,
      "metadata": {
        "createdAt": "2025-01-15T10:30:00Z",
        "createdBy": "mst",
        "template": "feature",
        "githubIssue": null
      }
    },
    {
      "branch": "issue-123",
      "path": "/Users/user/project/.git/orchestrations/issue-123",
      "HEAD": "ghi789jkl",
      "isMain": false,
      "tracking": "origin/issue-123",
      "ahead": 1,
      "behind": 0,
      "metadata": {
        "createdAt": "2025-01-16T14:00:00Z",
        "createdBy": "mst",
        "githubIssue": {
          "number": 123,
          "title": "Implement authentication",
          "state": "open",
          "labels": ["enhancement", "backend"],
          "assignees": ["user123"],
          "url": "https://github.com/org/repo/issues/123"
        }
      }
    }
  ],
  "summary": {
    "total": 4,
    "active": 3,
    "issues": 1,
    "pullRequests": 0
  }
}
```

### Output with Metadata (`--metadata`)

```
🎼 Orchestra Members:

📍 refs/heads/main                .

🎼 feature/auth                   .git/orchestrations/feature-auth
    GitHub: PR #45 - Add authentication module
    Labels: enhancement, backend
    Assignees: user123
    Created: 2025-01-15 10:30:00

🎼 issue-123                      .git/orchestrations/issue-123
    GitHub: Issue #123 - Implement authentication
    Labels: enhancement, backend
    Assignees: user123
    Created: 2025-01-16 14:00:00
```

### Output with Last Commit (`--last-commit`)

```
🎼 Orchestra Members:

📍 refs/heads/main                .
    Last commit: 2025-01-20 14:23:45 abc1234: Update README

🎼 feature/auth                   .git/orchestrations/feature-auth
    Last commit: 2025-01-19 10:15:30 def5678: Add login endpoint
```

## fzf Integration

Using the `--fzf` option allows interactive selection of orchestra members:

```bash
# Output selected orchestra member's branch name
BRANCH=$(mst list --fzf)

# Navigate to selected orchestra member
cd $(mst where $(mst list --fzf))

# Execute command on selected orchestra member
mst exec $(mst list --fzf) npm test
```

## Understanding Statuses

- **📍**: Current worktree (HEAD)
- **🎼**: Regular orchestra member
- **🔒 Locked**: Worktree is locked
- **⚠️ Prunable**: Can be deleted
- **ahead X**: X commits ahead of remote branch
- **behind X**: X commits behind remote branch
- **Issue #X**: Associated with GitHub Issue #X
- **PR #X**: Associated with GitHub PR #X

## CI/CD Integration

JSON output makes it easy to integrate with CI/CD pipelines:

```bash
# Run tests on all orchestra members
mst list --json | jq -r '.worktrees[].branch' | while read branch; do
  echo "Testing $branch..."
  mst exec "$branch" npm test
done

# Get number of active orchestra members
ACTIVE_COUNT=$(mst list --json | jq '.summary.active')

# Get only Issue-related orchestra members
mst list --json | jq '.worktrees[] | select(.metadata.githubIssue != null)'
```

## Filtering Examples

Combine with jq command for various filtering options:

```bash
# Show only orchestra members that are ahead
mst list --json | jq '.worktrees[] | select(.ahead > 0)'

# Orchestra members using specific template
mst list --json | jq '.worktrees[] | select(.metadata.template == "feature")'

# Orchestra members older than 1 week
mst list --json | jq '.worktrees[] | select(.metadata.createdAt < (now - 604800 | strftime("%Y-%m-%dT%H:%M:%SZ")))'
```

## Tips & Tricks

### 1. Using Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias mstl='mst list'
alias mstlj='mst list --json | jq'

# Usage examples
mstl                    # Normal list
mstlj '.summary'        # Summary info only
mstlj '.worktrees[0]'   # Details of first orchestra member
```

### 2. Status Check Script

```bash
#!/bin/bash
# Check Git status of all orchestra members
mst list --json | jq -r '.worktrees[].branch' | while read branch; do
  echo "=== $branch ==="
  mst exec "$branch" git status --short
  echo
done
```

### 3. Regular Cleanup

```bash
# Detect orchestra members not updated for 30+ days
mst list --json | jq -r '
  .worktrees[] |
  select(.metadata.createdAt < (now - 2592000 | strftime("%Y-%m-%dT%H:%M:%SZ"))) |
  .branch
' | while read branch; do
  echo "Old worktree: $branch"
  # mst delete "$branch"  # Uncomment to actually delete
done
```

## Related Commands

- [`mst create`](./create.md) - Create new orchestra member
- [`mst delete`](./delete.md) - Delete orchestra member
- [`mst where`](./where.md) - Show orchestra member path
- [`mst health`](./health.md) - Check orchestra member health
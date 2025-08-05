# 🔸 list

Command to display a list of created orchestra members (Git worktrees). You can check the status, metadata, and GitHub integration status of each orchestra member.

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

| Option          | Short | Description                             | Default  |
| --------------- | ----- | --------------------------------------- | -------- |
| `--json`        | `-j`  | Output in JSON format                   | `false`  |
| `--metadata`    | `-m`  | Display with metadata                   | `false`  |
| `--fzf`         | `-f`  | Select mode with fzf                    | `false`  |
| `--filter`      |       | Filter by branch name or path           | `""`     |
| `--sort`        |       | Sort by field (branch, age, size)       | `branch` |
| `--last-commit` |       | Show last commit information            | `false`  |
| `--full-path`   |       | Show full paths instead of relative     | `false`  |
| `--names`       |       | Machine-readable output (for scripting) | `false`  |

## Output Formats

### Normal Output

Path display format depends on the `ui.pathDisplay` configuration setting in `.maestro.json`:

**With `"pathDisplay": "absolute"` (default):**
```
🎼 Orchestra Members (worktree):

📍 refs/heads/main                /Users/user/project
🎷 feature/auth                   /Users/user/project/.git/orchestrations/feature-auth
🎷 bugfix/login                   /Users/user/project/.git/orchestrations/bugfix-login
🎷 issue-123                      /Users/user/project/.git/orchestrations/issue-123
```

**With `"pathDisplay": "relative"`:**
```
🎼 Orchestra Members (worktree):

📍 refs/heads/main                .
🎷 feature/auth                   .git/orchestrations/feature-auth
🎼 bugfix/login                   .git/orchestrations/bugfix-login
🎷 issue-123                      .git/orchestrations/issue-123
```

### Full Path Output (`--full-path`)

The `--full-path` option always shows absolute paths regardless of the `ui.pathDisplay` configuration:

```
🎼 Orchestra Members (worktree):

📍 refs/heads/main                /Users/user/project
🎷 feature/auth                   /Users/user/project/.git/orchestrations/feature-auth
🎼 bugfix/login                   /Users/user/project/.git/orchestrations/bugfix-login
🎷 issue-123                      /Users/user/project/.git/orchestrations/issue-123
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
        "github": {
          "type": "issue",
          "title": "Implement authentication",
          "body": "Need to add JWT-based authentication system with login and signup functionality.",
          "author": "contributor",
          "labels": ["enhancement", "backend"],
          "assignees": ["user123"],
          "milestone": "v2.0.0",
          "url": "https://github.com/org/repo/issues/123",
          "issueNumber": "123"
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

When using the `--metadata` flag, the list command displays comprehensive information about each worktree, including GitHub metadata for worktrees created from Issues or Pull Requests:

```
🎼 Orchestra Members (worktree):

📍 refs/heads/main                .

🎷 feature/auth                   .git/orchestrations/feature-auth
    GitHub: PR #45 - Add authentication module
    Body: This PR implements user authentication with JWT tokens and includes comprehensive test coverage.
    Labels: enhancement, backend, security
    Assignees: user123, reviewer2
    Milestone: v2.0.0
    URL: https://github.com/org/repo/pull/45
    Created: 2025-01-15 10:30:00

🎷 issue-123                      .git/orchestrations/issue-123
    GitHub: Issue #123 - Implement authentication
    Body: Need to add JWT-based authentication system with login and signup functionality.
    Labels: feature-request, backend
    Assignees: developer1
    Milestone: v2.0.0
    URL: https://github.com/org/repo/issues/123
    Created: 2025-01-16 14:00:00
```

**Enhanced GitHub Metadata Display:**
- **Type and Number**: Clearly identifies whether it's a PR or Issue with its number
- **Description**: Shows the full body/description of the GitHub item
- **Labels**: All associated labels for easy categorization
- **Assignees**: Current assignees for the GitHub item
- **Milestone**: Associated milestone information
- **URL**: Direct link to the GitHub item for quick access
- **Creation Time**: When the worktree was created locally

### Output with Last Commit (`--last-commit`)

```
🎼 Orchestra Members (worktree):

📍 refs/heads/main                .
    Last commit: 2025-01-20 14:23:45 abc1234: Update README

🎷 feature/auth                   .git/orchestrations/feature-auth
    Last commit: 2025-01-19 10:15:30 def5678: Add login endpoint
```

### Names Output (`--names`)

Machine-readable output that prints only branch names, one per line. Perfect for scripting:

```bash
# Simple output
$ mst list --names
main
feature/auth
bugfix/login
issue-123

# Use in scripts
for branch in $(mst list --names); do
  echo "Processing $branch..."
  mst exec "$branch" git status --short
done
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

## GitHub Metadata Integration

When worktrees are created from GitHub Issues or Pull Requests using `mst github` commands, comprehensive metadata is automatically saved and displayed:

### Metadata Benefits

- **Context Awareness**: Quickly understand what each worktree is for without switching contexts
- **Link Preservation**: Direct URLs to GitHub items for instant navigation
- **Label-based Organization**: See GitHub labels to understand priority, type, or category
- **Assignment Tracking**: Know who's responsible for each GitHub item
- **Milestone Visibility**: Track progress towards project milestones
- **Rich Descriptions**: Access full GitHub descriptions directly from the terminal

### Advanced Usage Examples

```bash
# Filter worktrees with GitHub metadata using jq
mst list --json | jq '.worktrees[] | select(.metadata.github != null)'

# Find worktrees for specific GitHub labels
mst list --json | jq '.worktrees[] | select(.metadata.github.labels[]? == "bug")'

# List worktrees assigned to specific user
mst list --json | jq '.worktrees[] | select(.metadata.github.assignees[]? == "username")'

# Find worktrees for specific milestone
mst list --json | jq '.worktrees[] | select(.metadata.github.milestone == "v2.0.0")'
```

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

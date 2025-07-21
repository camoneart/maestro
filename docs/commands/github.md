# mst github

Command to create orchestra members (Git Worktrees) directly from GitHub Issues or Pull Requests. Integrates with GitHub CLI to seamlessly integrate development workflows.

## Overview

```bash
mst github [pr|issue] [number] [options]
mst gh [pr|issue] [number] [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Create orchestra member from Pull Request
mst github pr 123

# Create orchestra member from Issue
mst github issue 456

# Interactive selection
mst github
```

### Advanced Usage

```bash
# Create PR and auto-start Claude Code
mst github pr 123 --tmux --claude

# Multiple selection for batch creation
mst github --multiple

# Filter and select
mst github issue --filter "label:bug"

# Show only assigned to me
mst github --assignee @me
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--tmux` | `-t` | Create tmux session/window | `false` |
| `--claude` | `-c` | Auto-start Claude Code | `false` |
| `--multiple` | `-m` | Multiple selection mode | `false` |
| `--filter <query>` | `-f` | GitHub CLI filter query | none |
| `--assignee <user>` | `-a` | Filter by assignee (@me for self) | none |
| `--limit <n>` | `-l` | Limit number of displayed items | `30` |

## Creating from Pull Requests

### Basic Flow

```bash
# 1. Check PR list
gh pr list

# 2. Create orchestra member from PR
mst github pr 123

# 3. Work in created orchestra member
mst shell pr-123
```

### Automatically Retrieved Information

- PR title
- PR description
- Author information
- Reviewers
- Labels
- Milestone
- Related Issues
- Base branch
- Merge status

### Metadata Storage

```json
{
  "githubPR": {
    "number": 123,
    "title": "Add authentication feature",
    "state": "open",
    "draft": false,
    "author": "username",
    "baseRef": "main",
    "headRef": "feature/auth",
    "labels": ["enhancement", "backend"],
    "reviewers": ["reviewer1", "reviewer2"],
    "url": "https://github.com/org/repo/pull/123"
  }
}
```

## Creating from Issues

### Basic Flow

```bash
# 1. Check Issue list
gh issue list

# 2. Create orchestra member from Issue
mst github issue 456

# 3. Branch name is auto-generated
# Created as issue-456
```

### Issue Number Formats

All of these formats produce the same result:

```bash
mst github issue 456
mst github issue #456
mst github issue issue-456
```

### Automatically Retrieved Information

- Issue title
- Issue body
- Author
- Assignees
- Labels
- Milestone
- Project
- Related PRs

## Interactive Mode

```bash
# Select from menu
mst github
```

Displayed menu:
```
? What would you like to create a worktree from?
❯ Pull Request
  Issue
  Cancel
```

Then select from list:
```
? Select a Pull Request:
❯ #125 feat: Add dark mode support (enhancement, ui)
  #124 fix: Memory leak in background worker (bug, critical)
  #123 docs: Update API documentation (documentation)
  #122 refactor: Improve database queries (performance)
```

## Filtering

You can use GitHub CLI filter syntax:

### Pull Request Filters

```bash
# Filter by label
mst github pr --filter "label:bug"

# Filter by state
mst github pr --filter "state:open draft:false"

# Filter by author
mst github pr --filter "author:username"

# Complex conditions
mst github pr --filter "label:bug,critical state:open"
```

### Issue Filters

```bash
# Issues assigned to me
mst github issue --assignee @me

# Specific milestone
mst github issue --filter "milestone:v2.0"

# Recently updated
mst github issue --filter "sort:updated-desc"
```

## Multiple Selection Mode

```bash
# Select multiple PRs for batch creation
mst github pr --multiple
```

Selection screen:
```
? Select Pull Requests: (Press <space> to select, <a> to toggle all)
 ◉ #125 feat: Add dark mode support
 ◯ #124 fix: Memory leak in background worker
 ◉ #123 docs: Update API documentation
```

## Integrated Workflows

### Review Flow

```bash
# 1. Check PRs waiting for review
mst github pr --filter "review:required"

# 2. Create orchestra member from PR for review
mst github pr 125 --tmux --claude

# 3. Execute AI diff review
mst suggest --review

# 4. Post review comments
gh pr review 125 --comment -b "LGTM with minor suggestions"
```

### Issue-Driven Development

```bash
# 1. Select high-priority Issues
mst github issue --filter "label:priority:high"

# 2. Create orchestra member and start development
mst github issue 456 --tmux --claude

# 3. Create PR after development completion
gh pr create --title "Fix #456: Authentication bug" --body "Closes #456"
```

## CI/CD Integration

```bash
# Locally verify PRs failing CI
FAILED_PRS=$(gh pr list --json number,statusCheckRollup -q '.[] | select(.statusCheckRollup | length > 0) | select(.statusCheckRollup[0].state == "FAILURE") | .number')

for pr in $FAILED_PRS; do
  echo "Checking PR #$pr..."
  mst github pr "$pr"
  mst exec "pr-$pr" npm test
done
```

## Error Handling

### Common Errors

1. **GitHub authentication error**
   ```
   Error: GitHub authentication failed
   ```
   Solution: Authenticate GitHub CLI with `gh auth login`

2. **PR/Issue not found**
   ```
   Error: Pull request #999 not found
   ```
   Solution: Check correct number or verify repository is correct

3. **Orchestra member already exists**
   ```
   Error: Worktree for PR #123 already exists
   ```
   Solution: Use existing orchestra member or delete and recreate

## Best Practices

### 1. Utilize PR/Issue Templates

```bash
# Automatically build development environment based on PR template
if [[ $(gh pr view 123 --json body -q '.body' | grep -c "Requires: tmux") -gt 0 ]]; then
  mst github pr 123 --tmux --claude
else
  mst github pr 123
fi
```

### 2. Label-Based Automation

```bash
# Use appropriate template based on labels
PR_LABELS=$(gh pr view 123 --json labels -q '.labels[].name' | paste -sd,)

if [[ $PR_LABELS == *"bug"* ]]; then
  mst github pr 123 --template bugfix
elif [[ $PR_LABELS == *"feature"* ]]; then
  mst github pr 123 --template feature
else
  mst github pr 123
fi
```

### 3. Regular Synchronization

```bash
# Keep orchestra members for open PR/Issues up to date
mst list --json | jq -r '.worktrees[] | select(.metadata.githubPR != null) | .branch' | while read branch; do
  PR_NUM=$(echo $branch | grep -oE '[0-9]+')
  if [[ $(gh pr view $PR_NUM --json state -q '.state') == "OPEN" ]]; then
    mst sync "$branch" --rebase
  fi
done
```

## Tips & Tricks

### GitHub CLI Aliases

```bash
# Add to ~/.config/gh/config.yml
aliases:
  pr-worktree: "!mst github pr"
  issue-worktree: "!mst github issue"

# Usage examples
gh pr-worktree 123
gh issue-worktree 456
```

### Auto-labeling

```bash
# Reflect Issue labels in orchestra members created from Issues
create_issue_worktree() {
  local issue=$1
  
  # Create orchestra member
  mst github issue "$issue"
  
  # Get Issue labels and reflect in commit message
  LABELS=$(gh issue view "$issue" --json labels -q '.labels[].name' | paste -sd,)
  mst exec "issue-$issue" git commit --allow-empty -m "chore: start work on issue #$issue [$LABELS]"
}
```

## Related Commands

- [`mst create`](./create.md) - Manually create orchestra members
- [`mst batch`](./batch.md) - Batch create from multiple Issues/PRs
- [`mst suggest`](./suggest.md) - Message suggestions when creating PRs
- [`mst review`](./review.md) - PR review flow
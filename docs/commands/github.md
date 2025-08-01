# 🔸 github

Command to create orchestra members (Git worktrees) directly from GitHub Issues or Pull Requests. Integrates with GitHub CLI to seamlessly integrate development workflows.

## Overview

```bash
mst github [type] [number] [options]
mst gh [type] [number] [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# List all GitHub PRs and Issues
mst github list
mst gh list

# Create orchestra member from Pull Request
mst github checkout 123
mst gh 123  # shorthand

# Create orchestra member from Issue
mst github issue 456

# Interactive selection
mst github

# Add comment to PR/Issue
mst github comment 123 -m "LGTM!"
```

### Advanced Usage

```bash
# Create and open in tmux
mst github 123 --tmux

# Create and open in vertical split
mst github 123 --tmux-v

# Create and open in horizontal split
mst github 123 --tmux-h

# Create with automatic setup and explicitly open in editor
mst github 123 --open --setup
```

## Options

| Option                | Short      | Description                              | Default |
| --------------------- | ---------- | ---------------------------------------- | ------- |
| `--open`              | `-o`       | Open in editor after creation (only when explicitly specified) | `false` |
| `--setup`             | `-s`       | Execute environment setup                | `false` |
| `--message <message>` | `-m`       | Comment message (for comment subcommand) | none    |
| `--reopen`            |            | Reopen PR/Issue                          | `false` |
| `--close`             |            | Close PR/Issue                           | `false` |
| `--tmux`              | `-t`       | Open in new tmux window                  | `false` |
| `--tmux-vertical`     | `--tmux-v` | Open in vertical split pane              | `false` |
| `--tmux-horizontal`   | `--tmux-h` | Open in horizontal split pane            | `false` |

### Editor Opening Behavior

The `--open` flag only opens the editor when explicitly specified. Unlike some other commands, the GitHub command does not automatically open in the editor based on the `development.defaultEditor` configuration setting. You must use the `--open` flag to open the created worktree in your editor.

## Listing GitHub Items

### GitHub List Command

The `list` subcommand displays all open Pull Requests and Issues in the current repository:

```bash
# Display all PRs and Issues
mst github list
mst gh list  # alias
```

#### Example Output

```
🔍 GitHub Pull Requests & Issues

📋 Pull Requests:
  #125 Add user authentication [draft]
    by johndoe
  #123 Fix login bug
    by janedoe

🎯 Issues:
  #124 Improve error handling
    by contributor
  #122 Add documentation
    by maintainer

Usage:
  mst github pr 123   # Create from PR
  mst github issue 456 # Create from Issue
```

#### Features

- **Colored Output**: Uses colors to distinguish between PRs and Issues
- **Draft Indicators**: Shows `[draft]` label for draft Pull Requests
- **Author Information**: Displays the author of each PR/Issue
- **Usage Examples**: Provides helpful examples for next steps
- **Error Handling**: Graceful handling of network errors or authentication issues

## Creating from Pull Requests

### Basic Flow

```bash
# 1. Check PR list using maestro
mst github list

# 2. Create orchestra member from PR
mst github pr 123

# 3. Work in created orchestra member
mst shell pr-123
```

### PR Worktree Creation Process

When creating a worktree from a Pull Request, maestro uses an optimized process:

1. **Temporary checkout**: Creates a temporary branch to fetch the PR code
2. **Worktree creation**: Creates the worktree using `createWorktree` with the temporary branch as base
3. **Cleanup**: Removes the temporary branch and restores the original branch state

This approach ensures reliable PR worktree creation by properly handling the base branch relationship and avoiding common Git worktree issues.

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

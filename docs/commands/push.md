# 🔸 push

Push current branch to remote repository and optionally create Pull Request. This command provides a streamlined workflow for completing development work and creating PRs.

## Overview

```bash
mst push [options]
```

## Usage Examples

### Basic Usage

```bash
# Simple push to remote
mst push

# Push and create regular PR
mst push --pr

# Push and create Draft PR
mst push --draft-pr
```

### Advanced Usage

```bash
# Push with custom PR details
mst push --pr --title "Add user authentication" --body "Implements login and signup features"

# Push to specific base branch
mst push --pr --base develop

# Force push (safely with --force-with-lease)
mst push --force

# Push all orchestra members with Draft PRs
mst push --all --draft-pr

# Skip PR template editing
mst push --pr --no-edit
```

## Options

| Option               | Description                                    | Default |
| -------------------- | ---------------------------------------------- | ------- |
| `--pr`               | Create regular Pull Request                    | `false` |
| `--draft-pr`         | Create Draft Pull Request                      | `false` |
| `--base <branch>`    | Specify base branch for PR                     | `main`  |
| `--title <title>`    | Specify PR title                               | branch name |
| `--body <body>`      | Specify PR body                                | auto-generated |
| `--no-edit`          | Skip PR template editing                       | `false` |
| `--force`            | Force push (uses --force-with-lease)          | `false` |
| `--all`              | Push all orchestra members                     | `false` |
| `--issue <number>`   | Link to issue number                           | none    |

## Features

### Smart Push Behavior

The push command intelligently handles different scenarios:

1. **First-time push**: Automatically sets upstream with `-u origin <branch>`
2. **Existing branch**: Simple push without upstream setting
3. **Force push**: Uses `--force-with-lease` for safety

### PR Creation Integration

When using `--pr` or `--draft-pr` options:

- **GitHub CLI Integration**: Uses `gh pr create` for seamless PR creation
- **Template Support**: Respects GitHub PR templates when `--no-edit` is not used
- **Auto-generated Content**: Creates appropriate titles and descriptions

### Multi-Worktree Support

Using the `--all` option processes all orchestra members:

```bash
# Push all worktrees with Draft PRs
mst push --all --draft-pr

# Push all worktrees to develop branch
mst push --all --pr --base develop
```

## PR Creation Details

### Regular PR vs Draft PR

**Regular PR (`--pr`)**:
- Immediately ready for review
- Triggers CI/CD workflows
- Sends notifications to team members

**Draft PR (`--draft-pr`)**:
- Marked as work-in-progress
- No review notifications sent
- Perfect for sharing progress or getting early feedback

### Auto-generated Content

Default PR content generation:

- **Title**: Branch name (or custom with `--title`)
- **Body**: "Work in progress" for drafts, blank for regular PRs (or custom with `--body`)
- **Base Branch**: `main` (or custom with `--base`)

## Safety Features

### Main Branch Protection

The command warns when pushing to main branches:

```bash
# Pushing to main branch triggers confirmation
mst push  # on main branch
# ⚠️ メインブランチ 'main' をプッシュしますか？ (y/N)
```

Protected branches: `main`, `master`, `develop`, `development`

### Force Push Safety

Uses `--force-with-lease` instead of `--force`:

```bash
# Safe force push
mst push --force
# Executes: git push --force-with-lease
```

This prevents accidentally overwriting other people's work.

## Error Handling

### Common Errors

1. **No remote repository**
   ```
   Error: リモートリポジトリ (origin) が設定されていません
   ```
   Solution: Add remote with `git remote add origin <url>`

2. **GitHub CLI not authenticated**
   ```
   Error: GitHub CLIが認証されていません
   ```
   Solution: Run `gh auth login`

3. **Detached HEAD state**
   ```
   Error: ブランチが detached HEAD 状態です
   ```
   Solution: Check out a proper branch first

## Integration with Other Commands

### Workflow Integration

```bash
# Complete development workflow
mst create feature/auth --tmux --claude
# ... do development work ...
mst push --draft-pr
# ... continue development ...
mst push --pr --title "Add user authentication"
```

### Configuration Support

Respects `.maestro.json` settings:

```json
{
  "github": {
    "defaultBase": "develop",
    "autoLink": true
  }
}
```

## Best Practices

### 1. Use Draft PRs for Work-in-Progress

```bash
# Early sharing of progress
mst push --draft-pr

# Later convert to regular PR when ready
gh pr ready <pr-number>
```

### 2. Meaningful PR Titles and Bodies

```bash
# Good PR creation
mst push --pr \
  --title "feat: add user authentication system" \
  --body "Implements login, logout, and session management with JWT tokens"
```

### 3. Regular Pushes with All Worktrees

```bash
# Daily sync of all active work
mst push --all --draft-pr
```

## Related Commands

- [`mst create`](./create.md) - Create new orchestra member
- [`mst list`](./list.md) - View all orchestra members
- [`mst review`](./review.md) - PR review management
- [`mst github`](./github.md) - GitHub integration features
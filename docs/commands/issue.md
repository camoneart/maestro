# 🔸 issue

Command to manage GitHub Issues directly from maestro. Provides seamless integration between Git worktrees and GitHub issue management workflows.

## Overview

```bash
mst issue [issue-number] [options]
mst issue [command] [options]
```

**Arguments:**
- `issue-number` - Issue number to view or interact with
- `command` - Special commands like `list` (equivalent to `--list`)

## Usage Examples

### Basic Usage

```bash
# List open issues
mst issue --list
mst issue list     # Alternative syntax

# Create new issue
mst issue --create

# Close specific issue
mst issue --close 123

# Open issue in web browser
mst issue 456 --web
```

### Advanced Usage

```bash
# Create issue with assignment and labels
mst issue --create --assign @me --label bug,priority:high

# List issues with specific milestone
mst issue --list --milestone "v2.0"

# Interactive issue management
mst issue
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--list` | `-l` | List open issues | `false` |
| `--create` | `-c` | Create new issue | `false` |
| `--close` | | Close issue by number | none |
| `--web` | `-w` | Open issue in web browser | `false` |
| `--assign <user>` | `-a` | Assign issue to user | none |
| `--label <labels>` | | Add labels (comma-separated) | none |
| `--milestone <name>` | | Set milestone | none |

**Note:** You can use `mst issue list` as an alternative to `mst issue --list`.

## Issue Management

### Listing Issues

```bash
# List all open issues
mst issue --list
mst issue list     # Alternative syntax

# Filter by labels
mst issue --list --label bug

# Filter by assignee
mst issue --list --assign @me
```

### Creating Issues

```bash
# Interactive creation
mst issue --create

# With metadata
mst issue --create --assign @teamlead --label enhancement
```

### Closing Issues

```bash
# Close specific issue
mst issue --close 123

# Close with message
mst issue --close 123 --message "Fixed in latest commit"
```

## Integration with Worktrees

### Issue-Driven Development

```bash
# 1. List issues to work on
mst issue --list
# or: mst issue list

# 2. Create worktree from issue
mst create issue-123

# 3. Work on the issue
mst shell issue-123

# 4. Close issue when done
mst issue --close 123
```

### Automatic Issue Linking

When creating worktrees from issue numbers, maestro automatically:
- Fetches issue metadata
- Links worktree to GitHub issue
- Updates issue status when appropriate

## GitHub CLI Integration

This command requires GitHub CLI (`gh`) to be installed and authenticated:

```bash
# Install GitHub CLI
brew install gh  # macOS
apt install gh    # Ubuntu

# Authenticate
gh auth login
```

## Error Handling

### Common Issues

1. **GitHub authentication failed**
   ```bash
   # Authenticate GitHub CLI
   gh auth login
   ```

2. **Issue not found**
   ```bash
   # Verify issue number and repository
   gh issue list
   ```

3. **Permission denied**
   ```bash
   # Check repository permissions
   gh repo view
   ```

## Best Practices

### 1. Use Labels for Organization

```bash
# Create issues with consistent labels
mst issue --create --label "type:bug,priority:high"
```

### 2. Link Issues to Milestones

```bash
# Organize work by milestones
mst issue --create --milestone "Sprint 23"
```

### 3. Assign Issues Appropriately

```bash
# Assign to team members
mst issue --create --assign @developer
```

## Related Commands

- [`mst create`](./create.md) - Create worktrees from issues
- [`mst github`](./github.md) - GitHub integration commands
- [`mst list`](./list.md) - View worktrees linked to issues
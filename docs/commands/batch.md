# mst batch

Command to batch create and manage multiple orchestra members (Git Worktrees). You can efficiently create multiple Worktrees through various methods including GitHub Issues, file input, and interactive mode.

## Overview

```bash
mst batch [options]
mst b [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Batch create by selecting multiple GitHub Issues
mst batch

# Batch create from file
mst batch --from-file worktrees.txt

# Interactive multiple input
mst batch --interactive

# Batch create with options
mst batch -o -s -b develop  # Open after creation, run setup, base is develop
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--from-file <file>` | `-f` | Read from batch file | none |
| `--interactive` | `-i` | Interactive input mode | `false` |
| `--open` | `-o` | Open in editor after creation | `false` |
| `--setup` | `-s` | Run environment setup | `false` |
| `--base <branch>` | `-b` | Specify base branch | `main` |
| `--template <name>` | `-t` | Template to use | none |
| `--parallel <n>` | `-p` | Number of parallel executions | `4` |
| `--dry-run` | `-n` | Show plan without actually creating | `false` |

## GitHub Issues Mode (Default)

When run without arguments, you can select multiple issues from GitHub:

```bash
mst batch
```

Selection screen:
```
? Select issues to create worktrees from: (Press <space> to select, <a> to toggle all)
 ◉ #125 feat: Add authentication system (enhancement)
 ◯ #124 fix: Memory leak in worker (bug, critical)
 ◉ #123 docs: Update API documentation (documentation)
 ◯ #122 refactor: Database optimization (performance)
 ◉ #121 feat: Dark mode support (ui, enhancement)
```

Execution result:
```
Creating 3 worktrees...

✓ Created issue-125 (feat: Add authentication system)
✓ Created issue-123 (docs: Update API documentation)
✓ Created issue-121 (feat: Dark mode support)

Summary: 3 successful, 0 failed
```

## File Input Mode

### Batch File Format

```bash
# worktrees.txt
# Format: branch-name | description | issue/pr number (optional)

feature-auth | Implement authentication | #125
bugfix-login | Fix login bug | pr-45
refactor-api | API refactoring
docs-update | Update documentation | issue-123

# Comment lines are ignored
# Empty lines are also ignored
```

### Execution

```bash
mst batch --from-file worktrees.txt
```

### CSV Format Support

```csv
branch,description,issue
feature-auth,"Implement authentication",125
bugfix-login,"Fix login bug",pr-45
refactor-api,"API refactoring",
docs-update,"Update documentation",issue-123
```

## Interactive Mode

```bash
mst batch --interactive
```

Prompt display:
```
Enter worktree details (branch-name | description | issue/pr)
Press Enter twice to finish

> feature-auth | Implement authentication | #125
> bugfix-login | Fix login bug
> refactor-api | API refactoring
> 

Creating 3 worktrees...
```

## Parallel Execution

By default, up to 4 worktrees are created in parallel:

```bash
# Change parallel count
mst batch --parallel 8

# Sequential execution (for debugging)
mst batch --parallel 1
```

## Execution Plan Confirmation

```bash
# Dry run to check plan
mst batch --from-file worktrees.txt --dry-run
```

Example output:
```
Batch execution plan:
1. feature-auth (base: main, template: none)
   - Description: Implement authentication
   - GitHub Issue: #125
2. bugfix-login (base: main, template: none)
   - Description: Fix login bug
   - GitHub PR: #45
3. refactor-api (base: main, template: none)
   - Description: API refactoring

Total: 3 worktrees to create
Options: --open --setup
```

## Template Usage

```bash
# Apply feature template to all
mst batch --template feature

# Individual specification in file
# worktrees-with-template.txt
feature-auth | Authentication | #125 | template:feature
bugfix-login | Bug fix | | template:bugfix
experiment-ml | ML experiment | | template:experiment
```

## Error Handling

### Partial Failures

If some creations fail, others continue:

```
Creating 5 worktrees...

✓ Created feature-auth
✗ Failed bugfix-login: Branch already exists
✓ Created refactor-api
✓ Created docs-update
✗ Failed feature-ui: Invalid branch name

Summary: 3 successful, 2 failed

Failed worktrees:
- bugfix-login: Branch already exists
- feature-ui: Invalid branch name
```

### Retry Feature

```bash
# Re-run only failed ones
mst batch --retry-failed

# Or save failed list to file
mst batch --save-failed failed.txt
```

## Advanced Usage Examples

### Project Initial Setup

```bash
# setup-project.txt
feature-auth | Authentication system | #10
feature-api | REST API implementation | #11
feature-ui | Frontend UI | #12
docs-api | API documentation | #13
test-integration | Integration tests | #14

# Batch create and setup
mst batch --from-file setup-project.txt --setup --open
```

### Team Development Usage

```bash
# Assign issues per team member
ASSIGNED_ISSUES=$(gh issue list --assignee @me --json number -q '.[].number')

# Create orchestra members for assigned issues only
echo "$ASSIGNED_ISSUES" | while read issue; do
  echo "issue-$issue | Issue #$issue | #$issue"
done | mst batch --from-file -
```

### CI/CD Automation

```bash
#!/bin/bash
# auto-create-worktrees.sh

# Get issues with "ready-for-dev" label
gh issue list --label ready-for-dev --json number,title | \
  jq -r '.[] | "issue-\(.number) | \(.title) | #\(.number)"' | \
  mst batch --from-file - --setup

# Update labels after creation
gh issue list --label ready-for-dev --json number -q '.[].number' | \
  while read issue; do
    gh issue edit "$issue" --remove-label ready-for-dev --add-label in-progress
  done
```

## Batch Operations Best Practices

### 1. Unified Naming Convention

```bash
# naming-convention.txt
feature/auth-system | Authentication system | #125
feature/user-profile | User profile | #126
bugfix/auth-timeout | Fix authentication timeout | #127
docs/auth-api | Authentication API docs | #128
```

### 2. Staged Creation

```bash
# Phase 1: Core features
mst batch --from-file phase1-core.txt --setup

# Phase 2: Additional features
mst batch --from-file phase2-features.txt

# Phase 3: Documentation
mst batch --from-file phase3-docs.txt --template docs
```

### 3. Progress Management

```bash
# Save batch execution results to log
mst batch --from-file worktrees.txt | tee batch-$(date +%Y%m%d-%H%M%S).log

# Check created orchestra members
mst list --json | jq '.summary'
```

## Configuration File Integration

Set batch processing defaults in `.mst.json`:

```json
{
  "batch": {
    "defaultParallel": 6,
    "autoSetup": true,
    "defaultTemplate": "feature",
    "hooks": {
      "beforeBatch": "echo 'Starting batch creation...'",
      "afterEach": "echo 'Created: $ORCHESTRA_MEMBER'",
      "afterBatch": "mst list"
    }
  }
}
```

## Tips & Tricks

### Scripting

```bash
#!/bin/bash
# create-sprint-worktrees.sh

SPRINT="sprint-23"
ISSUES=$(gh issue list --label "$SPRINT" --json number,title)

echo "$ISSUES" | jq -r '.[] | "sprint23-\(.number) | \(.title) | #\(.number)"' > sprint23.txt

mst batch --from-file sprint23.txt --base develop --setup --parallel 8
```

### Progress Bar Execution

```bash
# Get line count from batch file
TOTAL=$(wc -l < worktrees.txt)
CURRENT=0

# Execute with progress display
while IFS='|' read -r branch desc issue; do
  ((CURRENT++))
  echo "[$CURRENT/$TOTAL] Creating $branch..."
  mst create "$branch" ${issue:+--from-issue "$issue"}
done < worktrees.txt
```

## Related Commands

- [`mst create`](./create.md) - Create single orchestra member
- [`mst github`](./github.md) - Create from GitHub integration
- [`mst list`](./list.md) - Check created orchestra members
- [`mst health`](./health.md) - Health check after bulk creation
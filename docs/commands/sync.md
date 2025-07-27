# 🔸 sync

Command to synchronize code and configuration files between orchestra members (Git worktrees). You can reflect changes from the main branch to other orchestra members or share environment configuration files.

## Overview

```bash
mst sync [branch-name] [options]
mst s [branch-name] [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Sync changes from main branch to specific orchestra member
mst sync feature-branch

# Sync to all orchestra members
mst sync --all

# Interactive selection
mst sync

# Sync with rebase (default is merge)
mst sync --rebase
```

### Filtering Orchestra Members

```bash
# Filter by keyword (branch name or path)
mst sync --filter feature --all

# Filter by wildcard pattern
mst sync --pattern "feature/*" --all
mst sync --pattern "bugfix-*" --all

# Combine filters (AND condition)
mst sync --filter api --pattern "feature/*" --all

# Use with fzf for interactive selection from filtered results
mst sync --filter feature --fzf
```

### File Synchronization

```bash
# Sync environment variables and configuration files
mst sync --files

# Use presets for file sync
mst sync --preset env     # .env files only
mst sync --preset config  # configuration files only
mst sync --preset all     # all configuration files

# Interactive file selection
mst sync --interactive
```

## Options

| Option             | Short | Description                           | Default |
| ------------------ | ----- | ------------------------------------- | ------- |
| `--all`            | `-a`  | Sync to all orchestra members         | `false` |
| `--main <branch>`  | `-m`  | Specify main branch                   | auto-detect |
| `--fzf`            |       | Select orchestra members with fzf     | `false` |
| `--rebase`         |       | Sync with rebase (default is merge)   | `false` |
| `--dry-run`        |       | Show changes without actually syncing | `false` |
| `--push`           |       | Push after merge/rebase              | `false` |
| `--filter <keyword>` |     | Filter worktrees by branch/path      | none    |
| `--pattern <pattern>` |    | Filter by wildcard pattern           | none    |
| `--files`          | `-f`  | File sync mode                        | `false` |
| `--preset <name>`  | `-p`  | Use preset for file sync             | none    |
| `--interactive`    | `-i`  | Interactive file selection           | `false` |
| `--concurrency <n>`| `-c`  | Parallel execution count             | `5`     |

## Sync Modes

### Code Sync (Default)

Incorporates latest changes from main branch (or specified base branch) into orchestra members:

```bash
# Merge method (default)
mst sync feature-branch
# Executes: git merge origin/main

# Rebase method
mst sync feature-branch --rebase
# Executes: git rebase origin/main

# Apply to all orchestra members
mst sync --all --rebase

# Apply to filtered orchestra members
mst sync --filter feature --all
mst sync --pattern "release-*" --all --rebase
```

#### Filtering Options

- **`--filter <keyword>`**: Filter by keyword in branch name or path (case-insensitive)
  - Example: `--filter api` matches `feature/api-v2`, `api-refactor`, `/path/to/api-workspace`
  
- **`--pattern <pattern>`**: Filter by wildcard pattern (supports `*` wildcard)
  - Example: `--pattern "feature/*"` matches `feature/auth`, `feature/api`
  - Example: `--pattern "*-fix"` matches `bug-fix`, `hotfix`, `security-fix`

Both options can be combined for more precise filtering (AND logic).

### File Sync

Share configuration files and environment variable files between orchestra members:

```bash
# Basic file sync
mst sync --files

# Files synced by default:
# - .env
# - .env.local
# - .env.development
# - .env.production
# - config/*.json
# - config/*.yml
```

## Presets

### env preset

Sync environment variable files only:

```bash
mst sync --preset env
```

Sync targets:

- `.env`
- `.env.*`
- `config/.env`
- `config/.env.*`

### config preset

Sync configuration files only:

```bash
mst sync --preset config
```

Sync targets:

- `config/*.json`
- `config/*.yml`
- `config/*.yaml`
- `.eslintrc*`
- `.prettierrc*`
- `tsconfig*.json`

### all preset

Sync all configuration files:

```bash
mst sync --preset all
```

Sync targets:

- All files from env preset
- All files from config preset
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`

## Interactive Mode

Select files individually for sync:

```bash
mst sync --interactive
```

Display example:

```
? Select files to sync: (Press <space> to select, <a> to toggle all)
 ◉ .env
 ◯ .env.local
 ◉ config/database.json
 ◯ config/app.yml
 ◉ tsconfig.json
```

## Sync Flow

### Code Sync Details

1. **Pre-check**

   ```bash
   # Confirm with dry run
   mst sync feature-branch --dry-run
   ```

2. **Execute sync**

   ```bash
   # Actually sync
   mst sync feature-branch
   ```

3. **Conflict resolution**

   ```bash
   # If conflicts occur
   # 1. Resolve manually
   mst shell feature-branch
   # Edit conflicts in editor

   # 2. Commit resolution
   git add .
   git commit -m "resolve: merge conflicts"
   ```

### File Sync Details

1. **Check differences**

   ```bash
   # Check which files will be synced
   mst sync --files --dry-run
   ```

2. **Execute sync**

   ```bash
   # From main branch to all orchestra members
   mst sync --all --files
   ```

3. **Custom sync**
   ```bash
   # Specific files only
   mst sync --files --custom .env.production,config/secrets.json
   ```

## Advanced Usage Examples

### CI/CD Configuration Sync

```bash
# Reflect CI configuration to all orchestra members
mst sync --all --files --custom .github/workflows/ci.yml,.gitlab-ci.yml

# Or dedicated script
cat > sync-ci.sh << 'EOF'
#!/bin/bash
CI_FILES=".github/workflows/*.yml,.gitlab-ci.yml,Jenkinsfile"
mst sync --all --files --custom "$CI_FILES"
EOF
chmod +x sync-ci.sh
```

### Selective Sync

```bash
# Using built-in filtering (recommended)
mst sync --pattern "feature/*" --all --rebase

# Or filter by keyword
mst sync --filter hotfix --all --push

# Legacy method using shell scripting
mst list --json | jq -r '.worktrees[] | select(.branch | startswith("feature/")) | .branch' | while read branch; do
  echo "Syncing $branch..."
  mst sync "$branch" --rebase
done
```

### Check Sync Status

```bash
# Check sync status of each orchestra member
mst list --json | jq -r '.worktrees[] | "\(.branch): \(.behind) commits behind"' | grep -v ": 0 commits"
```

## Error Handling

### Common Errors

1. **Merge conflicts**

   ```
   Error: Merge conflict in files: src/index.js, src/utils.js
   ```

   Solution: Move to orchestra member and manually resolve conflicts

2. **Uncommitted changes**

   ```
   Error: Worktree has uncommitted changes
   ```

   Solution: Commit or stash changes before re-running

3. **File not found**
   ```
   Warning: File '.env.local' not found in source worktree
   ```
   Action: Confirm file exists or specify different file

## Best Practices

### 1. Regular Sync

```bash
#!/bin/bash
# daily-sync.sh

echo "🔄 Daily sync starting..."

# 1. Fetch latest main
git fetch origin main

# 2. Sync all orchestra members with rebase
mst sync --all --rebase

# 3. Also sync environment files
mst sync --all --preset env

echo "✅ Sync completed"
```

### 2. Pre-sync Backup

```bash
# Create snapshots before sync
mst snapshot --all -m "Before sync"
mst sync --all --rebase
```

### 3. Project-specific Configuration

Customize sync settings in `.maestro.json`:

```json
{
  "sync": {
    "defaultMode": "rebase",
    "files": {
      "defaults": [".env", ".env.local"],
      "ignore": ["*.tmp", "*.log"]
    },
    "hooks": {
      "beforeSync": "npm test",
      "afterSync": "npm install"
    }
  }
}
```

## Tips & Tricks

### Sync Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias mst-sync-all='mst sync --all --rebase'
alias mst-sync-env='mst sync --all --preset env'
alias mst-sync-safe='mst sync --dry-run'
alias mst-sync-features='mst sync --pattern "feature/*" --all'
alias mst-sync-fixes='mst sync --filter fix --all --rebase'

# Usage examples
mst-sync-all        # Sync all orchestra members with rebase
mst-sync-env        # Sync environment files
mst-sync-features   # Sync only feature branches
mst-sync-fixes      # Sync branches containing "fix"
```

### Conditional Sync

```bash
# Sync only if tests pass
sync_if_tests_pass() {
  local branch=$1

  if mst exec "$branch" npm test; then
    mst sync "$branch" --rebase
  else
    echo "Tests failed for $branch, skipping sync"
  fi
}

# Usage example
sync_if_tests_pass feature-branch
```

## Related Commands

- [`mst list`](./list.md) - Check orchestra members needing sync
- [`mst health`](./health.md) - Check sync status health
- [`mst snapshot`](./snapshot.md) - Create snapshots before sync
- [`mst watch`](./watch.md) - Auto-sync file changes

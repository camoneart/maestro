# 🔸 watch

Command to monitor and synchronize file changes across multiple orchestra members (Git worktrees). Enables automatic file synchronization and change detection for multi-worktree development workflows.

## Overview

```bash
mst watch [options]
```

## Usage Examples

### Basic Usage

```bash
# Start watching current worktree
mst watch

# Watch specific file patterns
mst watch --patterns "*.js,*.ts,*.json"

# Watch all worktrees
mst watch --all

# Dry run (show what would be synchronized)
mst watch --dry
```

### Advanced Usage

```bash
# Watch with exclusions
mst watch --exclude "node_modules/**,dist/**,*.log"

# Auto-sync mode with specific patterns
mst watch --auto --patterns "src/**/*.ts,package.json"

# Watch configuration files only
mst watch --patterns ".env,.env.*,package.json,tsconfig.json"
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--patterns <glob>` | | File patterns to watch (comma-separated) | `**/*` |
| `--exclude <patterns>` | | Patterns to exclude (comma-separated) | `node_modules/**` |
| `--all` | | Watch all worktrees | `false` |
| `--dry` | | Show changes without syncing | `false` |
| `--auto` | | Automatic synchronization | `false` |

## File Watching

### Watch Patterns

```bash
# Watch source files only
mst watch --patterns "src/**/*.ts,src/**/*.js"

# Watch configuration files
mst watch --patterns "*.json,*.yml,*.yaml,.env*"

# Watch documentation
mst watch --patterns "docs/**/*.md,README.md"
```

### Exclusion Patterns

```bash
# Exclude common directories
mst watch --exclude "node_modules/**,dist/**,build/**,.git/**"

# Exclude specific file types
mst watch --exclude "*.log,*.tmp,*.cache"

# Exclude multiple patterns
mst watch --exclude "temp/**,*.backup,coverage/**"
```

## Synchronization

### File Change Detection

The watch command monitors for:

- **File additions**: New files in watched patterns
- **File modifications**: Changes to existing files
- **File deletions**: Removal of watched files
- **Directory changes**: New or removed directories

### Synchronization Strategy

```bash
# Manual synchronization (default)
mst watch
# Shows changes, prompts for sync confirmation

# Automatic synchronization
mst watch --auto
# Automatically syncs changes across worktrees
```

### Sync Behavior

**Supported sync operations:**
- **Configuration files**: `.env`, `package.json`, `tsconfig.json`
- **Source code**: When explicitly specified
- **Documentation**: README, docs directory
- **Build configs**: Webpack, Vite, ESLint configs

**Excluded by default:**
- **Node modules**: `node_modules/`
- **Build outputs**: `dist/`, `build/`
- **Git files**: `.git/`
- **Temporary files**: `*.tmp`, `*.log`

## Watch Modes

### Interactive Mode (Default)

```bash
mst watch
```

**Interactive prompts:**
```
👀 Watching for changes...

📁 File changed: src/config.ts
📁 File added: .env.development

? Sync these changes to other worktrees? (Y/n)
  ✅ feature/auth
  ✅ bugfix/login
  ❌ main (excluded)

✨ Synchronized 2 files to 2 worktrees
```

### Auto Mode

```bash
mst watch --auto
```

Automatically synchronizes changes without prompts:

```
👀 Auto-watching for changes...

📁 Synced: package.json → feature/auth, bugfix/login
📁 Synced: .env.local → feature/auth, bugfix/login
📁 Synced: tsconfig.json → feature/auth, bugfix/login
```

### Dry Run Mode

```bash
mst watch --dry
```

Shows what would be synchronized without making changes:

```
👀 Dry run mode - showing changes only...

📁 Would sync: src/utils.ts
  → feature/auth/src/utils.ts
  → bugfix/login/src/utils.ts

📁 Would sync: package.json
  → feature/auth/package.json
  → bugfix/login/package.json

No files were actually synchronized.
```

## Configuration

### Watch Configuration

Configure in `.maestro.json`:

```json
{
  "watch": {
    "patterns": ["src/**/*.ts", "*.json", ".env*"],
    "exclude": ["node_modules/**", "dist/**", "*.log"],
    "autoSync": false,
    "syncDelay": 1000,
    "excludeWorktrees": ["main", "production"]
  }
}
```

### Per-project Settings

```json
{
  "watch": {
    "enabled": true,
    "syncConfig": true,
    "syncSource": false,
    "syncDocs": true,
    "customPatterns": {
      "config": ["*.json", "*.yml", ".env*"],
      "source": ["src/**/*.ts", "src/**/*.js"],
      "docs": ["docs/**/*.md", "README.md"]
    }
  }
}
```

## Use Cases

### Configuration Synchronization

```bash
# Keep configuration files in sync
mst watch --patterns ".env,.env.*,package.json,tsconfig.json" --auto
```

**Common configuration files:**
- Environment variables (`.env*`)
- Package dependencies (`package.json`)
- TypeScript config (`tsconfig.json`)
- Build configuration (`webpack.config.js`)
- Linting rules (`.eslintrc.json`)

### Development Environment Sync

```bash
# Sync development environment changes
mst watch --patterns "docker-compose.yml,.vscode/**,*.config.js" --auto
```

### Documentation Updates

```bash
# Keep documentation synchronized
mst watch --patterns "docs/**/*.md,README.md,CHANGELOG.md" --auto
```

## File Operations

### Hash-based Change Detection

The watch command uses MD5 hashing to detect actual file changes:

```bash
# Only syncs when file content actually changes
# Ignores timestamp-only modifications
```

### Conflict Resolution

When file conflicts occur:

```bash
# Interactive conflict resolution
? File conflict detected: package.json
  - feature/auth: modified 2 minutes ago
  - bugfix/login: modified 1 minute ago
  
? Which version should be used?
❯ feature/auth version
  bugfix/login version
  Skip synchronization
  Show diff
```

## Performance Considerations

### Watch Optimization

- **Efficient file watching** using `chokidar`
- **Debounced synchronization** to avoid excessive operations
- **Pattern-based filtering** to reduce file system overhead
- **Hash-based change detection** to avoid unnecessary syncs

### Resource Usage

```bash
# Monitor resource usage
mst watch --patterns "src/**/*.ts" --exclude "node_modules/**"

# Limit to specific worktrees
mst watch --patterns "*.json" --all
```

## Troubleshooting

### Common Issues

1. **High CPU usage**
   ```bash
   # Exclude large directories
   mst watch --exclude "node_modules/**,dist/**,coverage/**"
   
   # Use more specific patterns
   mst watch --patterns "src/**/*.ts" # instead of **/*
   ```

2. **Files not syncing**
   ```bash
   # Check patterns match your files
   mst watch --dry --patterns "your-pattern"
   
   # Verify files aren't excluded
   mst watch --dry --exclude "your-exclude-pattern"
   ```

3. **Permission errors**
   ```bash
   # Check file permissions
   ls -la path/to/file
   
   # Verify worktree access
   mst list
   ```

## Integration Examples

### Development Workflow

```bash
# 1. Start watch in background
mst watch --auto --patterns ".env*,package.json" &

# 2. Work in different worktrees
mst shell feature/auth
# Make changes to .env.local

# 3. Changes automatically sync to other worktrees
# feature/auth/.env.local → bugfix/login/.env.local
```

### CI/CD Integration

```bash
#!/bin/bash
# Sync configuration before running tests
mst watch --dry --patterns "*.config.js,.env.test" > sync-report.txt

if [ -s sync-report.txt ]; then
  echo "Configuration out of sync, please run: mst watch --auto"
  exit 1
fi
```

## Related Commands

- [`mst list`](./list.md) - View worktrees for synchronization
- [`mst sync`](./sync.md) - Manual synchronization between worktrees
- [`mst where`](./where.md) - Get worktree paths for file operations
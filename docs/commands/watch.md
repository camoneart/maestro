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

File paths in change notifications respect the `ui.pathDisplay` configuration setting (absolute/relative paths).

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

## Security Features

### Path Validation and Protection

The watch command includes comprehensive security measures to prevent malicious file operations:

#### Directory Traversal Protection

```bash
# Automatically prevents dangerous path patterns
# These are blocked automatically:
- "../sensitive-file.txt"
- "../../etc/passwd"
- "worktree/../../../root/.ssh/"
```

**Protection Features:**
- **Path Pattern Detection**: Automatically detects and blocks `../` and `..` patterns
- **Boundary Enforcement**: Ensures all file operations stay within worktree boundaries
- **Safe Path Resolution**: Uses absolute path resolution to prevent traversal attacks
- **Real-time Validation**: Validates every file operation before execution

#### Loop Detection and Prevention

```bash
# Prevents infinite directory creation loops
# Automatically detects patterns like:
- feature/api/feature/api/feature/api/...
- Deep nesting beyond safe limits (max 10 levels)
- Repeated directory creation attempts (max 3 per path)
```

**Loop Protection Features:**
- **Depth Limiting**: Maximum directory depth of 10 levels
- **Creation Tracking**: Monitors directory creation patterns
- **Automatic Termination**: Stops operations when loops are detected
- **Resource Protection**: Prevents filesystem exhaustion from infinite loops

#### Safe Path Computation

```bash
# All relative paths are computed safely
# Dangerous paths are rejected with warnings:
🚨 危険なパスをスキップ: ../../../sensitive-data
🚨 ディレクトリトラバーサル攻撃の可能性があるパスを検出しました
🚨 ディレクトリ作成ループを検出しました
```

**Safety Measures:**
- **Relative Path Validation**: All relative paths are checked for safety
- **Worktree Boundary Checks**: Ensures operations stay within designated worktree directories
- **Error Reporting**: Clear security warnings with actionable information
- **Graceful Degradation**: Skips dangerous operations while continuing safe ones

### Branch Name Security

The security improvements specifically address vulnerabilities from branch names containing slashes:

```bash
# Branch names that previously caused issues:
feature/api/auth        # Could create: ../../feature/api/auth
hotfix/security/patch   # Could create: ../../../hotfix/security/patch

# Now safely handled with path validation:
✓ feature-api-auth      # Normalized and validated
✓ hotfix-security-patch # Properly contained within worktree
```

### Security Configuration

Configure security settings in `.maestro.json`:

```json
{
  "watch": {
    "security": {
      "maxDepth": 10,              // Maximum directory depth (default: 10)
      "maxSamePathCount": 3,       // Maximum same path creation attempts (default: 3)
      "enablePathValidation": true, // Enable path validation (default: true)
      "strictBoundaryCheck": true   // Strict worktree boundary enforcement (default: true)
    }
  }
}
```

### Use Case: Secure Multi-Worktree Development

```bash
# Safe development workflow with security protection
mst watch --patterns "src/**/*.ts" --auto

# Security features automatically:
# 1. Validate all file paths before sync
# 2. Prevent directory traversal attempts
# 3. Detect and prevent infinite directory loops
# 4. Ensure all operations stay within worktree boundaries
# 5. Provide clear security warnings for blocked operations
```

## Related Commands

- [`mst list`](./list.md) - View worktrees for synchronization
- [`mst sync`](./sync.md) - Manual synchronization between worktrees
- [`mst where`](./where.md) - Get worktree paths for file operations
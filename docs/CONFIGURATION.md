# Configuration Guide

This guide provides comprehensive documentation for configuring Maestro through `.maestro.json` files.

## Table of Contents

- [Configuration Files](#configuration-files)
- [Configuration Schema](#configuration-schema)
- [Complete Examples](#complete-examples)
- [Advanced Usage](#advanced-usage)
- [Migration Guide](#migration-guide)

## Configuration Files

Maestro supports multiple configuration file locations and formats:

### File Priority Order

1. `.maestro.json` (project root) - **Recommended**
2. `.maestrorc.json` (project root)
3. `maestro.config.json` (project root)
4. `~/.maestrorc` (user home)
5. `~/.maestrorc.json` (user home)

### Local Configuration

- `.maestro.local.json` - User-specific settings that override project settings (gitignored)

## Configuration Schema

### worktrees

Controls where and how worktrees are created.

```json
{
  "worktrees": {
    "path": "../maestro-{branch}",
    "directoryPrefix": "",
    "branchPrefix": ""
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | string | `"../maestro-{branch}"` | Directory pattern for worktrees. Supports `{branch}` placeholder |
| `directoryPrefix` | string | `""` | Prefix added to all worktree directory names |
| `branchPrefix` | string | `""` | Default prefix for new branch names |

**Examples:**
```json
// Place worktrees in a dedicated directory
{
  "worktrees": {
    "path": "../workspaces/{branch}"
  }
}

// Add team prefix to branches
{
  "worktrees": {
    "branchPrefix": "team-alpha/"
  }
}
```

### development

Development environment configuration.

```json
{
  "development": {
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"],
    "defaultEditor": "cursor"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoSetup` | boolean | `true` | Auto-run setup commands after worktree creation |
| `syncFiles` | string[] | `[".env", ".env.local"]` | Files to sync across all worktrees |
| `defaultEditor` | string | `"cursor"` | Default editor: `"vscode"`, `"cursor"`, or `"none"` |

**Examples:**
```json
// Disable auto-setup for manual control
{
  "development": {
    "autoSetup": false
  }
}

// Sync additional configuration files
{
  "development": {
    "syncFiles": [".env", ".env.local", "config/local.json"]
  }
}
```

### postCreate

Automation that runs after worktree creation. This is separate from `hooks.afterCreate`.

```json
{
  "postCreate": {
    "copyFiles": [".env", "config/dev.json"],
    "commands": ["npm install", "npm run setup"]
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `copyFiles` | string[] | - | Files to copy from main worktree |
| `commands` | string[] | - | Commands to execute in new worktree |

**Note:** `postCreate` runs before `hooks.afterCreate`.

**Examples:**
```json
// Python project setup
{
  "postCreate": {
    "copyFiles": [".env", "config.ini"],
    "commands": ["python -m venv venv", "pip install -r requirements.txt"]
  }
}

// Monorepo setup
{
  "postCreate": {
    "commands": ["pnpm install", "pnpm build:deps"]
  }
}
```

### tmux

tmux integration settings.

```json
{
  "tmux": {
    "enabled": false,
    "openIn": "window",
    "sessionNaming": "{branch}"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable tmux integration by default |
| `openIn` | string | `"window"` | Open in `"window"` or `"pane"` |
| `sessionNaming` | string | `"{branch}"` | Session naming pattern |

**Examples:**
```json
// Always use tmux with custom naming
{
  "tmux": {
    "enabled": true,
    "sessionNaming": "mst-{branch}"
  }
}
```

### claude

Claude Code integration settings.

```json
{
  "claude": {
    "markdownMode": "shared"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `markdownMode` | string | `"shared"` | `"shared"` (symlink to main) or `"split"` (independent files) |

**Examples:**
```json
// Use independent CLAUDE.md for each worktree
{
  "claude": {
    "markdownMode": "split"
  }
}
```

### github

GitHub integration configuration.

```json
{
  "github": {
    "autoFetch": true,
    "branchNaming": {
      "prTemplate": "pr-{number}",
      "issueTemplate": "issue-{number}"
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoFetch` | boolean | `true` | Auto-fetch before GitHub operations |
| `branchNaming.prTemplate` | string | `"pr-{number}"` | PR branch naming template |
| `branchNaming.issueTemplate` | string | `"issue-{number}"` | Issue branch naming template |

**Examples:**
```json
// Custom branch naming convention
{
  "github": {
    "branchNaming": {
      "prTemplate": "pr/{number}-{title}",
      "issueTemplate": "issue/{number}-{title}"
    }
  }
}
```

### ui

User interface preferences.

```json
{
  "ui": {
    "pathDisplay": "absolute"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pathDisplay` | string | `"absolute"` | Path display: `"absolute"` or `"relative"` |

**Examples:**
```json
// Show relative paths for cleaner output
{
  "ui": {
    "pathDisplay": "relative"
  }
}
```

### hooks

Lifecycle hooks for custom automation.

```json
{
  "hooks": {
    "afterCreate": "npm install",
    "beforeDelete": "echo \"Cleaning up: $ORCHESTRA_MEMBER\""
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `afterCreate` | string \| string[] | - | Commands after worktree creation |
| `beforeDelete` | string | - | Command before worktree deletion |

**Environment Variables:**
- `$ORCHESTRA_MEMBER` - The branch name
- `$WORKTREE_PATH` - Full path to the worktree

**Examples:**
```json
// Multiple commands after creation
{
  "hooks": {
    "afterCreate": [
      "npm install",
      "npm run build",
      "echo 'Worktree ready!'"
    ]
  }
}

// Cleanup before deletion
{
  "hooks": {
    "beforeDelete": "npm run cleanup && git stash"
  }
}
```

## Complete Examples

### Node.js/TypeScript Project

```json
{
  "worktrees": {
    "path": "../workspaces/{branch}"
  },
  "development": {
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"],
    "defaultEditor": "vscode"
  },
  "postCreate": {
    "copyFiles": [".env"],
    "commands": ["npm install"]
  },
  "tmux": {
    "enabled": true,
    "sessionNaming": "dev-{branch}"
  },
  "github": {
    "branchNaming": {
      "issueTemplate": "feature/{number}-{title}"
    }
  },
  "hooks": {
    "afterCreate": "npm run dev",
    "beforeDelete": "npm run clean"
  }
}
```

### Python Project

```json
{
  "worktrees": {
    "path": "../branches/{branch}"
  },
  "development": {
    "autoSetup": false,
    "syncFiles": [".env", "config.ini"]
  },
  "postCreate": {
    "copyFiles": [".env", "config.ini"],
    "commands": [
      "python -m venv venv",
      "source venv/bin/activate && pip install -r requirements.txt"
    ]
  },
  "hooks": {
    "afterCreate": "pre-commit install"
  }
}
```

### Monorepo Project

```json
{
  "worktrees": {
    "path": "../mono-{branch}",
    "branchPrefix": "workspace/"
  },
  "development": {
    "autoSetup": true,
    "syncFiles": [".env", ".env.local", "turbo.json"]
  },
  "postCreate": {
    "commands": [
      "pnpm install",
      "pnpm build:shared",
      "pnpm prepare"
    ]
  },
  "claude": {
    "markdownMode": "split"
  },
  "hooks": {
    "afterCreate": ["pnpm dev:setup", "pnpm test"],
    "beforeDelete": "pnpm clean:all"
  }
}
```

## Advanced Usage

### Conditional Configuration

While Maestro doesn't support conditional configuration directly, you can use different approaches:

1. **Environment-specific files**
   ```bash
   # .maestro.json for production
   # .maestro.local.json for local overrides (gitignored)
   ```

2. **Branch-based configuration**
   ```bash
   # Create different configs for different branch patterns
   mst init --minimal  # For feature branches
   mst init           # For main development
   ```

### Using with CI/CD

```json
{
  "development": {
    "autoSetup": false  // Disable for CI environments
  },
  "hooks": {
    "afterCreate": [
      "[ -z \"$CI\" ] && npm install || echo 'Skipping install in CI'"
    ]
  }
}
```

### Complex Project Structures

For projects with multiple apps or services:

```json
{
  "worktrees": {
    "path": "../services/{branch}"
  },
  "postCreate": {
    "copyFiles": [
      ".env",
      "docker-compose.override.yml",
      "services/*/config.local.js"
    ],
    "commands": [
      "docker-compose build",
      "make setup-all"
    ]
  }
}
```

## Migration Guide

### From v3.0.0 to v3.5.0+

The main change is the addition of `postCreate`:

**Before (v3.0.0):**
```json
{
  "hooks": {
    "afterCreate": ["cp ../.env .", "npm install"]
  }
}
```

**After (v3.5.0+):**
```json
{
  "postCreate": {
    "copyFiles": [".env"],
    "commands": ["npm install"]
  }
}
```

### From manual worktree management

If you're migrating from manual Git worktree commands:

1. Run `mst init` to create initial configuration
2. Customize the `worktrees.path` to match your existing structure
3. Add your setup commands to `postCreate.commands`
4. Test with `mst create test-branch --dry-run`

## Tips and Best Practices

1. **Keep `.maestro.json` in version control** - Share team settings
2. **Use `.maestro.local.json` for personal preferences** - Override without affecting others
3. **Leverage `postCreate` for consistency** - Ensure all worktrees start with the same state
4. **Use environment variables in hooks** - Make scripts more flexible
5. **Test configuration changes** - Use `--dry-run` when available

## Troubleshooting

### Common Issues

**postCreate commands fail**
- Ensure commands work from the worktree directory
- Check file paths are relative to worktree root
- Use `&&` to chain dependent commands

**Files not syncing**
- Verify files exist in main worktree
- Check file permissions
- Use absolute paths if needed

**Hooks not executing**
- Ensure proper escaping in JSON strings
- Test commands manually first
- Check for shell-specific syntax

### Debug Mode

```bash
DEBUG=mst:* mst create test-branch
```

This will show detailed logs including configuration loading and command execution.
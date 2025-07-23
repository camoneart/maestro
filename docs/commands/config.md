# 🔸 config

Command to manage maestro configuration settings. Handles both global user settings and project-specific configurations to customize maestro behavior for different development environments.

## Overview

```bash
mst config [action] [options]
```

## Usage Examples

### Basic Usage

```bash
# Display usage instructions
mst config

# Initialize project configuration file
mst config init

# Show current configuration
mst config show

# Display configuration file paths
mst config path
```

### Advanced Usage

```bash
# Show configuration with global settings highlighted
mst config show --global

# Initialize project config and edit immediately
mst config init && code .maestro.json
```

## Actions

| Action | Description | Usage |
|--------|-------------|-------|
| `init` | Create project configuration file | `mst config init` |
| `show` | Display current effective configuration | `mst config show` |
| `path` | Show configuration file locations | `mst config path` |

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--global` | `-g` | Target global configuration | `false` |

## Configuration Files

### File Priority (highest to lowest)

1. **`.maestro.json`** - Primary project configuration
2. **`.maestrorc.json`** - Alternative project configuration  
3. **`maestro.config.json`** - Legacy project configuration
4. **Global config** - User-wide settings

## Configuration Actions

### Initialize Project Configuration (`init`)

Creates a new `.maestro.json` file with default settings:

```bash
mst config init
```

**Interactive prompt:**
```
? プロジェクト設定ファイル (.maestro.json) を作成しますか？ (Y/n)
✅ .maestro.json を作成しました

設定ファイルを編集して、プロジェクトに合わせてカスタマイズしてください
```

### Show Current Configuration (`show`)

Displays the effective configuration (merged global + project):

```bash
mst config show
```

**Sample output:**
```json
🎼 maestro 設定:

{
  "worktrees": {
    "path": ".git/orchestrations"
  },
  "development": {
    "autoSetup": true,
    "defaultEditor": "cursor"
  }
}
```

### Show Configuration Paths (`path`)

Displays all configuration file locations and their existence status:

```bash
mst config path
```

**Sample output:**
```
設定ファイルのパス:

グローバル設定:
  /Users/username/Library/Preferences/maestro-nodejs/config.json

プロジェクト設定 (優先度順):
  ✅ /path/to/project/.maestro.json
  ❌ /path/to/project/.maestrorc.json (存在しません)
```

## Related Commands

- [`mst create`](./create.md) - Uses configuration for worktree creation
- [`mst template`](./template.md) - Template configuration integration
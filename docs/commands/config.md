# 🔸 config

Command to manage maestro configuration settings. Handles both global user settings and project-specific configurations to customize maestro behavior for different development environments.

## Overview

```bash
mst config [action] [key] [value] [options]
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

### Configuration Management

```bash
# Get configuration value using dot notation
mst config get ui.pathDisplay

# Set configuration value using dot notation
mst config set ui.pathDisplay relative

# Reset configuration value to default
mst config reset ui.pathDisplay
```

### Advanced Usage

```bash
# Show configuration with global settings highlighted
mst config show --global

# Initialize project config and edit immediately
mst config init && code .maestro.json

# Set nested configuration values with explicit targets
mst config set --user ui.pathDisplay relative
mst config set --project development.autoSetup false
mst config set --project worktrees.path "../my-worktrees"

# Override automatic detection
mst config set --project ui.pathDisplay relative  # Force save to project settings
```

## Actions

| Action | Description | Usage |
|--------|-------------|-------|
| `init` | Create project configuration file | `mst config init` |
| `show` | Display current effective configuration | `mst config show` |
| `path` | Show configuration file locations | `mst config path` |
| `get <key>` | Get configuration value using dot notation | `mst config get ui.pathDisplay` |
| `set <key> <value>` | Set configuration value using dot notation | `mst config set ui.pathDisplay relative` |
| `reset <key>` | Reset configuration value to default | `mst config reset ui.pathDisplay` |

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--global` | `-g` | Target global configuration | `false` |
| `--user` | `-u` | Target user settings (.maestro.local.json) | `false` |
| `--project` | `-p` | Target project settings (.maestro.json) | `false` |

## Configuration Files

### File Priority (highest to lowest)

1. **`.maestro.local.json`** - User-specific settings (gitignored)
2. **`.maestro.json`** - Primary project configuration
3. **`.maestrorc.json`** - Alternative project configuration  
4. **`maestro.config.json`** - Legacy project configuration
5. **Global config** - User-wide settings

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

### Get Configuration Value (`get`)

Retrieves a configuration value using dot notation:

```bash
mst config get <key>
```

**Examples:**
```bash
# Get UI path display setting
mst config get ui.pathDisplay

# Get development auto-setup setting
mst config get development.autoSetup

# Get worktrees root path
mst config get worktrees.path
```

**Sample output:**
```
relative
```

If the configuration key doesn't exist:
```
設定値が見つかりません: invalid.key
```

### Set Configuration Value (`set`)

Sets a configuration value using dot notation:

```bash
mst config set <key> <value> [options]
```

**Options:**
- `--user` or `-u` - Save to user settings (.maestro.local.json) 
- `--project` or `-p` - Save to project settings (.maestro.json)
- Without options - Auto-detects based on key (UI settings → user, others → project)

**Examples:**
```bash
# Set path display format (auto-detects as user setting)
mst config set ui.pathDisplay relative

# Explicitly save to user settings
mst config set --user ui.pathDisplay relative

# Explicitly save to project settings
mst config set --project worktrees.path "../orchestra-members"

# Disable auto-setup (auto-detects as project setting)
mst config set development.autoSetup false

# Set default editor (auto-detects as user setting)
mst config set development.defaultEditor cursor
```

**Sample output:**
```
✅ ui.pathDisplay を relative に設定しました (ユーザー設定: .maestro.local.json)
```

**Note:** User settings (ui.* and development.defaultEditor) are automatically saved to `.maestro.local.json` which is gitignored, keeping personal preferences separate from shared project configuration.

### Reset Configuration Value (`reset`)

Resets a configuration value to its default:

```bash
mst config reset <key>
```

**Examples:**
```bash
# Reset path display to default (absolute)
mst config reset ui.pathDisplay

# Reset auto-setup to default (true)
mst config reset development.autoSetup

# Reset worktrees path to default
mst config reset worktrees.path
```

**Sample output:**
```
✅ ui.pathDisplay をデフォルト値にリセットしました
現在の値: absolute
```

## Configuration Keys Reference

Common configuration keys that can be used with `get`, `set`, and `reset`:

### User Settings (stored in `.maestro.local.json`, gitignored)

| Key | Description | Default Value | Type |
|-----|-------------|---------------|------|
| `ui.pathDisplay` | Path display format in commands | `"absolute"` | `"absolute"` \| `"relative"` |
| `development.defaultEditor` | Default editor to open | `"cursor"` | string |

### Project Settings (stored in `.maestro.json`, git-tracked)

| Key | Description | Default Value | Type |
|-----|-------------|---------------|------|
| `development.autoSetup` | Auto-run setup commands after creation | `true` | boolean |
| `development.syncFiles` | Files to sync across worktrees | `[".env", ".env.local"]` | array |
| `worktrees.path` | Directory to store worktrees | `"../maestro-{branch}"` | string |
| `worktrees.directoryPrefix` | Prefix for worktree directories | `""` | string |
| `worktrees.branchPrefix` | Prefix for new branches | `""` | string |
| `tmux.enabled` | Enable tmux integration | `false` | boolean |
| `tmux.openIn` | Open in window or pane | `"window"` | `"window"` \| `"pane"` |
| `tmux.sessionNaming` | Session naming pattern | `"{branch}"` | string |
| `claude.markdownMode` | CLAUDE.md file management mode | `"shared"` | `"shared"` \| `"split"` |
| `github.autoFetch` | Auto-fetch before operations | `true` | boolean |
| `github.branchNaming.prTemplate` | PR branch naming template | `"pr-{number}"` | string |
| `github.branchNaming.issueTemplate` | Issue branch naming template | `"issue-{number}"` | string |
| `hooks.*` | Hook configurations | varies | object |

**Note:** When using `mst config set`, user settings are automatically detected and saved to `.maestro.local.json`. Use `--project` flag to override this behavior if needed.

## Related Commands

- [`mst create`](./create.md) - Uses configuration for worktree creation
- [`mst init`](./init.md) - Creates initial configuration file
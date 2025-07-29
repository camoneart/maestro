# 🔸 init

The `init` command helps you bootstrap your project with proper Maestro configuration. It automatically detects your project type and suggests optimal settings for seamless worktree management.

## Usage

```bash
mst init [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-m, --minimal` | Create minimal configuration | false |
| `-p, --package-manager <manager>` | Specify package manager (pnpm/npm/yarn/none) | auto-detect |
| `-y, --yes` | Skip prompts and use defaults | false |
| `-h, --help` | Display help message | - |

## Features

### 🔍 Smart Project Detection

The init command automatically detects your project type and suggests appropriate configuration:

- **React**: Detects React applications and suggests React-specific setup
- **Next.js**: Identifies Next.js projects with additional env files
- **Vue.js**: Recognizes Vue.js projects with Vue-specific configuration
- **Python**: Detects Python projects with `requirements.txt` or `pyproject.toml`
- **Go**: Identifies Go projects with `go.mod` files
- **Generic**: Fallback for other project types

### 📦 Package Manager Detection

Automatically detects your package manager from lockfiles:

- **pnpm**: Detected from `pnpm-lock.yaml`
- **npm**: Detected from `package-lock.json`
- **yarn**: Detected from `yarn.lock`
- **none**: For non-Node.js projects

### 🛡️ Safe Overwrite Protection

If `.maestro.json` already exists, the command will:
- Prompt for confirmation before overwriting (interactive mode)
- Skip prompting and overwrite with `--yes` flag

## Examples

### Interactive Setup

```bash
mst init
```

This will guide you through an interactive setup with prompts for:
- Package manager selection
- Worktree directory path
- Branch prefix preferences
- Default editor choice
- Environment file handling

### Quick Minimal Setup

```bash
mst init --minimal
```

Creates a basic configuration with:
- Default worktree path: `.git/orchestra-members`
- Auto-setup enabled
- Default editor: Cursor

### Automatic Setup

```bash
mst init --yes
```

Uses detected project settings without prompts:
- Auto-detects project type and package manager
- Uses sensible defaults for all options
- Perfect for CI/CD environments

### Override Package Manager

```bash
mst init --package-manager yarn --yes
```

Forces use of specific package manager regardless of detection.

## Configuration Generated

The init command creates a `.maestro.json` file with structure like:

### Minimal Configuration

```json
{
  "worktrees": {
    "path": "../maestro-{branch}"
  },
  "development": {
    "autoSetup": true,
    "defaultEditor": "cursor"
  }
}
```

### Full Configuration with Defaults

```json
{
  "worktrees": {
    "path": "../maestro-{branch}",       // Default: "../maestro-{branch}"
    "directoryPrefix": "",                // Default: "" (empty string)
    "branchPrefix": "feature/"            // Custom prefix for new branches
  },
  "development": {
    "autoSetup": true,                    // Default: true
    "syncFiles": [".env", ".env.local"],  // Default: [".env", ".env.local"]
    "defaultEditor": "cursor"             // Default: "cursor"
  },
  "tmux": {
    "enabled": false,                     // Default: false
    "openIn": "window",                   // Default: "window"
    "sessionNaming": "{branch}"           // Default: "{branch}"
  },
  "claude": {
    "markdownMode": "shared"              // Default: "shared"
  },
  "github": {
    "autoFetch": true,                    // Default: true
    "branchNaming": {
      "prTemplate": "pr-{number}",        // Default: "pr-{number}"
      "issueTemplate": "issue-{number}"   // Default: "issue-{number}"
    }
  },
  "ui": {
    "pathDisplay": "absolute"             // Default: "absolute"
  },
  "postCreate": {
    "copyFiles": [".env", ".env.local"],
    "commands": ["pnpm install"]
  },
  "hooks": {
    "afterCreate": "pnpm install",
    "beforeDelete": "echo \"演奏者を削除します: $ORCHESTRA_MEMBER\""
  }
}
```

## Project-Specific Configurations

### React Projects

```json
{
  "postCreate": {
    "copyFiles": [".env", ".env.local"],
    "commands": ["pnpm install"]
  }
}
```

### Next.js Projects

```json
{
  "postCreate": {
    "copyFiles": [".env", ".env.local", ".env.development.local"],
    "commands": ["pnpm install"]
  }
}
```

### Python Projects

```json
{
  "postCreate": {
    "copyFiles": [".env"],
    "commands": ["pip install -r requirements.txt"]
  }
}
```

### Go Projects

```json
{
  "postCreate": {
    "copyFiles": [".env"],
    "commands": ["go mod download"]
  }
}
```

## Interactive Prompts

When running `mst init` without flags, you'll see prompts like:

```
🎼 Welcome to Maestro Setup!

検出されたプロジェクト: React ✅

? どのパッケージマネージャーを使用しますか？ (Use arrow keys)
❯ pnpm
  npm
  yarn
  none (パッケージマネージャーを使用しない)

? worktreeを作成するディレクトリは？ (.git/orchestra-members)

? ブランチ名のプレフィックスは？ (feature/)

? デフォルトのエディタは？ (Use arrow keys)
❯ Cursor
  VS Code
  Vim
  その他

? 依存関係の自動インストールを有効にしますか？ (Y/n)

? 環境ファイルをworktreeにコピーしますか？ (Y/n)

? コピーするファイルを指定 (カンマ区切り): (.env, .env.local)
```

## Next Steps

After successful initialization, the command will show:

```
🎉 Maestro の設定が完了しました！

次のステップ:
  mst create <branch-name>  # 新しい演奏者を招集
  mst list                  # 演奏者一覧を表示
  mst --help               # その他のコマンドを確認

💡 worktree作成時に自動で実行されるコマンド: pnpm install
```

## Error Handling

The init command handles various error scenarios:

- **Permission errors**: When unable to write `.maestro.json`
- **Invalid project structure**: When project type cannot be determined
- **Existing configuration conflicts**: When overwrite is declined
- **Invalid package manager**: When specified package manager is not recognized

## Integration with Other Commands

After initialization, the generated configuration will be used by:

- `mst create` - Uses `branchPrefix` and `postCreate` settings
- `mst config` - Can modify the generated configuration

## Best Practices

1. **Run init first**: Always initialize Maestro before using other commands
2. **Review configuration**: Check generated `.maestro.json` for project-specific needs
3. **Commit configuration**: Add `.maestro.json` to version control for team consistency
4. **Update as needed**: Re-run init or manually edit configuration as project evolves

## Troubleshooting

### Common Issues

**Q: Init command doesn't detect my project type**
A: Ensure you have the appropriate files (`package.json`, `requirements.txt`, `go.mod`) in your project root.

**Q: Wrong package manager detected**
A: Use `--package-manager` flag to override detection or remove conflicting lockfiles.

**Q: Permission denied when creating .maestro.json**
A: Check write permissions in your project directory.

**Q: Command hangs during interactive setup**
A: Use `--yes` flag for non-interactive mode or check terminal compatibility.

For more troubleshooting tips, see the main [troubleshooting guide](../TROUBLESHOOTING.md).
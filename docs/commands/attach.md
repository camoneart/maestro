# 🔸 attach

Command to create orchestra members (Git worktrees) from existing branches. Allows you to attach to local or remote branches to create independent development environments.

## Overview

```bash
mst attach [branch-name] [options]
mst a [branch-name] [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# Interactive branch selection from available branches
mst attach

# Attach to specific local branch
mst attach feature/existing-feature

# Include remote branches in selection
mst attach --remote

# Attach to specific remote branch
mst attach origin/feature/remote-branch --remote
```

### Advanced Usage

```bash
# Fetch latest remote data before listing branches
mst attach --fetch --remote

# Attach and open in editor with environment setup
mst attach feature/api --open --setup

# Attach and execute command
mst attach bugfix/issue-123 --exec "npm test"

# Attach and enter shell session
mst attach feature/new --shell
```

## Options

| Option            | Short | Description                                      | Default |
| ----------------- | ----- | ------------------------------------------------ | ------- |
| `--remote`        | `-r`  | Include remote branches in selection             | `false` |
| `--fetch`         | `-f`  | Fetch from remote before listing branches       | `false` |
| `--open`          | `-o`  | Open in editor (Cursor/VSCode) after attachment | `false` |
| `--setup`         | `-s`  | Run environment setup (npm install)             | `false` |
| `--shell`         |       | Enter shell session after attachment            | `false` |
| `--exec <command>`|       | Execute command after attachment                 | none    |

## Branch Selection

### Interactive Mode

When no branch name is provided, displays an interactive menu:

```
? Which branch would you like to attach to?
❯ [local] feature/authentication
  [local] bugfix/login-issue
  [remote] origin/feature/api-v2
  [remote] origin/hotfix/security-patch
```

### Available Branches

The command only shows branches that are not already attached as worktrees:

- **Local branches**: Branches that exist locally and aren't currently attached
- **Remote branches**: Remote branches that can be checked out (with `--remote` option)
- **Filtered**: Branches already attached as worktrees are automatically excluded

### Branch Validation

If a branch name is specified but doesn't exist:

```
Error: Branch 'feature/nonexistent' not found

Available branches:
  - feature/authentication
  - feature/api-integration
```

## Remote Branch Integration

### Fetching Remote Data

```bash
# Update remote references before listing
mst attach --fetch --remote
```

### Working with Remote Branches

```bash
# Attach to remote branch (creates local tracking branch)
mst attach origin/feature/new-api --remote

# Interactive selection including remote branches
mst attach --remote
```

Remote branches are automatically set up with proper tracking when attached.

## Environment Setup

### Automatic Setup (`--setup`)

When using the `--setup` option:

1. **npm install**: Automatically runs in the new worktree directory
2. **Dependency installation**: Ensures the environment is ready for development
3. **Error handling**: Gracefully handles cases where npm install isn't needed

```bash
# Attach with automatic environment setup
mst attach feature/api --setup
```

### Editor Integration (`--open`)

Automatically opens the worktree in your preferred editor:

1. **Cursor**: Tries to open with Cursor first
2. **VSCode**: Falls back to VSCode (`code` command)
3. **Graceful fallback**: Shows warning if neither editor is available

```bash
# Attach and open in editor
mst attach feature/ui --open
```

## Command Execution

### Execute Command (`--exec`)

Run a command in the newly attached worktree:

```bash
# Run tests in the attached worktree
mst attach feature/api --exec "npm test"

# Run multiple commands
mst attach bugfix/issue-123 --exec "npm install && npm run dev"

# Build and verify
mst attach feature/build --exec "npm run build && npm run lint"
```

### Shell Integration (`--shell`)

Enter an interactive shell session in the attached worktree:

```bash
# Enter shell with environment variables set
mst attach feature/debug --shell
```

Environment variables available in shell:
- `MAESTRO=1`: Indicates Maestro environment
- `MAESTRO_NAME`: Branch name
- `MAESTRO_PATH`: Worktree path

## Workflow Examples

### Code Review Workflow

```bash
# 1. Fetch latest remote branches
mst attach --fetch --remote

# 2. Select PR branch for review
mst attach origin/feature/pr-branch --remote --open

# 3. Test the changes
mst exec pr-branch npm test
```

### Bug Investigation

```bash
# 1. Attach to bug report branch
mst attach bugfix/issue-456 --setup

# 2. Enter shell for investigation
mst attach bugfix/issue-456 --shell

# 3. Run diagnostic commands
npm run debug:issue-456
```

### Feature Development Continuation

```bash
# 1. Continue work on existing feature branch
mst attach feature/authentication --open --setup

# 2. Run development server
mst exec feature/authentication npm run dev
```

## Integration with Other Commands

### Branch Discovery

```bash
# List all branches (including remote)
git branch -a

# Attach to discovered branch
mst attach feature/discovered-branch
```

### Worktree Management

```bash
# Check current worktrees
mst list

# Attach to branch not currently as worktree
mst attach feature/available-branch

# Verify attachment
mst list
```

## Error Handling

### Common Errors

1. **Not a Git repository**
   ```
   このディレクトリはGitリポジトリではありません
   ```
   Solution: Run command in a Git repository directory

2. **Branch not found**
   ```
   エラー: ブランチ 'nonexistent' が見つかりません
   ```
   Solution: Check available branches with `git branch -a` or use interactive mode

3. **No available branches**
   ```
   No available branches
   All branches already exist as orchestra members
   ```
   Solution: All branches are already attached as worktrees

4. **Environment setup failure**
   ```
   Skipping npm install
   ```
   Solution: This is a warning, not an error. Setup continues normally

## Best Practices

### 1. Use Fetch for Remote Work

```bash
# Always fetch when working with remote branches
mst attach --fetch --remote
```

### 2. Combine Options for Efficiency

```bash
# Set up complete development environment in one command
mst attach feature/new --fetch --setup --open
```

### 3. Use Shell for Complex Workflows

```bash
# Enter shell for interactive development
mst attach feature/complex --shell
```

### 4. Validate Before Attachment

```bash
# Check available branches first
git branch -a | grep feature

# Then attach
mst attach feature/target-branch
```

## Tips & Tricks

### 1. Create Aliases for Common Patterns

```bash
# Add to ~/.bashrc or ~/.zshrc
alias msta='mst attach'
alias mstar='mst attach --remote --fetch'
alias mstao='mst attach --open --setup'

# Usage
mstar                    # Interactive with remote branches
mstao feature/branch     # Attach with full setup
```

### 2. Script Integration

```bash
#!/bin/bash
# Attach to all feature branches for testing
git branch | grep feature/ | sed 's/*//' | xargs -I {} mst attach {} --exec "npm test"
```

### 3. Quick Branch Switching

```bash
# Function to quickly attach and switch
attach_and_cd() {
  local branch=$1
  mst attach "$branch" --shell
}

# Usage
attach_and_cd feature/new-api
```

## Related Commands

- [`mst create`](./create.md) - Create new orchestra members from scratch
- [`mst list`](./list.md) - View all attached orchestra members
- [`mst delete`](./delete.md) - Delete orchestra members
- [`mst where`](./where.md) - Show orchestra member paths
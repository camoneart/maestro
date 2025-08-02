# 🔸 exec

Execute commands in specific or all orchestra members.

## Overview

The `exec` command allows you to run any command within the context of one or multiple worktrees without entering their shell environment. This is particularly useful for running build commands, tests, or any other operations across your orchestra members.

## Usage

```bash
mst exec [branch-name] <command> [options]
mst e [branch-name] <command> [options]  # alias
```

## Options

- `-s, --silent` - Suppress command output
- `-a, --all` - Execute on all orchestra members
- `--fzf` - Interactively select orchestra member with fzf
- `-t, --tmux` - Execute in new tmux window
- `--tmux-vertical`, `--tmux-v` - Execute in vertical split pane
- `--tmux-horizontal`, `--tmux-h` - Execute in horizontal split pane

## Examples

### Basic Usage

Execute a command in a specific orchestra member:

```bash
# Run tests in feature branch
mst exec feature/awesome npm test

# Build project
mst exec feature/ui npm run build

# Check git status
mst exec hotfix/urgent git status
```

### Execute in All Orchestra Members

Run the same command across all worktrees:

```bash
# Install dependencies in all (various formats)
mst exec --all npm install
mst exec -a npm install

# Run linting in all
mst exec --all npm run lint
mst exec -a npm run lint

# Check git status of all
mst exec --all git status --short
mst exec -a git status --short

# Note: When using -a/--all flag, the branch name argument is optional.
# Both of these work:
mst exec dummy npm test --all  # 'dummy' is ignored
mst exec -a npm test           # More concise
```

### Interactive Selection with fzf

Select which orchestra member to execute in:

```bash
# Select and run dev server
mst exec --fzf npm run dev

# Select and run tests
mst exec --fzf npm test
```

### tmux Integration

Execute commands in tmux panes for better workflow:

```bash
# Open in new tmux window
mst exec feature/api --tmux npm run watch

# Open in vertical split (side by side)
mst exec feature/ui --tmux-v npm run dev

# Open in horizontal split (top and bottom)
mst exec backend --tmux-h npm run test:watch

# Combine with fzf selection
mst exec --fzf --tmux npm start
```

## Environment Variables

When executing commands, these environment variables are automatically set:

- `MAESTRO_BRANCH` - The branch name of the worktree
- `MAESTRO_PATH` - The absolute path to the worktree

## Use Cases

1. **Running Tests**
   ```bash
   # Run tests in specific branch
   mst exec feature/auth npm test
   
   # Run tests in all branches
   mst exec --all npm test
   mst exec -a npm test
   ```

2. **Building Projects**
   ```bash
   # Build specific feature
   mst exec feature/ui npm run build
   
   # Build all features
   mst exec --all npm run build
   mst exec -a npm run build
   ```

3. **Git Operations**
   ```bash
   # Check status
   mst exec feature/api git status
   
   # Pull latest changes in all
   mst exec --all git pull
   mst exec -a git pull
   ```

4. **Development Servers**
   ```bash
   # Start dev server with tmux
   mst exec feature/frontend --tmux npm run dev
   
   # Start multiple servers in splits
   mst exec backend --tmux-v npm run server
   mst exec frontend --tmux-h npm run dev
   ```

## Tips

- Use `--silent` to suppress output when running in multiple worktrees
- Combine `--fzf` with tmux options for interactive workflow
- Use quotes for complex commands: `mst exec feature "npm run build && npm test"`
- The command is executed with `sh -c`, so shell features like pipes and redirects work

## Error Handling

### CLI Option Validation

The exec command implements **strict option validation** to prevent execution with invalid options:

**Immediate Exit on Invalid Options**:
- **Early Detection**: Command exits immediately when unknown or invalid options are provided
- **Prevents Execution**: Command will not proceed with command execution when invalid options are detected
- **Clear Error Messages**: Specific feedback about which options are invalid

### Common Error Handling

- If the specified branch doesn't exist, suggestions for similar branches are shown
- Exit codes from executed commands are preserved
- Use `--all` carefully as it executes in all worktrees sequentially

## Related Commands

- [shell](./shell.md) - Enter an interactive shell
- [batch](./batch.md) - Batch operations on multiple worktrees
- [list](./list.md) - List all orchestra members
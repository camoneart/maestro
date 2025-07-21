# mst claude

Manage Claude Code instances for each orchestra member (worktree). This command allows you to start, stop, and monitor Claude Code processes across multiple worktrees.

## Overview

```bash
mst claude <subcommand> [options]
```

## Subcommands

### list (ls)

List all running Claude Code instances across orchestra members.

```bash
mst claude list
mst claude ls  # alias
```

Example output:
```
🤖 Claude Code Instances:

● feature/auth - Running (Started: 2025-07-21 10:30:45)
● feature/api - Running (Started: 2025-07-21 11:15:22)
● bugfix/login - Stopped
```

### start

Start Claude Code for a specific orchestra member or all members.

```bash
# Start for specific branch
mst claude start <branch-name>

# Start for all orchestra members
mst claude start --all
```

#### Options
- `--all` - Start Claude Code for all orchestra members

#### Examples
```bash
# Start Claude Code for feature/auth branch
mst claude start feature/auth

# Start Claude Code for all branches
mst claude start --all
```

### stop

Stop Claude Code for a specific orchestra member or all members.

```bash
# Stop for specific branch
mst claude stop <branch-name>

# Stop all Claude Code instances
mst claude stop --all
```

#### Options
- `--all` - Stop Claude Code for all orchestra members

#### Examples
```bash
# Stop Claude Code for feature/auth branch
mst claude stop feature/auth

# Stop all Claude Code instances
mst claude stop --all
```

## Features

### Process Management

The claude command manages Claude Code processes intelligently:

1. **State Persistence**: Process states are saved in `.maestro/claude-instances.json`
2. **Duplicate Prevention**: Checks if Claude Code is already running before starting
3. **Clean Shutdown**: Properly terminates processes when stopping

### Integration with Other Commands

The claude command works seamlessly with other maestro commands:

```bash
# Create worktree and start Claude Code
mst create feature/new --claude

# Use with tmux for better workflow
mst create feature/new --tmux --claude
```

## Use Cases

### 1. Multiple Feature Development

When working on multiple features simultaneously:

```bash
# Start Claude Code for all active features
mst claude start --all

# Check which instances are running
mst claude list

# Stop specific instance when done
mst claude stop feature/completed
```

### 2. Resource Management

Save system resources by managing Claude Code instances:

```bash
# List running instances
mst claude list

# Stop all instances before system maintenance
mst claude stop --all
```

### 3. Quick Context Switching

```bash
# Working on feature/auth
mst claude start feature/auth

# Need to switch to bugfix
mst claude stop feature/auth
mst claude start bugfix/urgent

# Or keep both running for quick switching
mst claude start bugfix/urgent  # Both now running
```

## Configuration

Claude Code behavior can be configured in `.maestro.json`:

```json
{
  "claude": {
    "autoStart": true,
    "markdownMode": "shared",
    "initialCommands": ["/model sonnet-3.5"],
    "costOptimization": {
      "stopHooks": ["/compact", "/clear"],
      "maxOutputTokens": 5000
    }
  }
}
```

## Troubleshooting

### Claude Code not starting

1. **Check if already running**:
   ```bash
   mst claude list
   ```

2. **Verify Claude Code is installed**:
   ```bash
   which claude
   ```

3. **Check process manually**:
   ```bash
   pgrep -f "claude.*feature/auth"
   ```

### Process not terminating

If a Claude Code process doesn't stop properly:

```bash
# Force stop (use carefully)
pkill -f "claude.*feature/auth"

# Then clean up state
rm .maestro/claude-instances.json
```

## Related Commands

- [`mst create`](./create.md) - Create worktree with `--claude` option
- [`mst tmux`](./tmux.md) - Use with tmux for better workflow
- [`mst config`](./config.md) - Configure Claude Code settings
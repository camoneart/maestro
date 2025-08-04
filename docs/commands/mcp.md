# 🔸 mcp

Command to start the MCP (Model Context Protocol) server for maestro. Enables Claude Code and Cursor integration to manage orchestra members through AI interfaces.

## Overview

```bash
mst mcp [subcommand]
```

## Usage Examples

### Basic Usage

```bash
# Display MCP server information
mst mcp

# Start MCP server
mst mcp serve
```

## Subcommands

| Subcommand | Description | Usage |
|------------|-------------|-------|
| `serve` | Start MCP server for AI integration | `mst mcp serve` |

## MCP Server Integration

### Starting the Server

```bash
mst mcp serve
```

**Output:**
```
🎼 orchestra-conductor MCPサーバーを起動中...

Claude CodeやCursorの設定に以下を追加してください:

{
  "mcpServers": {
    "maestro": {
      "command": "maestro",
      "args": ["mcp", "serve"]
    }
  }
}
```

### Claude Code Integration

Add Maestro as an MCP server using the modern command:

```bash
# User scope (available across all projects on the machine)
claude mcp add maestro -s user -- npx -y @camoneart/maestro mcp serve

# Project scope (saved in .mcp.json for team sharing via version control)
claude mcp add maestro -s project -- npx -y @camoneart/maestro mcp serve

# Local scope (default - only for current project, private to you)
claude mcp add maestro -s local -- npx -y @camoneart/maestro mcp serve

# For global installation (use 'maestro' instead of 'npx')
claude mcp add maestro -s user -- maestro mcp serve
```

**Scope options explained:**
- `user`: Available across all projects on the machine, private to your user account
- `project`: Saved in `.mcp.json` at project root, designed for team sharing via version control
- `local`: Default setting, only accessible when working within the current project directory, private to you

Or manually configure in `.claude/mcp_settings.json` (legacy method):

```json
{
  "mcpServers": {
    "maestro": {
      "command": "maestro",
      "args": ["mcp", "serve"]
    }
  }
}
```

### Cursor Integration

Add to your Cursor settings:

```json
{
  "mcp": {
    "servers": {
      "maestro": {
        "command": "maestro",
        "args": ["mcp", "serve"]
      }
    }
  }
}
```

## Available MCP Tools

When the MCP server is running, the following tools become available to AI assistants:

### Worktree Management
- **Create worktrees** from branches or issues
- **List all worktrees** with status information
- **Delete worktrees** safely
- **Switch between worktrees**

### Git Operations
- **Branch management**
- **Commit operations**
- **Status checking**

### GitHub Integration
- **Issue management**
- **Pull request operations**
- **Repository information**

## Server Lifecycle

### Starting the Server

The MCP server runs as a persistent process:

```bash
mst mcp serve
# Server starts and waits for MCP client connections
# Press Ctrl+C to stop
```

### Stopping the Server

```bash
# From the running server terminal
Ctrl+C

# Or from another terminal
pkill -f "maestro mcp serve"
```

## Configuration

### Server Settings

The MCP server automatically:
- Detects the current Git repository
- Loads maestro configuration
- Provides context-aware tools to AI clients

### Security Considerations

- **Local only**: MCP server only accepts local connections
- **Repository scope**: Operations are limited to the current Git repository
- **Safe operations**: Destructive operations require confirmation

## Troubleshooting

### Common Issues

1. **Server fails to start**
   ```bash
   # Check if maestro is properly installed
   which maestro
   
   # Verify in Git repository
   git status
   ```

2. **AI client can't connect**
   ```bash
   # Verify MCP server is running
   ps aux | grep "maestro mcp"
   
   # Check client configuration
   # Ensure command path is correct
   ```

3. **Tools not available in AI client**
   ```bash
   # Restart MCP server
   # Restart AI client
   # Verify configuration syntax
   ```

## Development

### MCP Protocol

The server implements the Model Context Protocol specification:
- **Tools**: Exposed functions for worktree management
- **Resources**: Git repository information
- **Prompts**: Context-aware suggestions

### Server Implementation

Located at `src/mcp/server.ts`, the server provides:
- Git worktree operations
- GitHub API integration
- Configuration management
- Safe execution environment

## Related Commands

- [`mst create`](./create.md) - Create worktrees (available via MCP)
- [`mst list`](./list.md) - List worktrees (available via MCP)
- [`mst delete`](./delete.md) - Orchestra members exit (available via MCP)
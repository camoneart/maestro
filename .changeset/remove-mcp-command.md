---
"@camoneart/maestro": major
---

Remove obsolete `mcp` command and add dedicated MCP server binary

BREAKING CHANGE: The `mcp` command has been removed. It became obsolete with the introduction of the modern `claude mcp add` command which automatically manages the MCP server lifecycle.

**Migration:**
- Users no longer need to manually start the MCP server with `mst mcp serve`
- Claude Code automatically manages the server lifecycle
- New dedicated `maestro-mcp-server` binary added for MCP integration

**Setup for different scopes:**
```bash
# Local scope (default - current project only)
claude mcp add maestro -- npx -y @camoneart/maestro maestro-mcp-server

# Project scope (saved in .mcp.json for team sharing)
claude mcp add maestro -s project -- npx -y @camoneart/maestro maestro-mcp-server

# User scope (all projects on machine)
claude mcp add maestro -s user -- npx -y @camoneart/maestro maestro-mcp-server

# For global installation
claude mcp add maestro -s user -- maestro-mcp-server
```

**Rationale:**
- Simplifies the CLI by removing unnecessary complexity
- Reduces confusion for users
- Reduces maintenance burden
- Aligns with modern MCP setup practices
- Provides dedicated binary for cleaner MCP integration

Fixes #207
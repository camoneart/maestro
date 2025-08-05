---
"@camoneart/maestro": major
---

Remove obsolete `mcp` command

BREAKING CHANGE: The `mcp` command has been removed. It became obsolete with the introduction of the modern `claude mcp add` command which automatically manages the MCP server lifecycle.

**Migration:**
- Users no longer need to manually start the MCP server with `mst mcp serve`
- Claude Code automatically manages the server lifecycle
- Use `claude mcp add maestro -s user -- npx -y @camoneart/maestro mcp serve` for setup

**Rationale:**
- Simplifies the CLI by removing unnecessary complexity
- Reduces confusion for users
- Reduces maintenance burden
- Aligns with modern MCP setup practices

Fixes #207
EOF < /dev/null
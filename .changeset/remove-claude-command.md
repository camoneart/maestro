---
"@camoneart/maestro": major
---

Remove non-functional `mst claude` command

The `mst claude` command has been removed due to fundamental design issues:
- Claude Code is an interactive CLI tool that cannot run as a background process
- The "start/stop" concept is not applicable to Claude Code
- Commands appeared to work but were actually non-functional

**Breaking Change**: The `mst claude` command and its subcommands (`start`, `stop`, `list`) are no longer available.

**Migration**: Use the `claude` command directly in your worktrees. The `--claude` option for `mst create` remains available for CLAUDE.md generation.
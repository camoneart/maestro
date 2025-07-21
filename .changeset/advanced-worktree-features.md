---
"@hashiramaendure/maestro": minor
---

Add advanced worktree management features

- Add new `mst claude` command for managing multiple Claude Code instances
  - `list`: Show running Claude Code instances across all worktrees
  - `start`: Start Claude Code for specific worktree or all worktrees
  - `stop`: Stop Claude Code for specific worktree or all worktrees
- Enhance `--copy-file` option to detect and copy gitignored files
- Add `postCreate` configuration for automatic worktree setup
  - `copyFiles`: Automatically copy files (including gitignored) to new worktrees
  - `commands`: Execute commands after worktree creation
- Support array format for `hooks.afterCreate` (backward compatible)
---
"@hashiramaendure/maestro": patch
---

feat(list): Add relative path display for better readability

- Display worktree paths relative to repository root by default
- Add `--full-path` option to show absolute paths when needed
- Current directory shows as `.` for clarity
- Significantly improves output readability of `mst list` command
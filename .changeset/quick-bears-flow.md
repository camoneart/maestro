---
"@hashiramaendure/maestro": minor
---

Add new options to create command and implement attach command

- Add `--shell` option to create command: enter shell after creating worktree
- Add `--exec <command>` option to create command: execute command after creating worktree
- Add `--copy-file <file>` option to create command: copy files from current worktree
- Implement new `attach` command: create worktree for existing branches
- Add `--shell` and `--exec` options to attach command
- Set MAESTRO environment variables when entering shell sessions
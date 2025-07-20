---
"@hashiramaendure/maestro": patch
---

fix: resolve worktree branch name matching in delete command

Fixed an issue where the `mst delete` command would fail with "ワークツリー 'refs/heads/branch-name' が見つかりません" error. The issue occurred because the delete command was passing branch names with the `refs/heads/` prefix to the GitWorktreeManager, which expects clean branch names.
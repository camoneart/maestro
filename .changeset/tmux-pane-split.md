---
"@hashiramaendure/maestro": minor
---

feat: Add tmux pane split functionality

- Add `--tmux-h` option for horizontal pane split (side by side)
- Add `--tmux-v` option for vertical pane split (top and bottom)
- Automatically execute Claude commands in new panes when `--claude` is used
- Set up tmux status line to show current Git branch
- Display branch names as pane titles

This feature brings a Phantom-like development experience to Maestro, allowing developers to maintain their current context while creating new worktrees in split panes within the same tmux window.
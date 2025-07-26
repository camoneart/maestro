# Draft PR Auto-Creation Feature

The `--draft-pr` option for the `create` command automatically creates a GitHub Draft Pull Request after creating a new worktree.

## Requirements

- GitHub CLI (`gh`) must be installed and authenticated
- Repository must have a GitHub remote configured

## Usage

```bash
# Create worktree and draft PR
mst create feature-awesome --draft-pr

# With Issue integration
mst create 123 --draft-pr

# Full options
mst create feature-awesome --base develop --open --setup --draft-pr
```

## What it does

1. Creates a new worktree and branch
2. Pushes the branch to GitHub
3. Creates a Draft PR with:
   - Appropriate title (from Issue if available)
   - Pre-filled template with sections
   - Links to related Issues/PRs
   - TODO checkboxes for implementation

## PR Template

The automatically generated PR includes:

- **概要 (Overview)**: Brief description
- **作業内容 (Work Items)**: TODO checklist
- **テスト (Testing)**: Test checklist
- **Links**: Related Issue/PR links
- **Labels**: Inherited from Issue (if applicable)

## Configuration

You can customize the PR template by modifying the code in `src/commands/create.ts`.

## Tips

- Use with `--tmux --claude-md` for immediate development start
- The PR URL is displayed after creation
- You can convert from Draft to Ready later via GitHub UI
- Works seamlessly with Issue-based branch creation
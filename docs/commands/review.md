# 🔸 review

Command to manage GitHub Pull Request reviews directly from maestro. Provides seamless integration between Git worktrees and GitHub PR review workflows.

## Overview

```bash
mst review [pr-number] [options]
```

## Usage Examples

### Basic Usage

```bash
# Interactive PR review selection
mst review

# Review specific PR
mst review 123

# Checkout PR for local review
mst review 123 --checkout

# Show PR diff
mst review 123 --diff
```

### Advanced Usage

```bash
# Approve PR with comment
mst review 123 --approve --comment "LGTM! Great work."

# Request changes
mst review 123 --request-changes --comment "Please fix the memory leak"

# Open PR in web browser
mst review 123 --web

# Auto-review flow (checkout, review, comment)
mst review 123 --auto-flow
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--checkout` | | Create worktree from PR branch | `false` |
| `--diff` | | Show PR diff | `false` |
| `--web` | | Open PR in web browser | `false` |
| `--approve` | | Approve the PR | `false` |
| `--request-changes` | | Request changes | `false` |
| `--comment <text>` | | Add review comment | none |
| `--assign <user>` | | Assign PR to user | none |
| `--auto-flow` | | Automated review workflow | `false` |

## Review Workflow

### Interactive Review

```bash
# Start interactive review
mst review
```

**Interactive prompts:**
```
? Select a Pull Request to review:
❯ #125 feat: Add dark mode support (enhancement, ui)
  #124 fix: Memory leak in background worker (bug, critical)
  #123 docs: Update API documentation (documentation)

? What would you like to do?
❯ Checkout locally for review
  Show diff
  Open in browser
  Approve
  Request changes
```

### Local Review Process

```bash
# 1. Checkout PR for local testing
mst review 123 --checkout

# 2. Test the changes
mst exec pr-123 npm test

# 3. Review code locally
code $(mst where pr-123)

# 4. Submit review
mst review 123 --approve --comment "Tested locally, works great!"
```

### Quick Review Actions

```bash
# Approve with standard message
mst review 123 --approve

# Request changes with feedback
mst review 123 --request-changes --comment "Please add unit tests"

# Add neutral comment
mst review 123 --comment "Consider using async/await here"
```

## PR Information

When reviewing, maestro automatically fetches:

- **PR metadata**: Title, description, author
- **Branch information**: Head and base branches
- **Review status**: Current reviewers and approvals
- **CI status**: Build and test results
- **File changes**: Modified files and diff

## Auto-flow Review

The `--auto-flow` option provides a comprehensive review workflow:

```bash
mst review 123 --auto-flow
```

**Auto-flow steps:**
1. **Fetch PR details** from GitHub
2. **Create local worktree** from PR branch  
3. **Run tests** automatically
4. **Open in editor** for code review
5. **Prompt for review decision**
6. **Submit review** to GitHub

## GitHub CLI Integration

This command requires GitHub CLI (`gh`) to be authenticated:

```bash
# Install GitHub CLI
brew install gh  # macOS

# Authenticate
gh auth login

# Verify authentication
gh auth status
```

## Review Types

### Approval

```bash
# Simple approval
mst review 123 --approve

# Approval with detailed feedback
mst review 123 --approve --comment "Excellent implementation! The error handling is particularly well done."
```

### Requesting Changes

```bash
# Request changes with specific feedback
mst review 123 --request-changes --comment "Please address the following:
1. Add error handling in line 45
2. Update the documentation
3. Add unit tests for the new feature"
```

### Comment-only Reviews

```bash
# Add suggestions without blocking merge
mst review 123 --comment "Consider refactoring the authentication logic for better readability"
```

## Integration with Worktrees

### PR Worktree Creation

When using `--checkout`, maestro creates a dedicated worktree:

```bash
# Creates worktree named 'pr-123'
mst review 123 --checkout

# Worktree includes PR metadata
cat .maestro-metadata.json
```

### Testing in Isolation

```bash
# Test PR in isolated environment
mst review 123 --checkout
mst exec pr-123 npm install
mst exec pr-123 npm test
```

## Error Handling

### Common Issues

1. **GitHub authentication failed**
   ```bash
   # Re-authenticate GitHub CLI
   gh auth login
   ```

2. **PR not found**
   ```bash
   # Verify PR number and repository
   gh pr list
   ```

3. **Insufficient permissions**
   ```bash
   # Check repository access
   gh repo view
   ```

## Best Practices

### 1. Structured Review Process

```bash
# 1. Get context
mst review 123 --diff

# 2. Test locally
mst review 123 --checkout
mst exec pr-123 npm test

# 3. Review code
code $(mst where pr-123)

# 4. Submit review
mst review 123 --approve --comment "Detailed feedback..."
```

### 2. Constructive Feedback

```bash
# Provide specific, actionable feedback
mst review 123 --request-changes --comment "
Great start! A few suggestions:

1. Line 23: Consider using const instead of let
2. Function validateInput could benefit from JSDoc
3. Missing error handling for API calls

Overall direction looks good!"
```

### 3. Review Templates

Create review comment templates for consistency:

```bash
# Positive review template
APPROVE_MSG="Code looks great! ✅
- Tests pass
- Documentation updated  
- Code follows conventions
Ready to merge!"

mst review 123 --approve --comment "$APPROVE_MSG"
```

## Related Commands

- [`mst github`](./github.md) - GitHub integration commands
- [`mst create`](./create.md) - Create worktrees for PR review
- [`mst exec`](./exec.md) - Run tests in PR worktrees